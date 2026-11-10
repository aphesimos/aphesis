/* forum · ἀγορά: the Worker. Routes, CORS for the site's origin, Turnstile, rate limits per IP hash, upload checks,
   R2 for pictures (the original and its density map), reports, and removal behind the admin secret.

   GET    /api/board[?cursor=&limit=]         a page of threads, newest activity first, and the next page's cursor
   GET    /api/threads/:id                    one thread, its posts in order
   POST   /api/threads                        a new thread   (multipart: text, image?, density?, w?, h?, turnstile?)
   POST   /api/threads/:id/posts              a reply        (the same fields)
   POST   /api/threads/:id/posts/:n/report    report a post
   GET    /api/images/t/:id/:file             a picture from R2
   GET    /api/admin/reports                  reports        (Authorization: Bearer ADMIN_SECRET)
   DELETE /api/threads/:id/posts/:n           remove a post; post 1 removes the thread (admin)

   Bindings: THREADS, BOARD (Durable Objects), IMAGES (R2). Secrets: IP_SALT, POSTER_SALT, TURNSTILE_SECRET,
   ADMIN_SECRET. Vars: ALLOWED_ORIGINS, RATE_POSTS, RATE_THREADS, RATE_WINDOW_SECONDS.

   The board is permanent: no thread, post or picture is ever deleted on its own. Only the admin's
   DELETE /api/threads/:id/posts/:n removes anything; reports only count. */

import { Thread } from './thread.js';
import { Board, cursorKey } from './board.js';
import { checkText, checkOriginal, checkDensity, EXT, LIMITS } from './validate.js';
import { ipHash, posterToken, randomId, sameSecret } from './crypto.js';
import { verifyTurnstile } from './turnstile.js';

export { Thread, Board };

const MAX_BODY = 6 * 1024 * 1024;   /* the 4 MB original, the 900 KB density map and the form */
const ID = /^[a-z2-9]{10}$/;

/* ---------- http ---------- */
function origins(env) { return String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean); }
function cors(request, env) {
  const o = request.headers.get('Origin');
  const h = { Vary: 'Origin' };
  if (o && origins(env).includes(o)) {
    h['Access-Control-Allow-Origin'] = o;
    h['Access-Control-Allow-Methods'] = 'GET, POST, DELETE, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    h['Access-Control-Max-Age'] = '86400';
  }
  return h;
}
function json(request, env, v, status = 200, extra = {}) {
  return new Response(JSON.stringify(v), {
    status, headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }, cors(request, env), extra),
  });
}
const fail = (request, env, status, error, extra) => json(request, env, { error }, status, extra);

/* ---------- objects ---------- */
async function call(stub, path, body) {
  const r = await stub.fetch('https://do' + path, body === undefined ? {} : { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
  return { status: r.status, body: await r.json() };
}
const boardOf = (env) => env.BOARD.get(env.BOARD.idFromName('board'));
const threadOf = (env, id) => env.THREADS.get(env.THREADS.idFromName(id));

function isAdmin(request, env) {
  const h = request.headers.get('Authorization') || '';
  return !!env.ADMIN_SECRET && sameSecret(h.replace(/^Bearer\s+/i, ''), env.ADMIN_SECRET);
}

async function limited(env, kind, ipH) {
  const windowMs = (+env.RATE_WINDOW_SECONDS || 120) * 1000;
  const limit = kind === 'thread' ? +env.RATE_THREADS || 1 : kind === 'report' ? 10 : +env.RATE_POSTS || 4;
  const r = await call(boardOf(env), '/limit', { key: kind + ':' + ipH, limit, windowMs });
  return r.body.allowed ? 0 : Math.max(1, r.body.retryAfter);
}

/* ---------- posting ---------- */
async function bytesOf(v) { return v && typeof v === 'object' && 'arrayBuffer' in v ? new Uint8Array(await v.arrayBuffer()) : null; }

async function handlePost(request, env, threadId) {
  const len = +request.headers.get('content-length') || 0;
  if (len > MAX_BODY) return fail(request, env, 413, 'too large');
  const o = request.headers.get('Origin');
  if (o && !origins(env).includes(o)) return fail(request, env, 403, 'not from this site');
  const ipH = await ipHash(request.headers.get('CF-Connecting-IP'), env.IP_SALT);
  const wait = await limited(env, threadId ? 'post' : 'thread', ipH);
  if (wait) return fail(request, env, 429, 'slowly: try again in ' + wait + ' s', { 'Retry-After': String(wait) });

  let form;
  try { form = await request.formData(); } catch (_) { return fail(request, env, 400, 'unreadable form'); }
  const ts = await verifyTurnstile(form.get('turnstile'), env.TURNSTILE_SECRET);
  if (!ts.ok) return fail(request, env, 403, 'the check did not pass');

  const orig = await bytesOf(form.get('image'));
  const dens = await bytesOf(form.get('density'));
  const text = checkText(form.get('text'), { required: !threadId || !orig });
  if (!text.ok) return fail(request, env, 400, text.error);

  let image = null;
  if (orig) {
    const a = checkOriginal(orig);
    if (!a.ok) return fail(request, env, 400, a.error);
    const d = checkDensity(dens);
    if (!d.ok) return fail(request, env, 400, d.error);
    image = { a, d };
  } else if (dens) return fail(request, env, 400, 'a density map needs its original');

  const id = threadId || randomId(10);
  const thread = threadOf(env, id);
  if (threadId) {
    const t = await call(thread, '/get');
    if (t.status !== 200) return fail(request, env, 404, 'this thread is gone');
  }

  const post = { poster: await posterToken(env.POSTER_SALT, id, ipH), text: text.text, created: Date.now() };
  const keys = [];
  if (image) {
    const base = 't/' + id + '/' + randomId(12);
    const ko = base + '.' + EXT[image.a.type], kd = base + '.density.' + EXT[image.d.type];
    await env.IMAGES.put(ko, orig, { httpMetadata: { contentType: image.a.type } });
    await env.IMAGES.put(kd, dens, { httpMetadata: { contentType: image.d.type } });
    keys.push(ko, kd);
    post.image = { original: ko, density: kd, w: image.d.width, h: image.d.height };
  }

  const r = await call(thread, threadId ? '/post' : '/create', threadId ? { post } : { id, post });
  if (r.status !== 200) {
    if (keys.length) await env.IMAGES.delete(keys);
    return fail(request, env, r.status, r.body.error || 'not posted');
  }
  const entry = threadId
    ? { id, bumped: post.created, replies: r.body.summary.replies, first: r.body.summary.first, image: r.body.summary.firstImage }
    : { id, created: post.created, bumped: post.created, replies: 0, first: post.text, image: post.image || null };
  await call(boardOf(env), '/touch', { id, entry });
  return json(request, env, { thread: id, n: r.body.n }, 201);
}

/* ---------- the router ---------- */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const parts = url.pathname.replace(/\/+$/, '').split('/').slice(1);   /* ['api', ...] */
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request, env) });
    if (parts[0] !== 'api') return fail(request, env, 404, 'not found');
    const [, a, b, c, d, e] = parts;
    try {
      if (request.method === 'GET' && a === 'board' && !b) {
        const cursor = url.searchParams.get('cursor') || '';
        if (cursor && !cursorKey(cursor)) return fail(request, env, 400, 'bad cursor');
        const q = new URLSearchParams();
        if (cursor) q.set('cursor', cursor);
        if (url.searchParams.has('limit')) q.set('limit', url.searchParams.get('limit'));
        const r = await call(boardOf(env), '/list' + (q.size ? '?' + q : ''));
        /* the density maps this Worker takes, so the page prepares them to fit */
        const body = Object.assign({}, r.body, { density: { long: LIMITS.densityLong, bytes: LIMITS.density } });
        return json(request, env, body, 200, { 'cache-control': 'public, max-age=5' });
      }
      if (a === 'threads' && b && !ID.test(b)) return fail(request, env, 404, 'this thread is gone');
      if (request.method === 'GET' && a === 'threads' && b && !c) {
        const r = await call(threadOf(env, b), '/get');
        return json(request, env, r.body, r.status);
      }
      if (request.method === 'POST' && a === 'threads' && !b) return handlePost(request, env, null);
      if (request.method === 'POST' && a === 'threads' && c === 'posts' && !d) return handlePost(request, env, b);
      if (request.method === 'POST' && a === 'threads' && c === 'posts' && /^\d{1,6}$/.test(d || '') && e === 'report') {
        const ipH = await ipHash(request.headers.get('CF-Connecting-IP'), env.IP_SALT);
        const wait = await limited(env, 'report', ipH);
        if (wait) return fail(request, env, 429, 'slowly', { 'Retry-After': String(wait) });
        const r = await call(threadOf(env, b), '/report', { n: +d });
        if (r.status !== 200) return fail(request, env, r.status, r.body.error);
        await call(boardOf(env), '/report', { thread: b, n: +d });
        return json(request, env, { ok: true });
      }
      if (request.method === 'DELETE' && a === 'threads' && c === 'posts' && /^\d{1,6}$/.test(d || '')) {
        if (!isAdmin(request, env)) return fail(request, env, 403, 'not allowed');
        const r = await call(threadOf(env, b), '/remove', { n: +d });
        if (r.status !== 200) return fail(request, env, r.status, r.body.error);
        if (r.body.keys.length) await env.IMAGES.delete(r.body.keys);
        if (r.body.gone) await call(boardOf(env), '/drop', { id: b });
        await call(boardOf(env), '/resolve', { thread: b, n: +d });
        return json(request, env, { ok: true, thread: r.body.gone ? 'removed' : 'kept' });
      }
      if (request.method === 'GET' && a === 'admin' && b === 'reports') {
        if (!isAdmin(request, env)) return fail(request, env, 403, 'not allowed');
        const r = await call(boardOf(env), '/reports');
        return json(request, env, r.body);
      }
      if (request.method === 'GET' && a === 'images' && b === 't' && c && ID.test(c) && /^[a-z2-9]{12}(\.density)?\.(jpg|png|gif|webp)$/.test(d || '') && !e) {
        const obj = await env.IMAGES.get('t/' + c + '/' + d);
        if (!obj) return fail(request, env, 404, 'no such picture');
        return new Response(obj.body, {
          headers: Object.assign({
            'content-type': (obj.httpMetadata && obj.httpMetadata.contentType) || 'application/octet-stream',
            'cache-control': 'public, max-age=31536000, immutable',
            'x-content-type-options': 'nosniff',
            'content-security-policy': "default-src 'none'; sandbox",
            'content-disposition': 'inline',
            'cross-origin-resource-policy': 'cross-origin',
          }, cors(request, env)),
        });
      }
      return fail(request, env, 404, 'not found');
    } catch (err) {
      return fail(request, env, 500, 'the board stumbled');
    }
  },
};
