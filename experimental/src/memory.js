/* memory: the chambers a visitor has found, kept in this browser only. Never listed on the page. */

const KEY = 'aphesis.experimental.found';

export function found() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch (_) { return []; }
}

export function remember(id) {
  const list = found();
  if (list.includes(id)) return list;
  list.push(id);
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (_) { /* storage blocked: the visit simply is not remembered */ }
  return list;
}

export function wasFound(id) { return found().includes(id); }
