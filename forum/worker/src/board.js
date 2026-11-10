/* Board: one Durable Object for the whole board. It keeps the index of every thread (newest activity first, read a
   page at a time), the rate-limit buckets (keyed by action and IP hash), and the list of reports for the admin.
   Buckets that have refilled are forgotten by an hourly alarm, so nothing about a visitor outlives their activity.

   The board is permanent: nothing here deletes a thread on its own. A thread leaves the index only when the admin
   removes its opening post (/drop). Each thread is its own key, t:<id>, and its place in the order another,
   o:<bumped>-<seq> (both zero-padded, so keys sort as the board does); seq grows with every touch and is never given
   twice. A page lists the order keys below the cursor (the "<bumped>-<seq>" of the last thread of the page before). */

import { take, isFull } from './ratelimit.js';

const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json' } });
const HOUR = 3600e3;
export const PAGE_DEFAULT = 40, PAGE_MAX = 100;
const pad = (n, w) => String(n).padStart(w, '0');
const orderKey = (bumped, seq) => 'o:' + pad(bumped, 15) + '-' + pad(seq, 12);
/* "<bumped>-<seq>" -> the order key it stands for, or null when it is not one */
export function cursorKey(c) {
  const m = /^(\d{1,15})-(\d{1,15})$/.exec(c || '');
  return m ? orderKey(+m[1], +m[2]) : null;
}
const publicImage = (i) => (i ? { density: '/api/images/' + i.density, original: '/api/images/' + i.original, w: i.w, h: i.h, caption: 'a picture, posted here' } : null);

export class Board {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; this.storage = ctx.storage; }

  /* the index as the first version kept it (one array, at most BOARD_LIMIT) becomes a key per thread, once */
  async upgrade() {
    if (this.upgraded) return;
    const idx = await this.storage.get('index');
    if (idx) {
      let seq = (await this.storage.get('seq')) || 0;
      const puts = {};
      for (const t of idx.slice().reverse()) { seq++; puts['t:' + t.id] = Object.assign({}, t, { seq }); puts[orderKey(t.bumped, seq)] = t.id; }
      puts.seq = seq;
      await this.storage.put(puts);
      await this.storage.delete('index');
    }
    this.upgraded = true;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const body = request.method === 'POST' ? await request.json() : null;
    const now = Date.now();
    await this.upgrade();
    switch (url.pathname) {
      case '/list': {
        /* one page below the cursor (the top without one), newest activity first, and the next page's cursor */
        const limit = Math.min(PAGE_MAX, Math.max(1, Math.floor(+url.searchParams.get('limit')) || PAGE_DEFAULT));
        const end = cursorKey(url.searchParams.get('cursor'));
        const opts = { prefix: 'o:', reverse: true, limit: limit + 1 };
        if (end) opts.end = end;
        const ids = [...(await this.storage.list(opts)).values()];
        const more = ids.length > limit;
        const page = ids.slice(0, limit);
        const got = page.length ? await this.storage.get(page.map((id) => 't:' + id)) : new Map();
        const rows = page.map((id) => got.get('t:' + id)).filter(Boolean);
        const threads = rows.map((t) => ({ id: t.id, first: t.first, replies: t.replies, created: t.created, bumped: t.bumped, image: publicImage(t.image) }));
        const last = rows[rows.length - 1];
        return json({ threads, next: more && last ? last.bumped + '-' + last.seq : null });
      }
      case '/touch': {
        /* a thread was made or answered: move it to the top. Every thread stays; none falls off the end */
        const prev = (await this.storage.get('t:' + body.id)) || null;
        const seq = ((await this.storage.get('seq')) || 0) + 1;
        const t = Object.assign({ id: body.id }, prev || {}, body.entry, { seq });
        if (prev && prev.created && !body.entry.created) t.created = prev.created;
        if (prev) await this.storage.delete(orderKey(prev.bumped, prev.seq));
        await this.storage.put({ seq, ['t:' + body.id]: t, [orderKey(t.bumped, seq)]: body.id });
        return json({ ok: true });
      }
      case '/drop': {
        /* the admin removed the thread's opening post: the only way a thread leaves the index */
        const prev = await this.storage.get('t:' + body.id);
        if (prev) await this.storage.delete(['t:' + body.id, orderKey(prev.bumped, prev.seq)]);
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

  /* forget buckets that have refilled; come back in an hour while any remain. Buckets only: no thread, post, report
     or picture is ever touched here */
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
