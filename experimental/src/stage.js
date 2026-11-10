/* stage: what every chamber stands on. The fog, the two simulacra laid over it, the cell grid, the pointer, images,
   and the two ways a chamber's progress moves on screen: a chaser that travels toward a target in minimum-jerk steps, and a
   hold that gathers while pressed and slowly gives back when released. Neither can jump. */

import { travel, STEP } from './motion.js';

const A = window.Aphesis;

/* ---------- images ---------- */
const cache = new Map();
export function image(src) {
  if (!cache.has(src)) {
    cache.set(src, new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = src;
    }));
  }
  return cache.get(src);
}

/* a grayscale canvas cut from a density map: crop [x, y, w, h] in map pixels, optional padding and masks.
   masks are rectangles [x, y, w, h] in the cropped frame that go black (the density map's empty). */
export function cut(img, { crop, pad = [0, 0, 0, 0], masks = [], scale = 1 } = {}) {
  const [cx, cy, cw, ch] = crop || [0, 0, img.naturalWidth, img.naturalHeight];
  const [pt, pr, pb, pl] = pad;
  const c = document.createElement('canvas');
  c.width = Math.round((cw + pl + pr) * scale); c.height = Math.round((ch + pt + pb) * scale);
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
  x.drawImage(img, cx, cy, cw, ch, pl * scale, pt * scale, cw * scale, ch * scale);
  x.fillStyle = '#000';
  masks.forEach(([mx, my, mw, mh]) => x.fillRect((mx + pl) * scale, (my + pt) * scale, mw * scale, mh * scale));
  return c;
}

/* a density map prepared for one chamber, without touching the design system's file: an optional blur first (so
   fine hatching becomes tone, as the map rules ask for engravings), then levels: black point lo, white point hi,
   gamma (below 1 lifts the half-tones). src is an image or a canvas; returns a new canvas. */
export function levels(src, { blur = 0, lo = 0, hi = 1, gamma = 1 } = {}) {
  const w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
  if (blur) x.filter = 'blur(' + blur + 'px)';
  x.drawImage(src, 0, 0);
  x.filter = 'none';
  const d = x.getImageData(0, 0, w, h), px = d.data, lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) lut[i] = Math.round(255 * Math.pow(Math.max(0, Math.min(1, (i / 255 - lo) / Math.max(1e-3, hi - lo))), gamma));
  for (let i = 0; i < px.length; i += 4) { const v = lut[px[i]]; px[i] = px[i + 1] = px[i + 2] = v; }
  x.putImageData(d, 0, 0);
  return c;
}

/* ---------- the cell grid ---------- */
/* every stipple canvas is sized and moved in whole cells (Aphesis.cellPx: 2 CSS pixels rounded to whole device
   pixels), so its cells land on whole device pixels, stay square and line up with the fog's. The full-screen size is
   the large viewport (100lvh), so a phone's address bar coming and going never resizes, and so never re-samples, a field. */
export const cell = () => A.cellPx(2);
export const snap = (v) => Math.round(v / cell()) * cell();
const snapUp = (v) => Math.ceil(v / cell() - 1e-6) * cell();
const probe = document.createElement('div');
probe.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;height:100lvh;visibility:hidden;pointer-events:none';
document.documentElement.appendChild(probe);
export function screen() { const r = probe.getBoundingClientRect(); return { w: r.width || innerWidth, h: r.height || innerHeight }; }
function place(canvas, g) {
  const s = screen();
  const { left = 0, top = 0, width = s.w, height = s.h } = g || {};
  Object.assign(canvas.style, { left: snap(left) + 'px', top: snap(top) + 'px', width: snapUp(width) + 'px', height: snapUp(height) + 'px' });
}

/* ---------- the fog ---------- */
export function createGround(canvas, density) {
  place(canvas);
  const fog = A.Fog(canvas, { density, light: 0.3 });
  let d = density, stopTravel = null, zoneList = [];
  addEventListener('resize', () => place(canvas));
  return {
    fog,
    density: () => d,
    /* the fog thickens or thins with minimum jerk */
    to(target, dur = 1800, done) {
      if (stopTravel) stopTravel();
      const d0 = d;
      stopTravel = travel(dur, (e) => { d = d0 + (target - d0) * e; fog.set({ density: d }); }, done);
    },
    zones(list) { zoneList = list.filter(Boolean).slice(0, 12); fog.zones(zoneList); },
  };
}

/* ---------- pictures ---------- */
/* Two simulacra live for the whole visit, on two canvases made once when the page loads; every chamber borrows them.
   No canvas or WebGL context is ever made or thrown away during the journey, so nothing has to compile, nothing
   flashes before its first frame, and the browser never runs short of contexts. The pictures lie over the fog with a
   transparent ground (ground: false), with no blend mode. A borrowed canvas stays invisible until its first frame
   with the new picture is drawn, then fades in; given back, it fades out before it rests.
   Its options stay live: the runtime reads gain, scatter, erosion, ceiling, accent, margin and fit from the same
   object on every frame, so a chamber moves them without uploading anything. Only redraw() uploads a new map. */
const DEFAULTS = { ground: false, scatter: 0.5, erosion: 0.45, ceiling: 0.8, accent: 0, margin: 0.08, fit: 'contain', gain: 1 };
const slots = [];
export function createPictures(before) {
  for (let i = 0; i < 2; i++) {
    const canvas = document.createElement('canvas');
    canvas.className = 'layer';
    canvas.setAttribute('aria-hidden', 'true');
    before.before(canvas);
    const o = Object.assign({}, DEFAULTS);
    place(canvas);
    const sim = A.Simulacrum(canvas, o);
    sim.stop();
    slots.push({ canvas, o, sim, busy: false, geo: null, rest: 0, gen: 0 });
  }
  addEventListener('resize', () => slots.forEach((s) => place(s.canvas, s.geo)));
}

export function picture(_root, opts) {
  const slot = slots.find((s) => !s.busy);
  if (!slot) throw new Error('both pictures are in use');
  slot.busy = true; slot.gen++;
  clearTimeout(slot.rest);
  const { canvas, o, sim } = slot, gen = slot.gen;
  Object.keys(o).forEach((k) => delete o[k]);
  Object.assign(o, DEFAULTS, opts);
  slot.geo = null; place(canvas); canvas.style.transform = '';
  let ready = false, given = false;
  return {
    o, canvas,
    get ready() { return ready; },
    /* lay the canvas over a rectangle other than the screen (CSS pixels; snapped to the cell grid) */
    place(g) { slot.geo = g; place(canvas, g); },
    /* coalesce out of the fog: 2.6 s */
    show(src, done) {
      sim.start();
      sim.show(src, () => { ready = true; if (done) done(); });
      sim.drawn(() => { if (slot.gen === gen && !given) canvas.classList.add('on'); });
    },
    /* dissolve back into it: 1.8 s */
    hide(done) { ready = false; sim.hide(done); },
    /* swap the density map in place, without a dissolve; only once the picture has gathered */
    redraw(src) { if (ready) sim.show(src); },
    /* give the canvas back: it fades out (duration-scene), then rests until the next chamber borrows it */
    destroy() {
      if (given) return; given = true; ready = false;
      canvas.classList.remove('on');
      slot.busy = false;
      slot.rest = setTimeout(() => { if (!slot.busy) sim.stop(); }, 1400);
    },
  };
}

/* ---------- progress on screen ---------- */
/* chaser: the shown value travels toward the target in minimum-jerk segments of `dur` ms. A segment always runs
   to its end; a new one starts from where the last stopped, toward wherever the target is by then. */
export function chaser(dur = 700) {
  let value = 0, target = 0, from = 0, to = 0, t = -1, last = 0;
  return {
    get value() { return value; },
    get target() { return target; },
    set target(v) { target = Math.max(0, Math.min(1, v)); },
    add(d) { this.target = target + d; },
    step(now) {
      if (t < 0) {
        if (Math.abs(target - value) < 1e-4) return value;
        from = value; to = target; t = 0; last = now;
      }
      t += Math.min(STEP, Math.max(0, now - last)); last = now;   /* a stalled frame pauses, never skips */
      const k = Math.min(1, t / dur);
      value = from + (to - from) * A.MJ(k);
      if (k >= 1) t = -1;
      return value;
    },
  };
}

/* hold: rises while held (`rise` seconds from 0 to 1), falls slowly when let go (`fall` seconds from 1 to 0).
   Its speed eases between the two, so neither a press nor a release jerks it. */
export function hold(rise = 2.5, fall = 8) {
  let value = 0, v = 0;
  return {
    get value() { return value; },
    step(dt, held) {
      const want = held ? 1 / rise : -1 / fall;
      v += (want - v) * (Math.min(1, dt * 5));
      value = Math.max(0, Math.min(1, value + v * dt));
      if (value === 0 && v < 0) v = 0;
      return value;
    },
  };
}

/* ---------- presses ---------- */
/* is the pointer or a key held for this chamber? onPress(e) decides whether a pointer press counts (a zone);
   Enter and Space count while held. Presses on links and buttons never count. */
export function presses(accept = () => true) {
  let pointerHeld = false, keyHeld = false, id = null;
  const down = (e) => {
    if (e.target.closest && e.target.closest('a, button')) return;
    if (accept(e)) { pointerHeld = true; id = e.pointerId; }
  };
  const up = (e) => { if (id === null || e.pointerId === id) { pointerHeld = false; id = null; } };
  const kd = (e) => { if (e.key === 'Enter' || e.key === ' ') { keyHeld = true; e.preventDefault(); } };
  const ku = (e) => { if (e.key === 'Enter' || e.key === ' ') keyHeld = false; };
  const blur = () => { pointerHeld = keyHeld = false; };
  addEventListener('pointerdown', down);
  addEventListener('pointerup', up); addEventListener('pointercancel', up);
  addEventListener('keydown', kd); addEventListener('keyup', ku); addEventListener('blur', blur);
  return {
    get held() { return pointerHeld || keyHeld; },
    off() {
      removeEventListener('pointerdown', down);
      removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('blur', blur);
    },
  };
}

/* ---------- dragging ---------- */
/* how far the pointer has travelled while pressed, in CSS pixels, in any direction: the length of the path between the
   positions the browser reports. A dropped or coalesced stretch still counts as the straight line across it, and one
   step never counts more than `cap`, so a jump cannot finish anything. accept(e) decides whether a press counts. */
export function dragging(onMove, accept = () => true, cap = 160) {
  let id = null, last = null;
  const down = (e) => {
    if (e.target.closest && e.target.closest('a, button')) return;
    if (!accept(e)) return;
    id = e.pointerId; last = [e.clientX, e.clientY];
  };
  const move = (e) => {
    if (id === null || e.pointerId !== id) return;
    const list = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    (list.length ? list : [e]).forEach((c) => {
      const d = Math.hypot(c.clientX - last[0], c.clientY - last[1]);
      last = [c.clientX, c.clientY];
      if (d > 0.5) onMove(Math.min(cap, d));
    });
  };
  const up = (e) => { if (e.pointerId === id) { id = null; last = null; } };
  addEventListener('pointerdown', down);
  addEventListener('pointermove', move, { passive: true });
  addEventListener('pointerup', up); addEventListener('pointercancel', up);
  return {
    get pressed() { return id !== null; },
    off() {
      removeEventListener('pointerdown', down); removeEventListener('pointermove', move);
      removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
    },
  };
}

/* a soft swell after a moment of impact: 0, up to 1 and back, over `ms`, smooth at both ends */
export function swell(t0, now, ms = 800) {
  if (t0 < 0) return 0;
  const s = (now - t0) / ms;
  return s > 0 && s < 1 ? Math.sin(Math.PI * s) ** 2 : 0;
}

export const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
