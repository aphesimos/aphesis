/* motion: the section's frame, a tween eased with minimum jerk, and a wait.
   The section always animates, whatever the system's reduce-motion setting (the owner's decision), and has no pause. */

const A = window.Aphesis;
export const frame = (cb) => requestAnimationFrame(cb);

/* the longest step any animation takes in one frame. A stalled frame (a busy main thread, a slow device) pauses the
   motion instead of skipping it, so nothing ever jumps; at 10 frames a second or more, time runs as it should. */
export const STEP = 100;

/* a tween over dur ms, eased with minimum jerk (Aphesis.MJ). fn(e) gets 0 to 1. */
export function travel(dur, fn, done) {
  let last = null, t = 0, live = true;
  if (dur <= 0) { fn(1); if (done) done(); return () => {}; }
  function step(now) {
    if (!live) return;
    if (last !== null) t += Math.min(STEP, Math.max(0, now - last));
    last = now;
    const k = Math.min(1, t / dur);
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
