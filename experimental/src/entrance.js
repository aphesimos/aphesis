/* the tenth door: a hidden entrance. On the door screen, a full circle drawn around the door (the pointer or a
   finger travelling around its outline, roughly 360°, in either direction) does not open the chamber: it announces
   the entrance and does nothing else on this page:
     window.dispatchEvent(new CustomEvent('aph:entrance', { detail: { via: 'door' } }))
   Whoever owns what lies behind it listens for that event. A wrong or partial attempt shows nothing.

   The measure is the angle swept around the door's centre, as the ouroboros counts its turns: each pointer
   position inside a ring around the door (from just outside the doorway to about one and a half doors away) is an
   angle, and the change from one position to the next is added with its sign. A dropped or coalesced stretch counts
   as the shorter way across it; a step of more than 135° (a jump), leaving the ring, a pause of more than a second,
   or turning back by more than about 50° starts over. Coalesced events are read where the browser offers them, so a
   quick circle on a phone is measured as finely as a slow one with a mouse. A mouse counts while it only hovers; a
   finger or pen while it presses.

   Clicks and taps still open the door. A press that travels (a circle drawn with a finger that began on the door)
   is not a tap, and the click that follows the entrance is swallowed, so the gesture never also opens the door. */

const TAU = Math.PI * 2;
const FULL = TAU * 0.94, JUMP = Math.PI * 0.75, BACK = 0.9, PAUSE = 1000, LONGEST = 15000;

export function createEntrance(el, isOpen) {
  let sum = 0, peak = 0, last = null, t0 = 0, firedAt = -1e9;
  let press = null;   /* { id, x, y, travel, onDoor } while a pointer is down */

  function reset() { sum = 0; peak = 0; last = null; }
  function fire(t) {
    firedAt = t;
    reset();
    window.dispatchEvent(new CustomEvent('aph:entrance', { detail: { via: 'door' } }));
  }
  function add(x, y, t) {
    if (!isOpen()) { reset(); return; }
    const r = el.getBoundingClientRect();
    if (!r.width) { reset(); return; }
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2, s = r.width;
    const dx = x - cx, dy = y - cy, d0 = Math.hypot(dx, dy);
    if (d0 < s * 0.3 || d0 > s * 1.6) { reset(); return; }
    const a = Math.atan2(dy, dx);
    if (!last || t - last.t > PAUSE) { reset(); last = { a, t }; t0 = t; return; }
    let d = a - last.a;
    d = ((d + Math.PI) % TAU + TAU) % TAU - Math.PI;
    last = { a, t };
    if (Math.abs(d) > JUMP) { sum = 0; peak = 0; t0 = t; return; }
    sum += d;
    if (Math.abs(sum) > Math.abs(peak) && (peak === 0 || Math.sign(sum) === Math.sign(peak))) peak = sum;
    if ((peak !== 0 && Math.sign(sum) !== Math.sign(peak) && Math.abs(sum) > 0.05) || Math.abs(peak) - Math.abs(sum) > BACK || t - t0 > LONGEST) {
      sum = d; peak = d; t0 = t; return;
    }
    if (Math.abs(sum) >= FULL && t - firedAt > 1500) fire(t);
  }

  const move = (e) => {
    const list = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    const pts = list.length ? list : [e];
    if (press && e.pointerId === press.id) {
      pts.forEach((c) => { press.travel += Math.hypot(c.clientX - press.x, c.clientY - press.y); press.x = c.clientX; press.y = c.clientY; });
    }
    if (e.pointerType !== 'mouse' && !(press && e.pointerId === press.id)) return;   /* a finger or pen counts while it presses */
    pts.forEach((c) => add(c.clientX, c.clientY, c.timeStamp || e.timeStamp || performance.now()));
  };
  const down = (e) => {
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, travel: 0, onDoor: el.contains(e.target) };
    if (e.pointerType !== 'mouse') reset();
  };
  const up = (e) => {
    if (press && e.pointerId === press.id) { const p = press; setTimeout(() => { if (press === p) press = null; }, 0); }
    if (e.pointerType !== 'mouse') last = null;
  };
  /* before the door hears it: a press that travelled, or the click right after the entrance, opens nothing */
  const click = (e) => {
    if (!el.contains(e.target)) return;
    const travelled = press && press.onDoor && press.travel > 24;
    if (travelled || performance.now() - firedAt < 800) { e.preventDefault(); e.stopImmediatePropagation(); }
  };
  addEventListener('pointermove', move, { passive: true });
  addEventListener('pointerdown', down, true);
  addEventListener('pointerup', up, true);
  addEventListener('pointercancel', up, true);
  addEventListener('click', click, true);
  return {
    off() {
      removeEventListener('pointermove', move); removeEventListener('pointerdown', down, true);
      removeEventListener('pointerup', up, true); removeEventListener('pointercancel', up, true);
      removeEventListener('click', click, true);
    },
  };
}
