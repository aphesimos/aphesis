/* store: this browser's storage, wrapped so a blocked or full storage never breaks the page.
   Without storage (private window, blocked site data, a preview) values live in memory for this visit. */

const mem = new Map();

export function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    if (v !== null) return JSON.parse(v);
  } catch (_) { /* storage blocked or unreadable */ }
  return mem.has(key) ? mem.get(key) : fallback;
}

/* returns true when the value reached storage, false when it is kept in memory only */
export function save(key, value) {
  mem.set(key, value);
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; }
}
