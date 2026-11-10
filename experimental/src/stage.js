/* stage: what every chamber stands on. The fog, layers of simulacra blended over it, the pointer, images. */

import { capture, travel, REDUCED } from './motion.js';

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

/* ---------- the fog ---------- */
export function createGround(canvas) {
  const opts = { density: 0.62, light: 0.4 };
  const fog = capture(() => A.Fog(canvas, opts));
  let density = opts.density, stopTravel = null, zoneList = [];
  return {
    fog,
    density: () => density,
    /* the fog thickens or thins with minimum jerk */
    to(d, dur = 1600) {
      if (stopTravel) stopTravel();
      const d0 = density;
      stopTravel = travel(dur, (e) => { density = d0 + (d - d0) * e; fog.set({ density }); });
    },
    zones(list) { zoneList = list.filter(Boolean).slice(0, 12); fog.zones(zoneList); },
    addZones(list) { this.zones(zoneList.concat(list)); },
  };
}

/* ---------- layers ---------- */
/* a full-screen canvas for one simulacrum, blended into the fog so its own ground drops out */
export function layer(parent, label) {
  const c = document.createElement('canvas');
  c.className = 'layer';
  c.setAttribute('aria-hidden', 'true');
  if (label) c.dataset.label = label;
  parent.appendChild(c);
  return c;
}

/* a simulacrum whose options stay live: the runtime reads gain, scatter, erosion, ceiling, accent and margin
   from this same object on every frame, so a chamber can move them while the picture breathes */
export function simulacrum(canvas, opts) {
  const o = Object.assign({ scatter: 0.5, erosion: 0.45, ceiling: 0.8, accent: 0, margin: 0.08 }, opts);
  const s = capture(() => A.Simulacrum(canvas, o));
  let ready = false;
  return {
    o, canvas,
    get ready() { return ready; },
    show(src, done) { ready = false; capture(() => s.show(src, () => { ready = true; done && done(); })); },
    hide(done) { ready = false; capture(() => s.hide(done)); },
    /* swap the density field in place, without a dissolve: only once the picture has gathered */
    redraw(src) { if (ready) capture(() => s.show(src)); },
    stop() { s.stop(); },
  };
}

/* ---------- the pointer ---------- */
export const pointer = { x: innerWidth / 2, y: innerHeight / 2, present: false, down: false, type: 'mouse', moved: 0 };
addEventListener('pointermove', (e) => {
  pointer.x = e.clientX; pointer.y = e.clientY; pointer.type = e.pointerType; pointer.moved = performance.now();
  pointer.present = e.pointerType === 'mouse' || pointer.down;
}, { passive: true });
addEventListener('pointerdown', (e) => {
  pointer.down = true; pointer.present = true; pointer.type = e.pointerType;
  pointer.x = e.clientX; pointer.y = e.clientY; pointer.moved = performance.now();
}, { passive: true });
const up = (e) => { pointer.down = false; if (e.pointerType !== 'mouse') pointer.present = false; };
addEventListener('pointerup', up, { passive: true });
addEventListener('pointercancel', up, { passive: true });
document.addEventListener('pointerleave', () => { pointer.present = false; });

/* a second-order follower: critically damped, so it arrives without overshoot, the way a hand settles */
export function follower(x0, omega = 4) {
  let x = x0, v = 0;
  return {
    get value() { return x; },
    set(val) { x = val; v = 0; },
    step(target, dt) {
      if (REDUCED) { x = target; v = 0; return x; }
      const a = omega * omega * (target - x) - 2 * omega * v;
      v += a * dt; x += v * dt; return x;
    },
  };
}

export const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
