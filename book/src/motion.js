/* motion: a tween eased with minimum jerk, and a guarded hand-off. The site always moves: there is no pause and no
   reduced-motion branch, by the owner's rule. */

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

/* call fn once, whichever comes first: the callback it is given, or ms of waiting. A slow or missed frame can never
   leave a picture stuck between two states. */
export function once(ms, start, fn) {
  let done = false;
  const go = () => { if (done) return; done = true; clearTimeout(id); fn(); };
  const id = setTimeout(go, ms);
  start(go);
}
