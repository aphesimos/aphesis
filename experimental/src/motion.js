/* motion: reduced motion, the section's frame, a tween eased with minimum jerk, and a wait.
   There is no pause: every loop in the section ends on its own, and reduced motion makes it still. */

const A = window.Aphesis;
export const REDUCED = A.reducedMotion;
export const frame = (cb) => requestAnimationFrame(cb);

/* a tween over dur ms, eased with minimum jerk (Aphesis.MJ). fn(e) gets 0 to 1. With reduced motion it lands at once. */
export function travel(dur, fn, done) {
  let t0 = null, live = true;
  if (REDUCED || dur <= 0) { fn(1); if (done) done(); return () => {}; }
  function step(now) {
    if (!live) return;
    if (t0 === null) t0 = now;
    const k = Math.min(1, (now - t0) / dur);
    fn(A.MJ(k));
    if (k < 1) requestAnimationFrame(step); else if (done) done();
  }
  requestAnimationFrame(step);
  return () => { live = false; };
}

/* a wait that can be cancelled */
export function wait(ms, fn) {
  const id = setTimeout(fn, ms);
  return () => clearTimeout(id);
}

/* call fn once, whichever comes first: the callback it is given, or ms of waiting. Animations hand off through this,
   so a slow or missed frame can never leave the journey stuck between two steps. */
export function once(ms, start, fn) {
  let done = false;
  const go = () => { if (done) return; done = true; clearTimeout(id); fn(); };
  const id = setTimeout(go, ms);
  start(go);
}
