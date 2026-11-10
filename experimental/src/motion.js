/* motion: reduced motion and a pause for everything that loops.
   The runtime's Fog and Simulacrum run their own animation frames and offer only stop(), with no way back.
   So the section holds their frames instead: any frame callback first registered inside capture() becomes
   pausable, and while paused its next frame waits in a queue. Their clocks cap each step at 50 ms, so time
   does not jump on resume. Other frames (the cursor) keep running. */

const A = window.Aphesis;
export const REDUCED = A.reducedMotion;

const rawRAF = window.requestAnimationFrame.bind(window);
const rawCAF = window.cancelAnimationFrame.bind(window);
const pausable = new WeakSet();
const held = new Map();
let capturing = 0, paused = false, wanted = false, nextId = -1, pulseTimer = 0;
const listeners = new Set();

window.requestAnimationFrame = function (cb) {
  if (capturing) pausable.add(cb);
  if (paused && pausable.has(cb)) { const id = nextId--; held.set(id, cb); return id; }
  return rawRAF(cb);
};
window.cancelAnimationFrame = function (id) {
  if (id < 0) held.delete(id); else rawCAF(id);
};

function release() {
  const cbs = [...held.values()]; held.clear();
  cbs.forEach((cb) => rawRAF(cb));
}

/* run fn so that every frame loop it starts can be paused */
export function capture(fn) {
  capturing++;
  try { return fn(); } finally { capturing--; }
}

/* the section's own loops use this frame, and read isPaused() themselves */
export const frame = rawRAF;
export const isPaused = () => paused;

export function setPaused(p) {
  p = !!p; clearTimeout(pulseTimer);
  const changed = p !== wanted;
  wanted = p; paused = p;
  if (!paused) release();
  if (changed) listeners.forEach((fn) => fn(paused));
}

/* let held frames run for a moment while paused, so a theme change reaches the canvases */
export function pulse(ms) {
  if (!wanted) return;
  paused = false; release();
  clearTimeout(pulseTimer);
  pulseTimer = setTimeout(() => { if (wanted) paused = true; }, ms || 1000);
}

export function onPause(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/* a tween on the section's own frame, eased with minimum jerk; it waits while paused */
export function travel(dur, fn, done) {
  let t = 0, last = null, live = true;
  if (REDUCED || dur <= 0) { fn(1); done && done(); return () => {}; }
  function step(now) {
    if (!live) return;
    if (last === null) last = now;
    const dt = now - last; last = now;
    if (!paused) t += dt;
    const k = Math.min(1, t / dur);
    fn(A.MJ(k));
    if (k < 1) rawRAF(step); else done && done();
  }
  rawRAF(step);
  return () => { live = false; };
}

/* a pausable wait */
export function wait(ms, fn) {
  let left = ms, last = performance.now(), live = true, id = 0;
  function tick() {
    if (!live) return;
    const now = performance.now();
    if (!paused) left -= now - last;
    last = now;
    if (left <= 0) fn(); else id = setTimeout(tick, Math.min(250, left));
  }
  id = setTimeout(tick, Math.min(250, left));
  return () => { live = false; clearTimeout(id); };
}
