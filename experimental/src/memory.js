/* memory: how far along the journey a visitor is, kept in this browser only.
   { next: 0..4 } is the next chamber the door opens. When the ending has played, the record is cleared, so the
   next visit starts over at the first chamber. Without storage (blocked, private) the journey is kept for this visit. */

const KEY = 'aphesis.experimental.journey';
let mem = 0;

export function nextStep(count) {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (v && Number.isInteger(v.next) && v.next >= 0 && v.next < count) return v.next;
    if (v === null) return mem;
  } catch (_) { return mem; }
  return 0;
}

export function saveStep(n) {
  mem = n;
  try { localStorage.setItem(KEY, JSON.stringify({ next: n })); } catch (_) { /* storage blocked: kept for this visit */ }
}

export function clearSteps() {
  mem = 0;
  try { localStorage.removeItem(KEY); } catch (_) { /* nothing to clear */ }
}
