/* thumb: a still simulacrum. A density map rendered once into an SVG of square cells, for thread lists and posts,
   where a live WebGL canvas each would be too heavy. It follows the Simulacrum's rules, frozen at one moment:
   lost points around the figure (scatter), fog-shaped holes inside it (erosion), no area completely full (ceiling),
   and a threshold mixed from interleaved gradient noise and a hash. The forum renders it legibly (legible.js:
   little erosion and scatter, a nearly full ceiling, a threshold closer to ordered dither, so tones and edges read).
   Cells are square CSS-pixel cells (2 by default), never smoothed;
   the SVG fills with currentColor at .72, so it takes the theme's fog color and changes with it, without redrawing. */

const A = window.Aphesis;

export function image(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    if (/^https?:/.test(src) && src.indexOf(location.origin) !== 0) im.crossOrigin = 'anonymous';
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('image'));
    im.src = src;
  });
}

const fract = (x) => x - Math.floor(x);
const hash = (x, y) => { const p = fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453); return p; };
function noise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
function fbm(x, y) { let s = 0, a = 0.5; for (let i = 0; i < 4; i++) { s += a * noise(x, y); x = x * 1.6 + y * 1.2; y = -x * 0.75 + y * 1.6; a *= 0.5; } return s / 0.94; }
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* the legible map, as the runtime prepares it for {legible: true} (bundle.js, prepare): auto levels from the 1st to
   the 99.5th percentile, a mild unsharp mask (.6) and a gentle contrast curve, at most 720px on the long side */
function prepare(img) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, sc = Math.min(1, 720 / Math.max(iw, ih));
  const w = Math.max(1, Math.round(iw * sc)), h = Math.max(1, Math.round(ih * sc));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, w, h);
  const id = x.getImageData(0, 0, w, h), px = id.data, n = w * h, g = new Float32Array(n), hist = new Uint32Array(256);
  for (let i = 0; i < n; i++) { const v = px[i * 4] * 0.299 + px[i * 4 + 1] * 0.587 + px[i * 4 + 2] * 0.114; g[i] = v; hist[v | 0]++; }
  const pct = (p) => { let acc = 0; const lim = n * p; for (let j = 0; j < 256; j++) { acc += hist[j]; if (acc >= lim) return j; } return 255; };
  const lo = pct(0.01), hi = Math.max(lo + 1, pct(0.995));
  const b = new Float32Array(n);
  for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
    let s = 0, k = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = y + dy, xq = xx + dx; if (yy >= 0 && yy < h && xq >= 0 && xq < w) { s += g[yy * w + xq]; k++; } }
    b[y * w + xx] = s / k;
  }
  for (let i = 0; i < n; i++) {
    let t = Math.max(0, Math.min(1, ((g[i] + 0.6 * (g[i] - b[i])) - lo) / (hi - lo)));
    t = t * t * (3 - 2 * t) * 0.35 + t * 0.65;
    px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = Math.round(t * 255); px[i * 4 + 3] = 255;
  }
  x.putImageData(id, 0, 0);
  return c;
}

/* img: a loaded density map (white = dense). box: [width, height] in CSS pixels; the picture keeps its aspect
   inside it, with room around for its lost points. Returns {svg, width, height}. */
export function stillSimulacrum(img, box, o = {}) {
  const gain = o.gain ?? 1, scatter = o.scatter ?? 0.5, erosion = o.erosion ?? 0.45, ceiling = o.ceiling ?? 0.8, seed = o.seed ?? 1;
  const alpha = o.alpha ?? 0.72, mixT = o.threshold ?? 0.35, edge = o.feather ?? 0.07, fogMod = o.fogMod ?? 0.36, curve = o.curve ?? 1.15;
  const c = A.cellPx(o.cell || 2);
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const k = Math.min(box[0] / iw, box[1] / ih);
  const gw = Math.max(8, Math.round(iw * k / c)), gh = Math.max(8, Math.round(ih * k / c));
  const pad = Math.round(Math.min(gw, gh) * (scatter > 0.3 ? 0.08 : 0.04));
  const W = gw, H = gh;
  /* the picture in the middle, inset by pad cells, so stray points have somewhere to drift */
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
  x.imageSmoothingQuality = 'high';
  x.drawImage(o.prepare ? prepare(img) : img, pad, pad, W - 2 * pad, H - 2 * pad);
  const px = x.getImageData(0, 0, W, H).data;
  /* the glow: the same picture blurred wide, for the lost points */
  const g = document.createElement('canvas'); g.width = W; g.height = H;
  const gx = g.getContext('2d', { willReadFrequently: true });
  gx.fillStyle = '#000'; gx.fillRect(0, 0, W, H);
  gx.filter = 'blur(' + Math.max(2, Math.round(W * 0.06)) + 'px)';
  gx.drawImage(cv, 0, 0);
  const gp = gx.getImageData(0, 0, W, H).data;
  const sx = seed * 13.37 % 100, sy = seed * 7.77 % 100;
  let d = '';
  for (let j = 0; j < H; j++) {
    let run = -1;
    for (let i = 0; i <= W; i++) {
      let lit = false;
      if (i < W) {
        const q = (j * W + i) * 4;
        const u = (i - pad) / (W - 2 * pad), v = (j - pad) / (H - 2 * pad);
        const inside = u >= 0 && u <= 1 && v >= 0 && v <= 1;
        const feather = inside ? smooth(0, edge, Math.min(u, 1 - u, v, 1 - v)) : 0;
        const im = Math.pow(px[q] / 255, curve) * feather;
        const fog = fbm(i * 0.07 + sx, j * 0.07 + sy);
        const er = smooth(0.28, 0.78, fbm(i * 0.11 + 3.1 + sy, j * 0.11 + sx));
        const pic = gain * im * (1 - fogMod / 2 + fogMod * fog) * (1 + (0.3 + 0.7 * er - 1) * erosion) * ceiling;
        const glow = gp[q] / 255;
        const stray = scatter * (Math.pow(glow, 0.8) * (0.45 + 0.8 * fog) * 0.75 + 0.02 * smooth(0.36, 0.8, fog)) * Math.max(0, Math.min(1, 1 - im * 1.6));
        const ign = fract(52.9829189 * fract(i * 0.06711056 + j * 0.00583715));
        lit = pic + stray > ign + (hash(i + seed, j) - ign) * mixT;
      }
      if (lit && run < 0) run = i;
      if (!lit && run >= 0) { d += 'M' + run + ' ' + j + 'h' + (i - run) + 'v1h' + (run - i) + 'z'; run = -1; }
    }
  }
  const width = +(W * c).toFixed(2), height = +(H * c).toFixed(2);
  const svg = '<svg class="still" viewBox="0 0 ' + W + ' ' + H + '" width="' + width + '" height="' + height +
    '" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><path d="' + d + '" fill="currentColor" opacity="' + alpha + '"/></svg>';
  return { svg, width, height };
}
