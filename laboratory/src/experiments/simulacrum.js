/* the simulacrum: a picture, any picture, turned into fog by the site's own engine, and measured as it renders.

   Two stages, as the site's maps are made:
   - the map: the picture becomes a density map in the browser, by the forum's preparation (forum/src/density.js):
     borders trimmed, cut to 3:2 at most, 480 to 560px on the long side, a light ground inverted and blurred 1px,
     black point at the 30th percentile, white at the 97.5th, gamma 0.8. Here every step is a slider: crop, invert,
     levels, gamma, blur (gaussian, as the CSS filter the book uses) and contrast (the CSS contrast factor). The
     design system's own maps come in untouched: with every map control at rest, the map is the file, pixel for pixel.
   - the render: Aphesis.Simulacrum on one canvas, with its own options object. The engine reads gain, scatter,
     erosion, ceiling, accent, margin, fit, ground and cell from that object on every frame, so the sliders write
     into it and nothing else stands between them and what the site does.

   The measure: once a picture has settled (coalesced, so the fog no longer pushes its cells around), the canvas is
   read back (its context keeps its drawing buffer). Each cell is placed in the picture with the engine's own fit
   (box = canvas × (1 − margin), contain or cover, centred); inside the picture and past its feather (7% of each side)
   the map's density under the cell, sampled bilinearly like the texture, sorts it into one of ten bins, and the
   share of each bin that lit is counted. Cells outside the picture are the lost points and the mist. Frames are
   averaged for three seconds after the last change, then the measure rests until something moves again.

   Nothing leaves the browser: a picture is decoded here, and the downloads are made from canvases on this page. */

import { SIMULACRA } from '../assets.js';
import { bench } from '../bench.js';
import { chart } from '../chart.js';
import { slider } from '../slider.js';
import { field } from '../stipple.js';
import { ticker, num, pct } from '../motion.js';

const A = window.Aphesis;
const BINS = 10, FEATHER = 0.07, MEASURE_FOR = 3, MEASURE_EVERY = 0.3, WORK = 1600;
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/* the engine's own defaults (bundle_src.js), laid over the fog as the site lays a simulacrum: ground off */
const RENDER = { gain: 1, scatter: 0.5, erosion: 0.45, ceiling: 0.8, cell: 2, fit: 'contain', margin: 0.08, accent: 0, ground: false };
/* a map at rest: the picture's own tones */
const REST = { left: 0, right: 0, top: 0, bottom: 0, invert: false, black: 0, white: 1, gamma: 1, blur: 0, contrast: 1 };

/* ---------- the map: pure functions on luminance ---------- */
function luminance(data) {
  const n = data.length / 4, out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255;
  return out;
}

/* trim flat borders (the forum's rule): rows and columns from each edge whose tone barely varies, at most 12% a side */
function trimBox(lum, w, h) {
  const flat = (get, len) => { let s = 0, s2 = 0; for (let i = 0; i < len; i++) { const v = get(i); s += v; s2 += v * v; } const m = s / len; return s2 / len - m * m < 0.0012; };
  let t = 0, b = h - 1, l = 0, r = w - 1;
  const mh = Math.floor(h * 0.12), mw = Math.floor(w * 0.12);
  while (t < mh && flat((i) => lum[t * w + i], w)) t++;
  while (h - 1 - b < mh && flat((i) => lum[b * w + i], w)) b--;
  while (l < mw && flat((i) => lum[i * w + l], h)) l++;
  while (w - 1 - r < mw && flat((i) => lum[i * w + r], h)) r--;
  return [l, t, r - l + 1, b - t + 1];
}

function percentile(sorted, p) { return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))]; }

/* a gaussian blur of standard deviation sigma (in map pixels), as three box blurs each way */
function blur(src, w, h, sigma) {
  if (sigma < 0.05) return src;
  const n = 3, ideal = Math.sqrt(12 * sigma * sigma / n + 1);
  let wl = Math.floor(ideal); if (wl % 2 === 0) wl--;
  const m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4));
  const sizes = [0, 1, 2].map((i) => (i < m ? wl : wl + 2));
  let a = Float32Array.from(src), b = new Float32Array(src.length);
  const pass = (from, to, r, horiz) => {
    const len = horiz ? w : h, lines = horiz ? h : w, k = 1 / (2 * r + 1);
    for (let L = 0; L < lines; L++) {
      const at = (i) => (horiz ? L * w + Math.min(len - 1, Math.max(0, i)) : Math.min(len - 1, Math.max(0, i)) * w + L);
      let acc = 0;
      for (let i = -r; i <= r; i++) acc += from[at(i)];
      for (let i = 0; i < len; i++) {
        to[at(i)] = acc * k;
        acc += from[at(i + r + 1)] - from[at(i - r)];
      }
    }
  };
  for (const s of sizes) {
    const r = (s - 1) / 2; if (r < 1) continue;
    pass(a, b, r, true); pass(b, a, r, false);
  }
  return a;
}

/* ---------- reading a picture ---------- */
async function decodeFile(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file); } catch (_) { /* fall through to <img> */ }
  }
  const url = URL.createObjectURL(file);
  try { return await loadImage(url); } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
function loadImage(url) {
  return new Promise((resolve, reject) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = () => reject(new Error('decode')); im.src = url; });
}
/* a working copy of the picture, never more than WORK px on the long side */
function workingCopy(src) {
  const sw = src.width || src.naturalWidth, sh = src.height || src.naturalHeight;
  if (!sw || !sh) throw new Error('decode');
  const s = Math.min(1, WORK / Math.max(sw, sh));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(sw * s)); c.height = Math.max(1, Math.round(sh * s));
  const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, c.width, c.height);
  if (src.close) src.close();
  return c;
}

const slug = (s) => (String(s).replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'picture');

export function mount(host, ctx) {
  const b = bench(host);
  host.classList.add('sim');
  const grid = host.querySelector('.bench-grid');
  grid.appendChild(b.controls);          // the controls stand beside the canvas (below it on a phone)
  delete b.controls.dataset.zone;        // each group is a calm zone of its own: the fog calms an ellipse, and one
                                         // zone as tall as every control would calm only its middle
  host.appendChild(b.plot);              // the measure runs under both
  const left = b.specimen;
  left.classList.add('sim-left');

  /* ---------- the stage ---------- */
  const stage = document.createElement('div');
  stage.className = 'sim-stage';
  stage.dataset.tip = 'drop a picture here · or paste one';
  left.appendChild(stage);
  const cv = document.createElement('canvas');
  cv.className = 'cv sim-canvas';
  cv.setAttribute('role', 'img');
  stage.appendChild(cv);
  const capWork = document.createElement('p'); capWork.className = 'specimen-cap aph-meta';
  const capRead = document.createElement('p'); capRead.className = 'specimen-cap aph-meta num';
  const mapCv = document.createElement('canvas');
  mapCv.className = 'cv sim-map'; mapCv.setAttribute('role', 'img');
  mapCv.setAttribute('aria-label', 'the density map itself, each cell lit by a plain threshold: no gain, no erosion, no lost points');
  mapCv.hidden = true;
  const capMap = document.createElement('p'); capMap.className = 'specimen-cap aph-meta'; capMap.hidden = true;
  capMap.textContent = 'the map itself, under a plain threshold: no gain, no erosion, no lost points, held to .85 so it never goes solid';
  left.append(capWork, capRead, mapCv, capMap);

  const o = Object.assign({}, RENDER);
  const sim = A.Simulacrum(cv, o);
  sim.drawn(() => cv.classList.add('on'));
  const mapField = field(mapCv, { alpha: 0.62 });

  /* the map canvas: the prepared density map, grey, white = dense. The engine is given this canvas itself. */
  const map = document.createElement('canvas');
  const mctx = map.getContext('2d', { willReadFrequently: true });
  let mapV = null;                       // the map's values, 0 to 1, row by row from the top

  /* ---------- state ---------- */
  let source = null, P = Object.assign({}, REST), gone = false;
  let state = 'hidden', token = 0;       // the engine: 'coming' | 'shown' | 'going' | 'swapping' | 'hidden'

  /* ---------- controls ---------- */
  const group = (name) => {
    const g = document.createElement('div'); g.className = 'sim-group'; g.dataset.zone = '20';
    const h = document.createElement('h3'); h.className = 'sim-group-name'; h.textContent = name;
    g.appendChild(h); b.controls.appendChild(g); return g;
  };
  const row = (g) => { const r = document.createElement('div'); r.className = 'sim-row'; g.appendChild(r); return r; };
  const btn = (where, text, fn, tip) => { const x = b.button(text, fn, tip); where.appendChild(x); return x; };
  const toggle = (where, text, get, flip, show, tip, pressed = true) => {
    const x = btn(where, text, () => { flip(); sync(); }, tip);
    x.classList.add('tog');
    const v = document.createElement('span'); v.className = 'act-val aph-meta num';
    x.insertBefore(v, x.querySelector('svg'));
    const sync = () => {
      v.textContent = show(get());
      x.setAttribute('aria-label', `${text}: ${show(get())}`);
      if (pressed) x.setAttribute('aria-pressed', String(!!get()));
    };
    sync();
    return { node: x, sync };
  };

  /* source */
  const gSrc = group('the picture');
  const file = document.createElement('input');
  Object.assign(file, { type: 'file', accept: ACCEPT.join(','), className: 'sr', tabIndex: -1 });
  file.setAttribute('aria-hidden', 'true');
  gSrc.appendChild(file);
  const rSrc = row(gSrc);
  btn(rSrc, 'choose a picture', () => file.click(), 'jpeg, png, webp or gif · or drop one on the canvas, or paste it');
  const quiet = document.createElement('p'); quiet.className = 'sim-note aph-meta';
  quiet.textContent = 'nothing leaves this browser: the picture is read and turned into fog here.';
  gSrc.appendChild(quiet);
  const rPre = row(gSrc); rPre.classList.add('sim-presets'); rPre.setAttribute('role', 'group'); rPre.setAttribute('aria-label', 'the design system’s own maps');
  const presetBtns = SIMULACRA.map((p) => {
    const x = btn(rPre, p.name, () => usePreset(p), p.caption);
    x.dataset.file = p.file;
    return x;
  });

  /* the map */
  const gMap = group('the map');
  const S = {};
  const pctf = (v) => Math.round(v * 100) + '%';
  const add = (g, key, o2) => { S[key] = slider(g, Object.assign({ value: o2.def, input: (v) => o2.on(v) }, o2)); return S[key]; };
  const mapSlider = (key, min, max, step, name, label, fmt) =>
    add(gMap, key, { min, max, step, name, label, fmt, def: REST[key], on: (v) => { P[key] = v; mapChanged(); } });
  mapSlider('left', 0, 0.45, 0.005, 'crop left', 'crop from the left, share of the picture', pctf);
  mapSlider('right', 0, 0.45, 0.005, 'crop right', 'crop from the right, share of the picture', pctf);
  mapSlider('top', 0, 0.45, 0.005, 'crop top', 'crop from the top, share of the picture', pctf);
  mapSlider('bottom', 0, 0.45, 0.005, 'crop bottom', 'crop from the bottom, share of the picture', pctf);
  mapSlider('black', 0, 1, 0.005, 'black point', 'black point: tones at or below it become empty', (v) => num(v, 3));
  mapSlider('white', 0, 1, 0.005, 'white point', 'white point: tones at or above it become full', (v) => num(v, 3));
  mapSlider('gamma', 0.3, 3, 0.01, 'gamma', 'gamma: below 1 lifts the half-tones, above 1 sinks them', (v) => num(v, 2));
  mapSlider('blur', 0, 6, 0.1, 'blur', 'blur in map pixels, so hatching becomes tone', (v) => num(v, 1) + ' px');
  mapSlider('contrast', 0.5, 3, 0.01, 'contrast', 'contrast around the middle grey', (v) => '×' + num(v, 2));
  const rMap = row(gMap);
  const tInvert = toggle(rMap, 'invert', () => P.invert, () => {
    /* inverting mirrors the levels too, so the map becomes its exact negative */
    const lo = P.black, hi = P.white;
    P.invert = !P.invert; P.black = 1 - hi; P.white = 1 - lo;
    S.black.set(P.black); S.white.set(P.white); mapChanged();
  }, (v) => (v ? 'on' : 'off'), 'for engravings: dark lines on light paper become light on dark');
  btn(rMap, 'auto levels', () => { autoLevels(); mapChanged(); }, 'black at the 30th percentile, white at the 97.5th, as the site’s maps');
  const tMap = toggle(rMap, 'show the map', () => !mapCv.hidden, () => {
    mapCv.hidden = !mapCv.hidden; capMap.hidden = mapCv.hidden; if (!mapCv.hidden) paintMap();
  }, (v) => (v ? 'on' : 'off'), 'the density map itself, beside the render');

  /* the render */
  const gRen = group('the render');
  const renSlider = (key, min, max, step, name, label, fmt) =>
    add(gRen, key, { min, max, step, name, label, fmt, def: RENDER[key], on: (v) => { o[key] = v; if (key === 'cell') snap(); changed(); } });
  renSlider('gain', 0, 2.5, 0.01, 'gain', 'gain: how strongly the map lights the cells', (v) => num(v, 2));
  renSlider('scatter', 0, 1.5, 0.01, 'scatter', 'scatter: lost points drifting loose around the figure', (v) => num(v, 2));
  renSlider('erosion', 0, 1, 0.01, 'erosion', 'erosion: fog-shaped holes inside the figure', (v) => num(v, 2));
  renSlider('ceiling', 0, 1, 0.01, 'ceiling', 'ceiling: the most any area can fill', (v) => num(v, 2));
  renSlider('cell', 1, 6, 1, 'cell', 'cell size in css pixels', (v) => v + ' px');
  renSlider('margin', 0, 0.5, 0.01, 'margin', 'margin around the picture, share of the canvas', (v) => num(v, 2));
  renSlider('accent', 0, 0.1, 0.005, 'accent', 'accent: the share of red cells in the figure; the site keeps it at .05 or less', (v) => num(v, 3));
  const rRen = row(gRen);
  const tFit = toggle(rRen, 'fit', () => o.fit, () => { o.fit = o.fit === 'cover' ? 'contain' : 'cover'; changed(); },
    (v) => v, 'contain shows the whole picture · cover fills the canvas with it', false);
  const tGround = toggle(rRen, 'ground', () => o.ground, () => { o.ground = !o.ground; changed(); },
    (v) => (v ? 'on' : 'off'), 'on: the canvas paints the page’s ground under its cells · off: the cells lie over the fog');
  const rMove = row(gRen);
  btn(rMove, 'coalesce', () => coalesce(), 'out of the fog, in 2.6 s');
  btn(rMove, 'dissolve', () => dissolve(), 'back into the fog, in 1.8 s');

  /* output */
  const gOut = group('take it');
  const rOut = row(gOut);
  btn(rOut, 'copy settings', () => copySettings(), 'the picture’s settings, as the site reads them');
  btn(rOut, 'download the map', () => downloadMap(), 'the density map as a png, ready to use as a simulacrum');
  btn(rOut, 'download a frame', () => downloadFrame(), 'this frame of the render as a png');
  btn(rOut, 'reset', () => reset(), 'the picture’s own map and the engine’s defaults');
  const settingsOut = document.createElement('output');
  settingsOut.className = 'sim-settings aph-meta num';
  settingsOut.setAttribute('aria-label', 'the settings, as json');
  gOut.appendChild(settingsOut);
  const outNote = document.createElement('p'); outNote.className = 'sim-note aph-meta'; outNote.setAttribute('aria-live', 'polite');
  gOut.appendChild(outNote);
  const note = (t) => { outNote.textContent = t; };

  /* ---------- the chart ---------- */
  const sums = { lit: new Float64Array(BINS), n: new Float64Array(BINS), v: new Float64Array(BINS) };
  let core = { lit: 0, n: 0, v: 0 }, out = { lit: 0, n: 0 }, frames = 0;
  const ch = chart(b.plot, {
    x: { min: 0, max: 1, ticks: [0, 0.5, 1], fmt: (v) => v.toFixed(1), label: 'density in the map' },
    y: { min: 0, max: 1, ticks: [0, 0.5, 1], fmt: (v) => v.toFixed(1), label: 'share of cells lit' },
    height: 220,
    label: 'share of lit cells inside the picture against the map’s density there, in ten bins',
    step: 1 / BINS,
    readout: (x) => {
      const i = Math.max(0, Math.min(BINS - 1, Math.floor(x * BINS)));
      if (!sums.n[i]) return null;
      const d = sums.v[i] / sums.n[i], l = sums.lit[i] / sums.n[i];
      return { x: d, y: l, text: `map ${num(d, 3)} · lit ${num(l, 3)} · ${Math.round(sums.n[i] / Math.max(1, frames)).toLocaleString('en-US')} cells a frame` };
    },
    idle: () => 'the map itself: the line of single cells · what lit: the brush line · the densest bin: the ring',
  });

  /* ---------- building the map ---------- */
  let cropKey = '', cropLum = null, blurKey = '', blurLum = null, MW = 1, MH = 1;
  function cropBox() {
    const sw = source.img.width, sh = source.img.height;
    const l = Math.min(P.left, 0.95 - P.right), t = Math.min(P.top, 0.95 - P.bottom);
    const cx = l * sw, cy = t * sh, cw = Math.max(1, sw * (1 - l - P.right)), chh = Math.max(1, sh * (1 - t - P.bottom));
    return [cx, cy, cw, chh];
  }
  function cropped() {
    const [cx, cy, cw, chh] = cropBox(), key = [source.id, cx, cy, cw, chh].join();
    if (key === cropKey) return cropLum;
    const longest = Math.max(cw, chh);
    /* the site's own maps keep their size (up to 640); a new picture follows the forum's 480 to 560 */
    const long = source.preset ? Math.min(640, longest) : Math.min(560, Math.max(480, longest));
    const s = long / longest;
    MW = Math.max(1, Math.round(cw * s)); MH = Math.max(1, Math.round(chh * s));
    const w = document.createElement('canvas'); w.width = MW; w.height = MH;
    const x = w.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#000'; x.fillRect(0, 0, MW, MH);
    x.imageSmoothingQuality = 'high';
    x.drawImage(source.img, cx, cy, cw, chh, 0, 0, MW, MH);
    cropLum = luminance(x.getImageData(0, 0, MW, MH).data);
    cropKey = key; blurKey = '';
    return cropLum;
  }
  function blurred() {
    const lum = cropped(), key = cropKey + '|' + P.blur;
    if (key !== blurKey) { blurLum = blur(lum, MW, MH, P.blur); blurKey = key; }
    return blurLum;
  }
  /* invert, then levels, gamma and contrast; written grey into the map canvas */
  function buildMap() {
    const lum = blurred(), n = MW * MH;
    if (map.width !== MW || map.height !== MH) { map.width = MW; map.height = MH; }
    const img = mctx.createImageData(MW, MH), px = img.data;
    const lo = Math.min(P.black, 0.98), hi = Math.max(lo + 0.02, P.white);
    const V = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let v = P.invert ? 1 - lum[i] : lum[i];
      v = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
      if (P.gamma !== 1) v = Math.pow(v, P.gamma);
      if (P.contrast !== 1) v = Math.max(0, Math.min(1, (v - 0.5) * P.contrast + 0.5));
      const g = Math.round(v * 255);
      px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = g; px[i * 4 + 3] = 255;
      V[i] = g / 255;
    }
    mctx.putImageData(img, 0, 0);
    mapV = V;
  }
  function autoLevels() {
    const lum = blurred();
    const sorted = Float32Array.from(lum, (v) => (P.invert ? 1 - v : v)).sort();
    P.black = Math.round(percentile(sorted, 0.30) * 1000) / 1000;
    P.white = Math.round(Math.max(P.black + 0.02, percentile(sorted, 0.975)) * 1000) / 1000;
    S.black.set(P.black); S.white.set(P.white);
  }
  function paintMap() {
    if (mapCv.hidden || !mapV) return;
    mapCv.style.aspectRatio = `${MW} / ${MH}`;
    const V = mapV, w = MW, h = MH;
    mapField.paint((W, H, D) => {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        D[y * W + x] = 0.85 * V[Math.min(h - 1, Math.floor((y + 0.5) / H * h)) * w + Math.min(w - 1, Math.floor((x + 0.5) / W * w))];
      }
    });
  }

  /* the forum's first guess for a new picture: trimmed, at most 3:2, a light ground inverted and blurred, levels */
  function autoMap(img) {
    const sw = img.width, sh = img.height, ws = Math.min(1, 320 / Math.max(sw, sh));
    const pw = Math.max(1, Math.round(sw * ws)), ph = Math.max(1, Math.round(sh * ws));
    const probe = document.createElement('canvas'); probe.width = pw; probe.height = ph;
    const px = probe.getContext('2d', { willReadFrequently: true });
    px.drawImage(img, 0, 0, pw, ph);
    const plum = luminance(px.getImageData(0, 0, pw, ph).data);
    let [bx, by, bw, bh] = trimBox(plum, pw, ph);
    let edge = 0, en = 0;
    for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) {
      const e = Math.min(x - bx, bx + bw - 1 - x, y - by, by + bh - 1 - y);
      if (e < Math.max(2, Math.min(bw, bh) * 0.06)) { edge += plum[y * pw + x]; en++; }
    }
    const light = en > 0 && edge / en > 0.6;
    const ratio = bw / bh;
    if (ratio > 1.5) { const nw = bh * 1.5; bx += (bw - nw) / 2; bw = nw; }
    if (ratio < 2 / 3) { const nh = bw * 1.5; by += (bh - nh) / 2; bh = nh; }
    const r3 = (v) => Math.round(v * 1000) / 1000;
    return Object.assign({}, REST, {
      left: r3(bx / pw), top: r3(by / ph), right: r3(Math.max(0, 1 - (bx + bw) / pw)), bottom: r3(Math.max(0, 1 - (by + bh) / ph)),
      invert: light, blur: light ? 1 : 0, gamma: 0.8,
    });
  }

  /* ---------- the engine ---------- */
  const phone = matchMedia('(max-width: 640px)');
  function snap() {
    /* on a phone the stage takes the picture's shape (with room for its margin and lost points), so a wide picture
       does not sit in a tall empty box above the controls */
    if (phone.matches && mapV) {
      const w = stage.clientWidth, want = w * (MH / MW) / (1 - o.margin) * 1.12;
      stage.style.height = Math.round(Math.max(220, Math.min(innerHeight * 0.58, w * 1.05, want))) + 'px';
    } else stage.style.height = '';
    const r = stage.getBoundingClientRect(), c = A.cellPx(o.cell);
    const w = Math.max(c, Math.floor(r.width / c) * c), h = Math.max(c, Math.floor(r.height / c) * c);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    changed();
  }
  const settle = (tk) => () => { if (tk === token && !gone) { state = 'shown'; changed(); } };
  /* the map changed under a picture already showing: give the engine the canvas again, without a sound or a swap */
  function upload() {
    if (state !== 'shown' && state !== 'coming') return;   // a dissolving or swapping picture takes the map when it returns
    o.sound = false;
    const tk = token;
    sim.show(map, state === 'coming' ? settle(tk) : undefined);
    delete o.sound;
  }
  function coalesce() {
    const tk = ++token;
    if (state === 'shown') { state = 'swapping'; sim.set(map, settle(tk)); }
    else { state = 'coming'; sim.show(map, settle(tk)); }
    changed();
  }
  function dissolve() {
    if (state === 'hidden' || state === 'going') return;
    const tk = ++token; state = 'going';
    sim.hide(() => { if (tk === token) state = 'hidden'; });
    changed();
  }
  function swapIn() {
    const tk = ++token;
    if (state === 'shown' || state === 'coming') { state = 'swapping'; sim.set(map, settle(tk)); }
    else { state = 'coming'; sim.show(map, settle(tk)); }
  }

  let mapQueued = false;
  function mapChanged() {
    if (mapQueued || !source) return;
    mapQueued = true;
    requestAnimationFrame(() => {
      mapQueued = false; if (gone) return;
      const shape = MW / MH; buildMap(); if (MW / MH !== shape) snap(); upload(); paintMap(); changed();
    });
  }

  /* ---------- sources ---------- */
  let ids = 0;
  function useSource(src, settings, params) {
    source = src; source.id = ++ids;
    P = Object.assign({}, params);
    for (const k of ['left', 'right', 'top', 'bottom', 'black', 'white', 'gamma', 'blur', 'contrast']) S[k].set(P[k]);
    if (!source.preset) autoLevels();
    tInvert.sync();
    for (const k of ['gain', 'scatter', 'erosion', 'ceiling']) { o[k] = settings[k] !== undefined ? settings[k] : RENDER[k]; S[k].set(o[k]); }
    presetBtns.forEach((x) => { if (src.preset && x.dataset.file === src.preset.file) x.setAttribute('aria-current', 'true'); else x.removeAttribute('aria-current'); });
    capWork.textContent = src.caption;
    cv.setAttribute('aria-label', `the simulacrum of ${src.caption}, rendered by the site’s engine`);
    buildMap(); paintMap(); snap();
    swapIn();
    changed();
  }
  async function usePreset(p) {
    try {
      const im = await loadImage(p.data);
      if (gone) return;
      const img = workingCopy(im);
      useSource({ preset: p, img, base: p.file.replace(/\.[^.]+$/, ''), caption: `${p.name} · ${p.caption}` }, p.settings, REST);
      ctx.announce(`${p.name}, from the design system`);
    } catch (_) { note('that map could not be read here'); }
  }
  async function useFile(f) {
    if (!f) return;
    if (!ACCEPT.includes(f.type)) { note('that is not a picture i can read: jpeg, png, webp or gif'); return; }
    try {
      const img = workingCopy(await decodeFile(f));
      if (gone) return;
      const base = slug(f.name || 'pasted');
      useSource({ preset: null, img, base, caption: `your picture · ${base}` }, {}, autoMap(img));
      note('');
      ctx.announce('your picture, turned into fog');
    } catch (_) { note('that picture could not be read here'); }
  }
  file.addEventListener('change', () => { useFile(file.files[0]); file.value = ''; });
  const over = (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); host.classList.add('drop'); } };
  const leave = () => host.classList.remove('drop');
  const drop = (e) => { e.preventDefault(); leave(); useFile(e.dataTransfer.files[0]); };
  host.addEventListener('dragover', over); host.addEventListener('dragleave', leave); host.addEventListener('drop', drop);
  const paste = (e) => {
    const items = e.clipboardData ? [...e.clipboardData.items] : [];
    const it = items.find((i) => i.kind === 'file' && ACCEPT.includes(i.type));
    if (it) { e.preventDefault(); useFile(it.getAsFile()); }
  };
  document.addEventListener('paste', paste);

  /* ---------- output ---------- */
  const atRest = () => source && source.preset && ['left', 'right', 'top', 'bottom', 'black', 'white', 'gamma', 'blur', 'contrast', 'invert'].every((k) => P[k] === REST[k]);
  const mapFile = () => (atRest() ? source.base + '.png' : source.base + '-map.png');
  const r3 = (v) => Math.round(v * 1000) / 1000;
  function settings() {
    if (!source) return null;
    return { src: atRest() ? source.preset.file : mapFile(), gain: r3(o.gain), scatter: r3(o.scatter), erosion: r3(o.erosion), ceiling: r3(o.ceiling) };
  }
  const settingsText = () => JSON.stringify(settings());
  async function copySettings() {
    const t = settingsText();
    try { await navigator.clipboard.writeText(t); note('copied: ' + t); return; } catch (_) { /* fall back below */ }
    const range = document.createRange(); range.selectNodeContents(settingsOut);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
    let ok = false; try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    note(ok ? 'copied: ' + t : 'the settings are selected below: copy them from there');
  }
  const downloads = window.claude && typeof window.claude.use === 'function' ? window.claude.use('downloads').catch(() => null) : Promise.resolve(null);
  async function save(name, blob) {
    const d = await downloads;
    if (d) {
      try { await d.save({ filename: name, data: blob }); note('saved ' + name); } catch (e) { note(e && e.code === 'declined' ? 'not saved' : 'this page cannot save files here'); }
      return;
    }
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    note('saved ' + name);
  }
  const png = (c) => new Promise((res, rej) => c.toBlob((x) => (x ? res(x) : rej(new Error('encode'))), 'image/png'));
  async function downloadMap() { if (source) save(mapFile(), await png(map)); }
  async function downloadFrame() {
    if (!source || !cv.width) return;
    /* one canvas pixel is one cell: scale it up with hard edges to the screen's own pixels */
    const k = Math.max(1, Math.round(A.cellPx(o.cell) * (window.devicePixelRatio || 1)));
    const f = document.createElement('canvas'); f.width = cv.width * k; f.height = cv.height * k;
    const x = f.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(cv, 0, 0, f.width, f.height);
    save(`simulacrum-${source.base}.png`, await png(f));
  }
  function reset() {
    if (!source) return;
    const params = source.preset ? REST : autoMap(source.img);
    P = Object.assign({}, params);
    for (const k of ['left', 'right', 'top', 'bottom', 'black', 'white', 'gamma', 'blur', 'contrast']) S[k].set(P[k]);
    if (!source.preset) autoLevels();
    tInvert.sync();
    const own = source.preset ? source.preset.settings : {};
    for (const k of Object.keys(RENDER)) { o[k] = own[k] !== undefined ? own[k] : RENDER[k]; if (S[k]) S[k].set(o[k]); }
    tFit.sync(); tGround.sync();
    snap(); mapChanged();
    if (state === 'hidden' || state === 'going') coalesce();
    note('reset to the picture’s own map and the engine’s defaults');
  }

  /* ---------- the measure ---------- */
  const probe = document.createElement('canvas');
  const pctx = probe.getContext('2d', { willReadFrequently: true });
  let since = 0, clock = null, acc = 0;
  function changed() {
    if (source) settingsOut.textContent = settingsText();
    sums.lit.fill(0); sums.n.fill(0); sums.v.fill(0);
    core = { lit: 0, n: 0, v: 0 }; out = { lit: 0, n: 0 }; frames = 0; since = 0; acc = MEASURE_EVERY * 0.5;
    if (!clock || !clock.running) clock = ticker(tick);
    report();
  }
  function tick(dt) {
    if (gone) return false;
    since += dt; acc += dt;
    if (state === 'shown' && acc >= MEASURE_EVERY) { acc = 0; measure(); report(); plot(); }
    if (since > MEASURE_FOR && (state === 'shown' || state === 'hidden')) return false;
  }
  function measure() {
    const W = cv.width, H = cv.height;
    if (!mapV || W < 2 || H < 2) return;
    if (probe.width !== W || probe.height !== H) { probe.width = W; probe.height = H; }
    pctx.clearRect(0, 0, W, H); pctx.drawImage(cv, 0, 0);
    const px = pctx.getImageData(0, 0, W, H).data;
    const bg = A.cssColor('--bg').map((v) => v * 255);
    const isLit = o.ground
      ? (i) => Math.abs(px[i] - bg[0]) + Math.abs(px[i + 1] - bg[1]) + Math.abs(px[i + 2] - bg[2]) > 36
      : (i) => px[i + 3] > 90;
    /* the engine's fit, in canvas pixels (one per cell) */
    const box = [W * (1 - o.margin), H * (1 - o.margin)];
    const sc = o.fit === 'cover' ? Math.max(box[0] / MW, box[1] / MH) : Math.min(box[0] / MW, box[1] / MH);
    const sz = [MW * sc, MH * sc], off = [(W - sz[0]) / 2, (H - sz[1]) / 2];
    const V = mapV, w = MW, h = MH;
    for (let yt = 0; yt < H; yt++) {
      const gy = H - 1 - yt + 0.5;
      const v_ = 1 - (gy - off[1]) / sz[1];
      for (let x = 0; x < W; x++) {
        const u = (x + 0.5 - off[0]) / sz[0];
        const lit = isLit((yt * W + x) * 4) ? 1 : 0;
        if (u < 0 || u > 1 || v_ < 0 || v_ > 1) { out.n++; out.lit += lit; continue; }
        if (Math.min(u, 1 - u, v_, 1 - v_) < FEATHER) continue;
        /* bilinear, texel centres, clamped: as the texture is sampled */
        const fx = Math.min(w - 1, Math.max(0, u * w - 0.5)), fy = Math.min(h - 1, Math.max(0, v_ * h - 0.5));
        const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1), ax = fx - x0, ay = fy - y0;
        const d = (V[y0 * w + x0] * (1 - ax) + V[y0 * w + x1] * ax) * (1 - ay) + (V[y1 * w + x0] * (1 - ax) + V[y1 * w + x1] * ax) * ay;
        const bi = Math.min(BINS - 1, Math.floor(d * BINS));
        sums.n[bi]++; sums.lit[bi] += lit; sums.v[bi] += d;
        core.n++; core.lit += lit; core.v += d;
      }
    }
    frames++;
  }
  function plot() {
    const pts = [];
    for (let i = 0; i < BINS; i++) if (sums.n[i] >= 12 * Math.max(1, frames)) pts.push([sums.v[i] / sums.n[i], sums.lit[i] / sums.n[i]]);
    const layers = [{ type: 'dotted', pts: [[0, 0], [1, 1]], tone: 'soft' }];
    if (pts.length > 1) layers.push({ type: 'line', pts, width: 2, seed: 61, tone: 'ink' });
    if (pts.length) layers.push({ type: 'ring', at: pts[pts.length - 1], tone: 'accent', seed: 62 });
    ch.set(layers); ch.refresh();
  }
  function report() {
    if (!frames || !core.n) {
      const why = { coming: 'the picture is coalescing', swapping: 'the picture is changing', going: 'the picture is dissolving', hidden: 'the picture has dissolved into the fog' }[state] || 'measuring';
      capRead.textContent = why;
      ctx.values({ state: why, mean: '·', lit: '·', ratio: '·', stray: '·', top: '·', verdict: 'nothing is measured until it settles' });
      return;
    }
    const mean = core.v / core.n, lit = core.lit / core.n, stray = out.n ? out.lit / out.n : NaN;
    const top = sums.n[BINS - 1] >= 12 * frames ? sums.lit[BINS - 1] / sums.n[BINS - 1] : NaN;
    const verdict = !isFinite(top) ? 'the map never reaches its densest tenth here, so nothing could fill'
      : top < 0.9 ? 'even there the picture never fills' : 'there it fills almost solid: the site would raise erosion or lower the gain';
    capRead.textContent = `lit ${pct(lit)} where the map asks ${pct(mean)} · lost points ${isFinite(stray) ? pct(stray) : '·'} outside`;
    ctx.values({
      state: `measured over ${frames} frame${frames === 1 ? '' : 's'} of ${source.preset ? source.preset.name : 'your picture'}`,
      mean: num(mean, 3), lit: pct(lit), ratio: num(lit / mean, 2) + ' times', stray: isFinite(stray) ? pct(stray) : '·',
      top: isFinite(top) ? pct(top) : '·', verdict,
    });
  }

  /* ---------- start ---------- */
  const ro = new ResizeObserver(() => snap()); ro.observe(stage);
  snap();
  plot();
  if (SIMULACRA.length) usePreset(SIMULACRA[0]);
  else capWork.textContent = 'choose a picture to begin';

  return {
    stop() {
      gone = true; if (clock) clock.stop(); ro.disconnect(); ch.destroy(); mapField.destroy();
      Object.values(S).forEach((s) => s.destroy());
      document.removeEventListener('paste', paste);
      sim.destroy();
    },
  };
}
