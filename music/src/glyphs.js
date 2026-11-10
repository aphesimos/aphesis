/* glyphs: the section's marks on the design system's 24-unit icon grid, brushed with Aphesis.brush and filled
   with Aphesis.stipple. Each has a fixed seed per stroke, so a mark is the same on every visit, and two states
   where it means something (0 at rest, 1 for the folder, file or artist that holds the track playing). */

const A = window.Aphesis;
const L = (x0, y0, x1, y1, n = 16) => A.line(x0, y0, x1, y1, n);
/* a polyline as one centerline, each leg sampled densely */
const path = (pts, n = 10) => pts.slice(1).reduce((acc, p, i) => acc.concat(L(pts[i][0], pts[i][1], p[0], p[1], n).slice(i ? 1 : 0)), []);
/* a quadratic curve, sampled */
const quad = (p0, c, p1, n = 24) => Array.from({ length: n + 1 }, (_, i) => {
  const t = i / n, u = 1 - t;
  return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]];
});
const inTri = (a, b, c) => (x, y) => {
  const s = (p, q, r) => (x - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (y - r[1]);
  const d1 = s(null, a, b), d2 = s(null, b, c), d3 = s(null, c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
};
const svg = (strokes, dots, dotOpacity = 0.85) =>
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" style="overflow:visible"><path d="' + strokes + '" fill="currentColor"/>' +
  (dots ? '<path d="' + dots + '" fill="currentColor" opacity="' + dotOpacity + '" shape-rendering="crispEdges"/>' : '') + '</svg>';

const DRAW = {
  /* a folder: one stroke round the body and its tab; grains inside, many when it holds the track playing */
  folder: (st) => svg(
    A.brush(path([[3.4, 8.2], [3.4, 19.2], [20.6, 19.2], [20.6, 9.4], [11.6, 9.4], [9.8, 6.6], [3.8, 6.6], [3.4, 7.8]]), 1.5, 201, 0.1),
    A.stipple((x, y) => x > 4.6 && x < 19.4 && y > 10.8 && y < 18, st ? 207 : 205, st ? 900 : 150, st ? 0.7 : 0.6)),
  /* a sound file: a page with its corner folded, a stippled wave across it */
  file: (st) => svg(
    A.brush(path([[5.8, 3.6], [14.4, 3.4], [18.4, 7.4], [18.4, 20.6], [5.6, 20.6], [5.8, 4.6]]), 1.4, 211, 0.1) +
    A.brush(path([[14.2, 3.8], [14.2, 7.6], [18, 7.6]], 8), 1.0, 213, 0.2),
    A.stipple((x, y) => x > 7.2 && x < 16.8 && Math.abs(y - (14.2 + 2.4 * Math.sin((x - 7.2) * 1.05))) < (st ? 1.5 : 1.0), st ? 217 : 215, st ? 1400 : 700, 0.62)),
  /* an artist: a head and the line of the shoulders */
  artist: (st) => svg(
    A.brush(A.arc(12, 8.8, 3.9, -80, 272, 40), 1.5, 221) + A.brush(A.arc(12, 22.4, 7.6, 198, 342, 30), 1.6, 223),
    st ? A.stipple((x, y) => (x - 12) ** 2 + (y - 8.8) ** 2 < 9, 225, 500, 0.7) : ''),
  /* up one folder: a stroke that rises, and the two flicks of its head */
  up: () => svg(A.brush(L(12.4, 20, 12, 5.2, 28), 1.6, 231, 0.3) + A.brush(L(12, 5, 7.4, 10.2, 12), 1.4, 233, 0.38, 0.05) + A.brush(L(12, 5, 16.6, 10.4, 12), 1.4, 235, 0.38, 0.05)),
  /* an album without a cover: a ring with a stippled groove */
  disc: () => svg(A.brush(A.arc(12, 12, 8.2, -80, 272, 56), 1.6, 241) + A.brush(A.arc(12, 12, 1.2, 0, 360, 14), 1.3, 243, 0, 0),
    A.stipple((x, y) => { const r = Math.hypot(x - 12, y - 12); return r > 3.4 && r < 6.6; }, 245, 700, 0.55)),
  play: () => svg(A.brush(path([[7.2, 4.8], [7.2, 19.2], [19.2, 12], [7.6, 4.9]], 14), 1.6, 251, 0.08),
    A.stipple(inTri([8.4, 7], [8.4, 17], [17, 12]), 253, 700, 0.7)),
  pause: () => svg(A.brush(L(8.6, 5, 8.4, 19, 20), 2.1, 261, 0.18) + A.brush(L(15.4, 5.2, 15.6, 19, 20), 2.1, 263, 0.18)),
  prev: () => svg(A.brush(L(5.8, 5.4, 5.8, 18.6, 16), 1.7, 271, 0.2) + A.brush(path([[18.4, 5.6], [8.4, 12], [18.4, 18.4], [18.4, 6.2]], 12), 1.5, 273, 0.08),
    A.stipple(inTri([17.2, 7.8], [10.6, 12], [17.2, 16.2]), 275, 500, 0.62)),
  next: () => svg(A.brush(L(18.2, 5.4, 18.2, 18.6, 16), 1.7, 281, 0.2) + A.brush(path([[5.6, 5.6], [15.6, 12], [5.6, 18.4], [5.6, 6.2]], 12), 1.5, 283, 0.08),
    A.stipple(inTri([6.8, 7.8], [13.4, 12], [6.8, 16.2]), 285, 500, 0.62)),
  /* shuffle: two strokes that cross, each ending in a flick */
  shuffle: () => svg(
    A.brush(quad([3.4, 7], [12, 7.4], [19.6, 16.8]), 1.5, 291, 0.25) + A.brush(quad([3.4, 17], [12, 16.6], [19.6, 7.2]), 1.5, 293, 0.25) +
    A.brush(L(19.8, 16.9, 16.2, 17.4, 8), 1.2, 295, 0.38, 0.05) + A.brush(L(19.8, 16.9, 19.6, 13.4, 8), 1.2, 296, 0.38, 0.05) +
    A.brush(L(19.8, 7.1, 16.2, 6.6, 8), 1.2, 297, 0.38, 0.05) + A.brush(L(19.8, 7.1, 19.6, 10.6, 8), 1.2, 298, 0.38, 0.05)),
  /* volume: a cone and the arcs of the sound */
  volume: (st) => svg(A.brush(path([[3.6, 9.6], [7.4, 9.6], [12, 5.4], [12, 18.6], [7.4, 14.4], [3.6, 14.4], [3.6, 10]], 10), 1.4, 301, 0.08) +
    (st ? '' : A.brush(A.arc(13, 12, 4.2, -50, 50, 18), 1.2, 303, 0.3) + A.brush(A.arc(13, 12, 7.4, -48, 48, 24), 1.2, 305, 0.3)) +
    (st ? A.brush(L(15, 9, 20.4, 15, 10), 1.3, 307, 0.3) + A.brush(L(20.4, 9, 15, 15, 10), 1.3, 309, 0.3) : '')),
};

const cache = new Map();
/* glyph(name, state) -> inline SVG markup in currentColor; size it with CSS */
export function glyph(name, st = 0) {
  const k = name + st;
  if (!cache.has(k)) cache.set(k, DRAW[name](st));
  return cache.get(k);
}

/* a horizontal stroke stretched to its box (only its length changes) */
export function hStroke(seed, width = 1.4) {
  return '<svg viewBox="0 0 240 6" aria-hidden="true" focusable="false" preserveAspectRatio="none"><path d="' +
    A.brush(A.line(2, 3.2, 238, 2.8, 80), width, seed, 0.12, 0.1) + '" fill="currentColor"/></svg>';
}
