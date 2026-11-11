/* api: where the board lives. With an API base URL configured, the Cloudflare Worker in forum/worker answers;
   without one (the artifact preview, a local file) the local mock in mock.js does, and says so.

   Configure with <meta name="forum-api" content="https://forum-api.aphes.ist"> and, when Turnstile is on,
   <meta name="forum-turnstile" content="SITE KEY">, or with window.AphesisForum = {api, turnstile} before the script.

   Every client answers:
     board(cursor?)                  -> {threads: [{id, first, replies, created, bumped, image?, owner?}], next}
                                        one page, newest activity first; next is the cursor of the page after it,
                                        null at the end. The board keeps every thread, so pages go back to the first.
     thread(id)                      -> {id, created, posts: [{n, poster, text, created, owner?, image?, removed?, reported?}]}
                                        owner: true only for the owner's posts (the server says so; the mock has none)
     post({thread?, text, image?, turnstile?}) -> {thread, n}   image: {original: File, density: {blob, url, width, height}}
     report(thread, n)               -> {ok}
     densityLimits()                 -> {long, bytes}: the density maps the board takes (640 px from an older Worker)
     limits()                        -> {request, original: {bytes, pixels}, density: {long, bytes}, text: {chars, lines}}
   image (as returned): {density: URL, original: URL | null, caption, w, h}
   A refusal rejects with an Error carrying its code (refusal.js): the Worker's own, or `network` when the board could
   not be reached at all. */

import { createMock } from './mock.js';
import { fromAnswer, refusal, boardLimits } from './refusal.js';

function config() {
  const meta = (n) => { const m = document.querySelector('meta[name="' + n + '"]'); return m ? m.content.trim() : ''; };
  const w = window.AphesisForum || {};
  return { api: (w.api || meta('forum-api') || '').replace(/\/+$/, ''), turnstile: w.turnstile || meta('forum-turnstile') || '' };
}

async function json(res) {
  let body = null;
  try { body = await res.json(); } catch (_) { /* not json */ }
  if (!res.ok) throw fromAnswer(res.status, body || { error: 'the board did not answer' });
  return body;
}

/* fetch, with a board that cannot be reached (offline, refused on the way, an answer the browser may not read)
   said as such */
async function call(url, init) {
  try { return await fetch(url, init); } catch (e) { throw refusal('network', { cause: e }, 'the board could not be reached'); }
}

/* the density map's limits: what a Worker says it takes on its board's pages ({density: {long, bytes}}); a Worker
   that says nothing (one from before the limit was raised) takes 640 px and 400 KB */
export const OLD_LIMITS = { long: 640, bytes: 400 * 1024 };
function readLimits(b) {
  const d = b && b.density;
  return d && +d.long >= 480 && +d.bytes >= 100 * 1024 ? { long: Math.min(+d.long, 2048), bytes: +d.bytes } : OLD_LIMITS;
}

function createRemote(base, turnstile) {
  let limits = null, all = null;
  const abs = (u) => (u && !/^(https?:|data:|blob:)/.test(u) ? base + u : u);
  const fixImage = (im) => (im ? Object.assign({}, im, { density: abs(im.density), original: abs(im.original) }) : null);
  return {
    preview: false,
    turnstile,
    persisted: true,
    async board(cursor) {
      const b = await json(await call(base + '/api/board' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : '')));
      b.threads.forEach((t) => { t.image = fixImage(t.image); });
      limits = readLimits(b);
      all = Object.assign(boardLimits(b.limits), { density: limits });
      /* a Worker from before pages answers threads alone: one page, the last */
      return { threads: b.threads, next: b.next || null };
    },
    /* the limits, asked once of the board (one thread is enough) when the page opened on a thread */
    async densityLimits() {
      if (!limits) {
        try { const b = await json(await call(base + '/api/board?limit=1')); limits = readLimits(b); all = Object.assign(boardLimits(b.limits), { density: limits }); } catch (_) { return OLD_LIMITS; }
      }
      return limits;
    },
    /* every limit the board says (the current backend's for any it leaves out; the old map size from an old Worker) */
    async limits() {
      if (!all) await this.densityLimits();
      return all || Object.assign(boardLimits(null), { density: OLD_LIMITS });
    },
    async thread(id) {
      const t = await json(await call(base + '/api/threads/' + encodeURIComponent(id)));
      t.posts.forEach((p) => { p.image = fixImage(p.image); });
      return t;
    },
    async post({ thread, text, image, turnstile: token }) {
      const f = new FormData();
      f.append('text', text);
      if (token) f.append('turnstile', token);
      if (image) {
        f.append('image', image.original, 'original');
        f.append('density', image.density.blob, 'density.jpg');
        f.append('w', String(image.density.width));
        f.append('h', String(image.density.height));
      }
      const url = thread ? base + '/api/threads/' + encodeURIComponent(thread) + '/posts' : base + '/api/threads';
      return json(await call(url, { method: 'POST', body: f }));
    },
    async report(thread, n) {
      return json(await call(base + '/api/threads/' + encodeURIComponent(thread) + '/posts/' + n + '/report', { method: 'POST' }));
    },
  };
}

export function createApi() {
  const c = config();
  return c.api ? createRemote(c.api, c.turnstile) : createMock();
}
