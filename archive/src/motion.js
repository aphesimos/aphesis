/* motion: a tween eased with minimum jerk (Aphesis.MJ) and a cancellable wait.
   The site always animates; nothing here branches on a reduced-motion setting. */

const A = window.Aphesis;

/* a tween over dur ms, eased with minimum jerk. fn(e) gets 0 to 1. Returns a cancel function. */
export function travel(dur, fn, done) {
  let t0 = null, live = true;
  function step(now) {
    if (!live) return;
    if (t0 === null) t0 = now;
    const k = Math.min(1, (now - t0) / Math.max(1, dur));
    fn(A.MJ(k));
    if (k < 1) requestAnimationFrame(step); else if (done) done();
  }
  requestAnimationFrame(step);
  return () => { live = false; };
}

export function wait(ms, fn) {
  const id = setTimeout(fn, ms);
  return () => clearTimeout(id);
}
