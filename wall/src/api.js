/* api: the wall's lines, from the Worker when one is configured, otherwise from a local preview.

   The base URL comes from <meta name="aphesis:wall-api" content="https://..."> (build.py --api) or
   window.APHESIS_WALL_API. Without one the wall is a preview for local work: it starts empty, as a new wall does,
   and holds only what this visitor writes, kept in this browser's local storage. The preview runs the same filter
   and a gentle limit, so it behaves like the real wall without pretending to be it.

   createApi() -> { live, sitekey, list(), post(text, token) }
   list() -> [{ id, text, at, owner?, mine? }]   owner: true only for the owner's lines (the server says so)
   post() -> { ok: true, message } | { ok: false, reason: 'empty'|'long'|'word'|'link'|'rate'|'turnstile'|'unavailable'|'stumbled'|'offline', retryAfter? }
   (offline: the wall could not be reached at all) */

import { check } from './filter.js';

const meta = (name) => {
  const el = document.querySelector(`meta[name="${name}"]`);
  return (el && el.content.trim()) || '';
};

const KEY = 'aphesis.wall.mine';
const GAP = 20 * 1000; /* the preview's limit: one line every 20 s */
const KEEP_DAYS = 30;

function readMine() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(v)) return [];
    const now = Date.now();
    return v.filter((m) => m && typeof m.text === 'string' && typeof m.at === 'number' && now - m.at < KEEP_DAYS * 864e5);
  } catch (_) { return []; }
}
function writeMine(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(-50))); return true; } catch (_) { return false; }
}

function mock() {
  let memory = readMine(); /* without storage, kept for this visit */
  return {
    live: false,
    sitekey: '',
    async list() {
      const mine = readMine();
      if (mine.length) memory = mine;
      return memory.slice().reverse().map((m) => Object.assign({ mine: true }, m));
    },
    async post(text) {
      const v = check(text);
      if (!v.ok) return { ok: false, reason: v.reason };
      const last = memory.length ? memory[memory.length - 1].at : 0;
      const now = Date.now();
      if (now - last < GAP) return { ok: false, reason: 'rate', retryAfter: Math.ceil((last + GAP - now) / 1000) };
      const message = { id: 'local-' + now.toString(36), text: v.text, at: now };
      memory = memory.concat([message]);
      writeMine(memory);
      return { ok: true, message: Object.assign({ mine: true }, message) };
    },
  };
}

function remote(base, sitekey) {
  const url = base.replace(/\/+$/, '') + '/messages';
  return {
    live: true,
    sitekey,
    async list() {
      try {
        const r = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!r.ok) return [];
        const { messages } = await r.json();
        return Array.isArray(messages) ? messages.filter((m) => m && typeof m.text === 'string') : [];
      } catch (_) { return []; }
    },
    async post(text, token) {
      const v = check(text);
      if (!v.ok) return { ok: false, reason: v.reason };
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: v.text, token: token || '' }),
        });
        const body = await r.json().catch(() => ({}));
        if (r.ok && body.message) return { ok: true, message: Object.assign({ mine: true }, body.message) };
        /* an answer without its word: the wall's own stumble when it is a 5xx, else a line it could not read */
        const reason = body.error || (r.status >= 500 ? 'stumbled' : r.status === 429 ? 'rate' : 'bad');
        return { ok: false, reason, retryAfter: body.retryAfter || +r.headers.get('Retry-After') || undefined };
      } catch (_) { return { ok: false, reason: 'offline' }; }
    },
  };
}

export function createApi() {
  const base = meta('aphesis:wall-api') || (typeof window.APHESIS_WALL_API === 'string' ? window.APHESIS_WALL_API : '');
  const sitekey = meta('aphesis:turnstile') || (typeof window.APHESIS_TURNSTILE === 'string' ? window.APHESIS_TURNSTILE : '');
  return base ? remote(base, sitekey) : mock();
}
