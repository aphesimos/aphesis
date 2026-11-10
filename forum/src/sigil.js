/* sigil: a mark instead of a name. A poster token (one per poster per thread, made on the server) becomes a small
   drawing on the design system's 24-unit icon grid: one main stroke, sometimes a second, finer one, and up to three
   grains of stipple, chosen and placed from the token's bits, then mirrored and turned a quarter at a time.
   Same token, same sigil, on every visit and in every browser: the bits, the brush seeds and the placement all come
   from the token, and the brush is seeded (Aphesis.brush is deterministic for a given seed).

   sigilSpec(token)            -> {strokes: [{pts, w, seed, taper}], grains: [{x, y, seed}], parts: [words]}  (pure)
   sigilSVG(token, A?)         -> inline <svg> in currentColor, drawn with A.brush and A.stipple (A = window.Aphesis)
   sigilLabel(token)           -> words for assistive technology, e.g. "sigil: ring, crossbar, two grains"

   Color is never chosen here: the SVG fills with currentColor. Screens draw sigils in ink-soft; accent (rubedo) is
   reserved for a moment of impact (the post a quote leads to), never for a poster. Size: 28 to 40px, like an icon.
   For the design system: this module has no dependencies but hash.js and the runtime's brush and stipple. */

import { bitReader } from './hash.js';

const C = 12;                         /* the grid's centre */
const NODES = [6, 12, 18];            /* the icon grid's thirds */
/* where grains may fall: the outer ring of the grid and its centre, clear of most strokes' ends */
const GRAIN_AT = [[5, 5], [12, 3.6], [19, 5], [20.4, 12], [19, 19], [12, 20.4], [5, 19], [3.6, 12], [12, 12]];

function arc(cx, cy, r, a0, a1, n = 40) {
  const p = [];
  for (let i = 0; i <= n; i++) {
    const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180;
    p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return p;
}
function seg(x0, y0, x1, y1, n = 20) {
  const p = [];
  for (let i = 0; i <= n; i++) { const t = i / n; p.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]); }
  return p;
}
/* a polyline through corners, sampled densely, so one brush stroke can turn a corner */
function path(corners, n = 14) {
  let p = [];
  for (let i = 1; i < corners.length; i++) {
    const s = seg(corners[i - 1][0], corners[i - 1][1], corners[i][0], corners[i][1], n);
    p = p.concat(i > 1 ? s.slice(1) : s);
  }
  return p;
}

/* the main stroke: eight families, each with a few variants read from the bits */
const MAIN = [
  ['stem', (r) => { const lean = (r.take(2) - 1.5) * 1.2; return { pts: seg(C - lean, 4.5, C + lean, 19.5), taper: 0.22 }; }],
  ['ring', (r) => { const a0 = r.take(3) * 45, span = 235 + r.take(2) * 25; return { pts: arc(C, C, 6.6, a0, a0 + span, 48), taper: 0.2 }; }],
  ['crescent', (r) => { const a0 = r.take(3) * 45, span = 140 + r.take(2) * 15; return { pts: arc(C, C, 7.4, a0, a0 + span), taper: 0.3 }; }],
  ['slash', (r) => { const k = r.take(1) ? 1.2 : 0; return { pts: seg(5 + k, 19, 19 - k, 5), taper: 0.26 }; }],
  ['chevron', (r) => { const d = 4 + r.take(1) * 2; return { pts: path([[6, C - d], [C, C + d], [18, C - d]]), taper: 0.16 }; }],
  ['hook', (r) => { const top = 8.5 + r.take(1) * 2; return { pts: seg(C, 19.5, C, top, 16).concat(arc(C + 3, top, 3, 180, 360, 16).slice(1)), taper: 0.2 }; }],
  ['wave', (r) => {
    const ph = r.take(1) * Math.PI, amp = 2.4 + r.take(1);
    const p = [];
    for (let i = 0; i <= 40; i++) { const t = i / 40; p.push([4.5 + 15 * t, C + amp * Math.sin(t * Math.PI * 2 + ph)]); }
    return { pts: p, taper: 0.24 };
  }],
  ['angle', (r) => { const k = r.take(1) * 2; return { pts: path([[6 + k, 5], [6 + k, 18], [18, 18]]), taper: 0.14 }; }],
];

/* the second stroke, finer; the first two choices leave it out, so about a quarter of sigils are one stroke */
const SECOND = [
  null, null,
  ['crossbar', (r) => { const y = NODES[r.take(2) % 3]; return { pts: seg(7, y, 17, y, 16), taper: 0.3 }; }],
  /* a flick from the rim, leaning inward, so it never leaves the grid */
  ['tick', (r) => { const [x, y] = GRAIN_AT[r.take(3)]; const a = Math.atan2(C - y, C - x) + (r.take(2) - 1.5) * 0.5; return { pts: seg(x, y, x + 3.6 * Math.cos(a), y + 3.6 * Math.sin(a), 10), taper: 0.42 }; }],
  ['eyelet', (r) => { const x = NODES[r.take(2) % 3], y = NODES[r.take(2) % 3]; return { pts: arc(x, y, 2.3, 0, 350, 20), taper: 0.1 }; }],
  ['halo', (r) => { const a0 = r.take(3) * 45; return { pts: arc(C, C, 9.6, a0, a0 + 70, 24), taper: 0.36 }; }],
  ['bar', (r) => { const x = NODES[r.take(2) % 3]; return { pts: seg(x, 8, x, 16, 14), taper: 0.3 }; }],
  ['ticks', (r) => { const y = NODES[r.take(2) % 3] - 1.5; return { pts: seg(15, y, 18, y + 3, 8).concat(seg(17.6, y + 3.4, 17.7, y + 3.5, 1)), taper: 0.42 }; }],
];
const COUNT = ['no grains', 'one grain', 'two grains', 'three grains'];

function transform(pts, mirror, turns) {
  return pts.map(([x, y]) => {
    if (mirror) x = 24 - x;
    for (let i = 0; i < turns; i++) { const nx = 24 - y, ny = x; x = nx; y = ny; }
    return [+x.toFixed(3), +y.toFixed(3)];
  });
}

export function sigilSpec(token) {
  const r = bitReader('sigil:' + token);
  const [mainName, mainFn] = MAIN[r.take(3)];
  const main = mainFn(r);
  const second = SECOND[r.take(3)];
  const sec = second ? second[1](r) : null;
  const nGrains = r.take(2);
  const picks = [];
  for (let i = 0; i < nGrains; i++) {
    let k = r.take(4) % GRAIN_AT.length;
    while (picks.includes(k)) k = (k + 1) % GRAIN_AT.length;
    picks.push(k);
  }
  const mirror = r.take(1), turns = r.take(2);
  const seeds = [r.take(16) + 1, r.take(16) + 1, r.take(16) + 1];
  const strokes = [{ pts: transform(main.pts, mirror, turns), w: 1.8, seed: seeds[0], taper: main.taper }];
  if (sec) strokes.push({ pts: transform(sec.pts, mirror, turns), w: 1.15, seed: seeds[1], taper: sec.taper });
  const grains = picks.map((k, i) => {
    const [x, y] = transform([GRAIN_AT[k]], mirror, turns)[0];
    return { x, y, seed: (seeds[2] + i * 977) >>> 0 };
  });
  return { strokes, grains, parts: [mainName].concat(second ? [second[0]] : [], nGrains ? [COUNT[nGrains]] : []) };
}

export function sigilLabel(token) {
  return 'sigil: ' + sigilSpec(token).parts.join(', ');
}

const cache = new Map();
export function sigilSVG(token, A) {
  A = A || globalThis.Aphesis;
  const key = String(token);
  if (cache.has(key)) return cache.get(key);
  const s = sigilSpec(key);
  let d = '';
  s.strokes.forEach((k) => { d += A.brush(k.pts, k.w, k.seed, k.taper, 0.08); });
  let g = '';
  /* a grain is a small cluster of stipple cells, as in the icons' fill (size .42 to .95 on the grid) */
  s.grains.forEach((k) => { g += A.stipple((x, y) => (x - k.x) ** 2 + (y - k.y) ** 2 < 1.45 * 1.45, k.seed, 1600, 0.8); });
  const svg = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" style="overflow:visible"><path d="' + d + '" fill="currentColor"/>' +
    (g ? '<path d="' + g + '" fill="currentColor" opacity=".85"/>' : '') + '</svg>';
  cache.set(key, svg);
  return svg;
}
