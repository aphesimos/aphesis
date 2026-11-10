/* Board: one Durable Object for the whole board. It keeps the index of threads (newest activity first, at most
   BOARD_LIMIT), the rate-limit buckets (keyed by action and IP hash), and the list of reports for the admin.
   Buckets that have refilled are forgotten by an hourly alarm, so nothing about a visitor outlives their activity. */

import { take, isFull } from './ratelimit.js';

const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json' } });
const HOUR = 3600e3;

export class Board {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; this.storage = ctx.storage; }

  async index() { return (await this.storage.get('index')) || []; }

  async fetch(request) {
    const url = new URL(request.url);
    const body = request.method === 'POST' ? await request.json() : null;
    const now = Date.now();
    switch (url.pathname) {
      case '/list': {
        const threads = (await this.index()).map((t) => ({
          id: t.id, first: t.first, replies: t.replies, created: t.created, bumped: t.bumped,
          image: t.image ? { density: '/api/images/' + t.image.density, original: '/api/images/' + t.image.original, w: t.image.w, h: t.image.h, caption: 'a picture, posted here' } : null,
        }));
        return json({ threads });
      }
      case '/touch': {
        /* a thread was made or answered: move it to the top; return the ids that fell off the end */
        let idx = (await this.index()).filter((t) => t.id !== body.id);
        const prev = (await this.index()).find((t) => t.id === body.id) || {};
        idx.unshift(Object.assign(prev, body.entry));
        const limit = +this.env.BOARD_LIMIT || 120;
        const dropped = idx.slice(limit).map((t) => t.id);
        idx = idx.slice(0, limit);
        await this.storage.put('index', idx);
        return json({ dropped });
      }
      case '/drop': {
        await this.storage.put('index', (await this.index()).filter((t) => t.id !== body.id));
        return json({ ok: true });
      }
      case '/limit': {
        const k = 'rl:' + body.key, opts = { limit: body.limit, windowMs: body.windowMs };
        const r = take(await this.storage.get(k), now, opts);
        await this.storage.put(k, r.bucket);
        if (!(await this.storage.getAlarm())) await this.storage.setAlarm(now + HOUR);
        return json({ allowed: r.allowed, retryAfter: r.retryAfter });
      }
      case '/report': {
        const reports = (await this.storage.get('reports')) || [];
        const i = reports.findIndex((r) => r.thread === body.thread && r.n === body.n);
        if (i >= 0) { reports[i].count++; reports[i].at = now; } else reports.unshift({ thread: body.thread, n: body.n, count: 1, at: now });
        await this.storage.put('reports', reports.slice(0, 500));
        return json({ ok: true });
      }
      case '/reports':
        return json({ reports: (await this.storage.get('reports')) || [] });
      case '/resolve': {
        const reports = ((await this.storage.get('reports')) || []).filter((r) => !(r.thread === body.thread && (body.n === 1 || r.n === body.n)));
        await this.storage.put('reports', reports);
        return json({ ok: true });
      }
      default:
        return json({ error: 'not found' }, 404);
    }
  }

  /* forget buckets that have refilled; come back in an hour while any remain */
  async alarm() {
    const now = Date.now(), win = (+this.env.RATE_WINDOW_SECONDS || 120) * 1000;
    const all = await this.storage.list({ prefix: 'rl:' });
    const gone = [];
    for (const [k, b] of all) {
      const limit = k.startsWith('rl:thread:') ? +this.env.RATE_THREADS || 1 : k.startsWith('rl:report:') ? 10 : +this.env.RATE_POSTS || 4;
      if (isFull(b, now, { limit, windowMs: win })) gone.push(k);
    }
    if (gone.length) await this.storage.delete(gone.slice(0, 128));
    if (all.size > gone.length || gone.length > 128) await this.storage.setAlarm(now + HOUR);
  }
}
