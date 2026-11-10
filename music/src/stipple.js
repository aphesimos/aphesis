/* stipple: still pictures made of cells, for places a live simulacrum would cost a WebGL context.
   A cover's thumb (24 x 24 grey levels written by sync.py into the index) becomes 2px square cells that light where
   the density passes a fixed threshold, under the same rules as Aphesis.Simulacrum: a ceiling (.8), fog-shaped
   erosion and a few lost points around the figure, so even a thumbnail is never picture-perfect.
   Also: the stippled band of the seek line, and a stippled cover for the phone's lock screen. */

const N = 24;
const decoded = new Map();
function grid(b64) {
  let g = decoded.get(b64);
  if (!g) {
    const s = atob(b64);
    g = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) g[i] = (s.charCodeAt(i) || 0) / 255;
    decoded.set(b64, g);
  }
  return g;
}
function sample(g, u, v) {
  const x = Math.min(N - 1.001, Math.max(0, u * N - 0.5)), y = Math.min(N - 1.001, Math.max(0, v * N - 0.5));
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const a = g[y0 * N + x0], b = g[y0 * N + x0 + 1], c = g[(y0 + 1) * N + x0], d = g[(y0 + 1) * N + x0 + 1];
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}
export function hash(x, y, s = 0) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/* smooth value noise for the erosion */
function vnoise(x, y, s) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0, s), b = hash(x0 + 1, y0, s), c = hash(x0, y0 + 1, s), d = hash(x0 + 1, y0 + 1, s);
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
}

/* cells(b64, n, seed) -> [[i, j], ...] lit cells of an n x n grid */
export function cells(b64, n, seed = 1) {
  const g = grid(b64), out = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, v = (j + 0.5) / n;
      const img = Math.pow(sample(g, u, v), 1.15);
      const glow = (sample(g, u - 0.12, v) + sample(g, u + 0.12, v) + sample(g, u, v - 0.12) + sample(g, u, v + 0.12)) / 4;
      const er = vnoise(i / n * 4.2 + seed, j / n * 4.2, seed);
      const pic = img * 0.8 * (0.62 + 0.55 * er);                     /* ceiling .8, erosion */
      const stray = 0.5 * Math.pow(glow, 0.8) * 0.5 * Math.max(0, 1 - img * 1.6);   /* scatter .5 */
      const ign = (52.9829189 * ((i * 0.06711056 + j * 0.00583715) % 1)) % 1;
      const t = ign * 0.65 + hash(i, j, seed) * 0.35;
      if (pic + stray > t) out.push([i, j]);
    }
  }
  return out;
}

/* thumb(b64, px) -> inline SVG of 2px cells, px x px CSS pixels */
const thumbs = new Map();
export function thumb(b64, px, seed = 7) {
  const k = px + ':' + seed + ':' + b64;
  let s = thumbs.get(k);
  if (!s) {
    const n = Math.round(px / 2);
    let d = '';
    for (const [i, j] of cells(b64, n, seed)) d += 'M' + i * 2 + ' ' + j * 2 + 'h2v2h-2z';
    s = '<svg viewBox="0 0 ' + n * 2 + ' ' + n * 2 + '" width="' + px + '" height="' + px + '" aria-hidden="true" focusable="false" shape-rendering="crispEdges"><path d="' + d + '" fill="currentColor"/></svg>';
    if (thumbs.size > 4000) thumbs.clear();
    thumbs.set(k, s);
  }
  return s;
}

/* band(w, h, seed) -> SVG of a stippled band w x h CSS pixels: dense in the middle rows, thinning at the edges */
export function band(w, h, seed = 3) {
  const cols = Math.max(1, Math.floor(w / 2)), rows = Math.max(1, Math.floor(h / 2));
  let d = '';
  for (let j = 0; j < rows; j++) {
    const c = 1 - Math.abs((j + 0.5) / rows * 2 - 1);
    const p = 0.18 + 0.72 * c;
    for (let i = 0; i < cols; i++) if (hash(i, j, seed) < p) d += 'M' + i * 2 + ' ' + j * 2 + 'h2v2h-2z';
  }
  return '<svg viewBox="0 0 ' + cols * 2 + ' ' + rows * 2 + '" width="' + cols * 2 + '" height="' + rows * 2 + '" aria-hidden="true" focusable="false" shape-rendering="crispEdges"><path d="' + d + '" fill="currentColor"/></svg>';
}

/* artwork(b64, ground, ink) -> a promise of a PNG object URL: the cover in stipple for the lock screen */
export function artwork(b64, ground, ink) {
  return new Promise((resolve) => {
    try {
      const n = 96, s = 4, c = document.createElement('canvas');
      c.width = c.height = n * s;
      const x = c.getContext('2d');
      x.fillStyle = ground; x.fillRect(0, 0, c.width, c.height);
      x.fillStyle = ink;
      for (const [i, j] of cells(b64, n, 11)) x.fillRect(i * s, j * s, s - 1, s - 1);
      c.toBlob((b) => resolve(b ? URL.createObjectURL(b) : null), 'image/png');
    } catch (_) { resolve(null); }
  });
}
