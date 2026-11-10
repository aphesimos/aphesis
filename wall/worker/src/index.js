/* wall · paries: the Worker in front of the wall and the Durable Object that holds it.

   GET    /messages        the live lines, newest first: { messages: [{ id, text, at }] }
   POST   /messages        { text, token } -> 201 { message } | 400 { error: 'empty'|'long'|'word'|'link'|'bad' }
                           | 403 { error: 'turnstile' } | 429 { error: 'rate', retryAfter }
   DELETE /messages/:id    removal, with `Authorization: Bearer <ADMIN_TOKEN>` -> 204 | 401 | 404

   Bindings (wrangler.toml and secrets):
     WALL              the Durable Object namespace (class Wall)
     ALLOWED_ORIGINS   comma-separated origins allowed by CORS, e.g. "https://aphes.is"
     TTL_DAYS          how long a line stays (default 30)
     BLOCKLIST         optional extra words for the filter, comma-separated
     TURNSTILE_SECRET  secret: Turnstile secret key. Without it every post is refused, unless
     ALLOW_NO_TURNSTILE is "1" (local development only)
     HASH_SALT         secret: salt for the visitor hash
     ADMIN_TOKEN       secret: the removal key

   One Durable Object instance ("wall") keeps everything in order: lines under keys `m:<time>:<id>`, so a listing is
   already chronological, and rate records under `r:<visitor hash>`. An alarm sweeps expired lines and records. */

import { check } from './filter.js';
import { take, expiresAt, visitorKey, RULE } from './ratelimit.js';

const KEEP = 300; /* the most lines a listing returns */
const DAY = 24 * 60 * 60 * 1000;

/* ---------- helpers ---------- */
function cors(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const h = { 'Vary': 'Origin' };
  if (origin && allowed.includes(origin)) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Methods'] = 'GET, POST, DELETE, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    h['Access-Control-Max-Age'] = '86400';
  }
  return h;
}

function json(body, status, headers) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, headers),
  });
}

/* equal-time comparison, so the admin key cannot be guessed one character at a time */
function same(a, b) {
  const x = new TextEncoder().encode(String(a)), y = new TextEncoder().encode(String(b));
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] || 0) ^ (y[i] || 0);
  return d === 0;
}

async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return env.ALLOW_NO_TURNSTILE === '1';
  if (!token || typeof token !== 'string' || token.length > 2048) return false;
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    const out = await r.json();
    return out.success === true;
  } catch (_) {
    return false;
  }
}

/* ---------- the Worker ---------- */
export default {
  async fetch(req, env) {
    const h = cors(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    const url = new URL(req.url);
    const wall = env.WALL.get(env.WALL.idFromName('wall'));

    if (url.pathname === '/messages' && req.method === 'GET') {
      const r = await wall.fetch('https://wall/list');
      return json(await r.json(), 200, Object.assign({}, h, { 'Cache-Control': 'public, max-age=15' }));
    }

    if (url.pathname === '/messages' && req.method === 'POST') {
      let body;
      try { body = await req.json(); } catch (_) { return json({ error: 'bad' }, 400, h); }
      if (!body || typeof body.text !== 'string') return json({ error: 'bad' }, 400, h);
      const extra = String(env.BLOCKLIST || '').split(',').map((s) => s.trim()).filter(Boolean);
      const verdict = check(body.text, extra);
      if (!verdict.ok) return json({ error: verdict.reason }, 400, h);

      const ip = req.headers.get('CF-Connecting-IP') || '';
      if (!env.HASH_SALT) return json({ error: 'unavailable' }, 503, h);
      const visitor = await visitorKey(ip, env.HASH_SALT);
      /* count the attempt first, so failed challenges are limited too */
      const rate = await wall.fetch('https://wall/rate', { method: 'POST', body: JSON.stringify({ visitor }) });
      if (rate.status === 429) {
        const { retryAfter } = await rate.json();
        return json({ error: 'rate', retryAfter }, 429, Object.assign({}, h, { 'Retry-After': String(retryAfter) }));
      }
      if (!(await verifyTurnstile(env, body.token, ip))) return json({ error: 'turnstile' }, 403, h);

      const ttl = Math.max(1, Number(env.TTL_DAYS) || 30) * DAY;
      const r = await wall.fetch('https://wall/add', { method: 'POST', body: JSON.stringify({ text: verdict.text, ttl }) });
      return json(await r.json(), 201, h);
    }

    const m = url.pathname.match(/^\/messages\/([a-z0-9]{8,40})$/);
    if (m && req.method === 'DELETE') {
      const auth = req.headers.get('Authorization') || '';
      if (!env.ADMIN_TOKEN || !same(auth, `Bearer ${env.ADMIN_TOKEN}`)) return json({ error: 'unauthorized' }, 401, h);
      const r = await wall.fetch('https://wall/remove', { method: 'POST', body: JSON.stringify({ id: m[1] }) });
      return r.status === 204 ? new Response(null, { status: 204, headers: h }) : json({ error: 'not found' }, 404, h);
    }

    return json({ error: 'not found' }, 404, h);
  },
};

/* ---------- the Durable Object ---------- */
export class Wall {
  constructor(state) {
    this.state = state;
    this.storage = state.storage;
  }

  async fetch(req) {
    const { pathname } = new URL(req.url);
    const now = Date.now();
    if (pathname === '/list') return Response.json({ messages: await this.list(now) });
    const body = await req.json();

    if (pathname === '/rate') {
      const key = `r:${body.visitor}`;
      const res = take(await this.storage.get(key), now, RULE);
      await this.storage.put(key, res.record);
      await this.schedule(expiresAt(res.record, RULE));
      return res.ok ? Response.json({ ok: true }) : Response.json({ retryAfter: res.retryAfter }, { status: 429 });
    }

    if (pathname === '/add') {
      const id = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
      const message = { id, text: body.text, at: now, exp: now + body.ttl };
      await this.storage.put(`m:${String(now).padStart(15, '0')}:${id}`, message);
      await this.storage.put(`i:${id}`, `m:${String(now).padStart(15, '0')}:${id}`);
      await this.schedule(message.exp);
      return Response.json({ message: { id, text: message.text, at: message.at } });
    }

    if (pathname === '/remove') {
      const key = await this.storage.get(`i:${body.id}`);
      if (!key) return new Response(null, { status: 404 });
      await this.storage.delete([key, `i:${body.id}`]);
      return new Response(null, { status: 204 });
    }

    return new Response(null, { status: 404 });
  }

  async list(now) {
    const rows = await this.storage.list({ prefix: 'm:', reverse: true, limit: KEEP });
    const out = [];
    for (const m of rows.values()) if (m.exp > now) out.push({ id: m.id, text: m.text, at: m.at });
    return out;
  }

  /* the alarm wakes at the earliest moment something can be forgotten */
  async schedule(t) {
    if (!t) return;
    const cur = await this.storage.getAlarm();
    if (cur === null || t < cur) await this.storage.setAlarm(t);
  }

  async alarm() {
    const now = Date.now();
    let next = 0;
    const gone = [];
    const lines = await this.storage.list({ prefix: 'm:' });
    for (const [key, m] of lines) {
      if (m.exp <= now) gone.push(key, `i:${m.id}`);
      else { next = next ? Math.min(next, m.exp) : m.exp; }
    }
    const rates = await this.storage.list({ prefix: 'r:' });
    for (const [key, rec] of rates) {
      const t = expiresAt(rec, RULE);
      if (t <= now) gone.push(key); else next = next ? Math.min(next, t) : t;
    }
    for (let i = 0; i < gone.length; i += 128) await this.storage.delete(gone.slice(i, i + 128));
    if (next) await this.storage.setAlarm(next);
  }
}
