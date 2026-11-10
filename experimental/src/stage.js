/* stage: what every chamber stands on. The fog, simulacra laid over it, the pointer, images, and the two ways
   a chamber's progress moves on screen: a chaser that travels toward a target in minimum-jerk steps, and a
   hold that gathers while pressed and slowly gives back when released. Neither can jump. */

import { travel, REDUCED } from './motion.js';

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
export function createGround(canvas, density) {
  const fog = A.Fog(canvas, { density, light: 0.3 });
  let d = density, stopTravel = null, zoneList = [];
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
/* a simulacrum on its own full-screen canvas, blended into the fog so its ground drops out.
   Its options stay live: the runtime reads gain, scatter, erosion, ceiling, accent and margin from this same object
   on every frame, so a chamber can move them without uploading anything. Only redraw() uploads a new density map. */
export function picture(parent, opts) {
  const canvas = document.createElement('canvas');
  canvas.className = 'layer';
  canvas.setAttribute('aria-hidden', 'true');
  parent.appendChild(canvas);
  const o = Object.assign({ scatter: 0.5, erosion: 0.45, ceiling: 0.8, accent: 0, margin: 0.08 }, opts);
  const s = A.Simulacrum(canvas, o);
  let ready = false, gone = false;
  return {
    o, canvas,
    get ready() { return ready; },
    /* coalesce out of the fog: 2.6 s */
    show(src, done) { canvas.classList.add('on'); s.show(src, () => { ready = true; if (done) done(); }); },
    /* dissolve back into it: 1.8 s */
    hide(done) { ready = false; s.hide(done); },
    /* swap the density map in place, without a dissolve; only once the picture has gathered */
    redraw(src) { if (ready) s.show(src); },
    /* stop drawing, give the WebGL context back and take the canvas away */
    destroy() {
      if (gone) return; gone = true; s.stop();
      const gl = canvas.getContext('webgl');
      const lose = gl && gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
      canvas.remove();
    },
  };
}

/* ---------- progress on screen ---------- */
/* chaser: the shown value travels toward the target in minimum-jerk segments of `dur` ms. A segment always runs
   to its end; a new one starts from where the last stopped, toward wherever the target is by then. */
export function chaser(dur = 700) {
  let value = 0, target = 0, from = 0, to = 0, t0 = -1;
  return {
    get value() { return value; },
    get target() { return target; },
    set target(v) { target = Math.max(0, Math.min(1, v)); },
    add(d) { this.target = target + d; },
    step(now) {
      if (REDUCED) { value = target; return value; }
      if (t0 < 0) {
        if (Math.abs(target - value) < 1e-4) return value;
        from = value; to = target; t0 = now;
      }
      const k = Math.min(1, (now - t0) / dur);
      value = from + (to - from) * A.MJ(k);
      if (k >= 1) t0 = -1;
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
      v += (want - v) * (REDUCED ? 1 : Math.min(1, dt * 5));
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

export const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
