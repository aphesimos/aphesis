/* memory: how far along the journey a visitor is, kept in this browser only.
   { next: 0..8 } is the next chamber the door opens. When the ending has played, the record is cleared and the
   visitor is sent home; coming back, the door opens on the first chamber again. A journey left half-way is taken up
   where it was left. Without storage (blocked, private) the journey is kept for this visit.

   The door is never sealed any more. Older records are migrated on load: anything that is not a plain
   { next } inside the journey (a record that marks it sealed, closed or done, a step past the end, the first
   version's list of found chambers) is cleared, so a returning visitor finds the door openable. */

const KEY = 'aphesis.experimental.journey';
const OLD = ['aphesis.experimental.found', 'aphesis.experimental.sealed'];
let mem = 0;

export function migrate(count) {
  try {
    OLD.forEach((k) => localStorage.removeItem(k));
    const raw = localStorage.getItem(KEY);
    if (raw === null) return;
    const v = JSON.parse(raw);
    const plain = v && typeof v === 'object' && Object.keys(v).length === 1 && Number.isInteger(v.next) && v.next >= 0 && v.next < count;
    if (!plain) localStorage.removeItem(KEY);
  } catch (_) {
    try { localStorage.removeItem(KEY); } catch (_e) { /* storage blocked: nothing to migrate */ }
  }
}

export function nextStep(count) {
  migrate(count);
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
