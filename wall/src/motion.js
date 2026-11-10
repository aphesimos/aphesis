/* motion: a tween eased with minimum jerk. The wall always moves: there is no pause and no reduced-motion branch
   (the owner's rule for the whole site). */

const A = window.Aphesis;

/* a tween over dur ms, eased with minimum jerk (Aphesis.MJ). fn(e) gets 0 to 1. */
export function travel(dur, fn, done) {
  let t0 = null, live = true;
  if (dur <= 0) { fn(1); if (done) done(); return () => {}; }
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

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
