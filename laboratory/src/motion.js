/* motion: a tween eased with minimum jerk, a hand-off that cannot get stuck, and a frame clock.
   There is no pause: every run on the bench ends on its own. The site always animates (the owner's rule), so
   nothing here reads prefers-reduced-motion. */

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

/* call fn once, whichever comes first: the callback it is given, or ms of waiting */
export function once(ms, start, fn) {
  let done = false;
  const go = () => { if (done) return; done = true; clearTimeout(id); fn(); };
  const id = setTimeout(go, ms);
  start(go);
}

/* a frame loop that runs until tick() returns false or stop() is called. tick(dt, now) gets seconds. */
export function ticker(tick) {
  let raf = 0, last = 0, live = true;
  function frame(now) {
    if (!live) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
    if (tick(dt, now) === false) { live = false; return; }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return { stop() { live = false; cancelAnimationFrame(raf); }, get running() { return live; } };
}

/* numbers in the text face: fixed decimals, a real minus sign */
export function num(v, digits = 3) {
  if (!isFinite(v)) return '·';
  return v.toFixed(digits).replace('-', '−');
}
export function pct(v, digits = 1) { return isFinite(v) ? (v * 100).toFixed(digits) + '%' : '·'; }

/* the theme changed: the eye, or the system setting */
export function onTheme(fn) {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', fn);
  new MutationObserver(fn).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}
