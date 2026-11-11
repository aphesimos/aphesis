/* mock: the board as it stands in the preview, with no server, for working on the section. It starts empty, as a
   new board does, and holds only what is posted here, kept in this browser (localStorage, wrapped: blocked storage
   keeps it for the visit). It answers the same calls as the server client in api.js, with the same shapes: the board
   a page at a time, newest activity first, with a cursor to the next page, and every thread kept, so pages go back
   to the first. */

import { load, save } from './store.js';
import { hex } from './hash.js';

const KEY = 'aphesis.forum.preview.v1';
const PAGE = 40;

/* ---------- what this browser posted ---------- */
let state = null;
function local() {
  if (!state) {
    const v = load(KEY, null);
    state = v && typeof v === 'object' ? v : {};
    state.threads = state.threads || {};      /* id -> thread posted here */
    state.reports = state.reports || [];
    if (!state.device) state.device = hex(Math.random() + ':' + Date.now(), 16);
  }
  return state;
}
let persisted = true;
const keep = () => { persisted = save(KEY, state); };
const originals = new Map();   /* originals too large to keep, for this visit only */

const all = () => Object.values(local().threads);

const wait = (v) => new Promise((resolve) => setTimeout(() => resolve(v), 80));

function readAsDataURL(blob) {
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(blob); });
}

export function createMock() {
  return {
    preview: true,
    turnstile: '',
    get persisted() { return persisted; },
    /* the same limits as the Worker */
    densityLimits() { return Promise.resolve({ long: 960, bytes: 900 * 1024 }); },
    /* one page below cursor ("<bumped>-<id>", the last thread of the page before), newest activity first */
    board(cursor) {
      const sorted = all().map((t) => {
        const live = t.posts.filter((p) => !p.removed);
        const op = t.posts[0];
        return {
          id: t.id, created: t.created,
          bumped: Math.max(...live.map((p) => p.created)),
          replies: live.length - 1, first: op.text, image: op.image || null,
        };
      }).sort((a, b) => b.bumped - a.bumped || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
      let from = 0;
      if (cursor) {
        const i = String(cursor).indexOf('-'), cb = +String(cursor).slice(0, i), cid = String(cursor).slice(i + 1);
        if (i < 1 || !Number.isFinite(cb)) return Promise.reject(Object.assign(new Error('bad cursor'), { status: 400 }));
        from = sorted.findIndex((t) => t.bumped < cb || (t.bumped === cb && t.id < cid));
        if (from < 0) from = sorted.length;
      }
      const threads = sorted.slice(from, from + PAGE);
      const last = threads[threads.length - 1];
      const next = from + PAGE < sorted.length && last ? last.bumped + '-' + last.id : null;
      return wait({ threads, next });
    },
    thread(id) {
      const t = all().find((x) => x.id === id);
      if (!t) return Promise.reject(Object.assign(new Error('this thread is gone'), { status: 404 }));
      const reported = local().reports;
      t.posts.forEach((p) => {
        if (p.image && p.image.originalKey) p.image.original = originals.get(p.image.originalKey) || null;
        p.reported = reported.includes(t.id + '/' + p.n);
      });
      return wait(t);
    },
    async post({ thread, text, image }) {
      const s = local(), now = Date.now();
      const id = thread || hex('t:' + s.device + now, 10);
      const post = { poster: hex(s.device + ':' + id, 12), text, created: now, image: null };
      if (image) {
        post.image = { density: image.density.url, caption: 'a picture, posted here', w: image.density.width, h: image.density.height };
        if (image.original.size <= 600 * 1024) post.image.original = await readAsDataURL(image.original);
        else {
          const k = hex(id + now, 12);
          originals.set(k, URL.createObjectURL(image.original));
          post.image.originalKey = k;
        }
      }
      let n = 1;
      if (!thread) {
        s.threads[id] = { id, created: now, posts: [Object.assign({ n: 1 }, post)] };
      } else if (s.threads[thread]) {
        n = s.threads[thread].posts.length + 1;
        s.threads[thread].posts.push(Object.assign({ n }, post));
      } else {
        throw Object.assign(new Error('this thread is gone'), { status: 404 });
      }
      keep();
      if (!persisted && post.image && post.image.original && post.image.original.length > 200000) {
        /* storage full: drop the original from storage, keep it for the visit */
        const k = hex(id + now + 'o', 12); originals.set(k, post.image.original);
        delete post.image.original; post.image.originalKey = k; keep();
      }
      return wait({ thread: id, n });
    },
    report(thread, n) {
      const s = local(), k = thread + '/' + n;
      if (!s.reports.includes(k)) { s.reports.push(k); keep(); }
      return wait({ ok: true });
    },
  };
}
