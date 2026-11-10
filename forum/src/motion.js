/* motion: a tween eased with minimum jerk, and a scroll that travels the same way.
   There is no pause: nothing here loops but the fog. The site always animates, whatever the system's motion
   setting (the owner's rule), so there are no reduced-motion branches. */

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

/* scroll a container so el sits a little below its top, travelling with minimum jerk */
let stopScroll = null;
export function scrollToEl(box, el, offset = 96) {
  if (stopScroll) stopScroll();
  const from = box.scrollTop;
  const to = Math.max(0, Math.min(box.scrollHeight - box.clientHeight,
    from + el.getBoundingClientRect().top - box.getBoundingClientRect().top - offset));
  const dur = Math.min(1100, 500 + Math.abs(to - from) * 0.4);
  stopScroll = travel(dur, (e) => { box.scrollTop = from + (to - from) * e; });
}
