/* density: an uploaded picture becomes a density map in the browser, before anything is sent.
   Forum pictures carry information, so the map is prepared to stay legible (the owner's rule: only hermetic
   simulacra keep "never picture-perfect"; a forum picture must read at a glance, while staying stipple):
   - grayscale, white = dense, 640px on the long side (the Worker's limit; never enlarged past the source, at
     least 480), cut to no more than 2:1 either way so a screenshot keeps its edges;
   - flat borders and frames are trimmed, at most 12% a side;
   - a light ground (a screenshot, a page, an engraving, a photo on white) is inverted, so the figure or the text
     becomes light on dark, the way a simulacrum draws it;
   - auto levels: black point at the 1st percentile, white at the 99.5th, gamma set so the median tone lands near
     0.42 (dark pictures are lifted, flat ones spread);
   - an unsharp mask (radius 1px, amount .4; the runtime's legible preset adds its own mild one on top, with auto
     levels and a contrast curve, when it uploads the map) so edges and letters survive the stipple; except for hatching (an
     engraving, a halftone: fine detail everywhere, mean high-frequency energy above .05), which is softened instead
     (a ~1.5px blur) so its lines become tone, as the design system says;
   - a black margin of 5% around the picture, so the simulacrum's soft edge falls on the margin, not on the content.
   prepareMap(file, {mode: 'hermetic'}) gives the design system's original preparation instead (30th percentile,
   gamma 0.8, a 1px blur on light grounds), kept for comparison.
   The original file goes up beside the map, untouched, so it stays a click away. */

export const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const MAX_BYTES = 4 * 1024 * 1024;
const LONG = 640, MIN_LONG = 480, MAX_MAP = 380 * 1024;

export function checkFile(file) {
  if (!file) return 'no file';
  if (!ACCEPT.includes(file.type)) return 'only jpeg, png, webp or gif';
  if (file.size > MAX_BYTES) return 'images up to 4 mb';
  return '';
}

async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file); } catch (_) { /* fall through to <img> */ }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const im = new Image(); im.onload = () => resolve(im); im.onerror = () => reject(new Error('decode')); im.src = url;
    });
  } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}

function luminance(data) {
  const n = data.length / 4, out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255;
  return out;
}

/* trim flat borders: rows and columns from each edge whose tone barely varies, at most 12% a side */
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

/* soften: one 3×3 binomial blur in place */
function soften(lum, w, h) {
  const tmp = new Float32Array(lum.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; tmp[i] = (lum[i - (x > 0 ? 1 : 0)] + 2 * lum[i] + lum[i + (x < w - 1 ? 1 : 0)]) / 4;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; lum[i] = (tmp[i - (y > 0 ? w : 0)] + 2 * tmp[i] + tmp[i + (y < h - 1 ? w : 0)]) / 4;
  }
}

/* high-frequency energy: the mean difference between each pixel and its 3×3 neighbourhood */
function energy(lum, w, h) {
  let sum = 0, n = 0;
  for (let y = 1; y < h - 1; y += 2) for (let x = 1; x < w - 1; x += 2) {
    const i = y * w + x;
    const m = (lum[i - 1] + lum[i + 1] + lum[i - w] + lum[i + w] + lum[i - w - 1] + lum[i - w + 1] + lum[i + w - 1] + lum[i + w + 1] + lum[i]) / 9;
    sum += Math.abs(lum[i] - m); n++;
  }
  return n ? sum / n : 0;
}

/* unsharp mask on a luminance array: v + amount * (v - blur3x3(v)), twice-separable box blur for a ~1px radius */
function sharpen(lum, w, h, amount) {
  const tmp = new Float32Array(lum.length), bl = new Float32Array(lum.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, a = lum[i - (x > 0 ? 1 : 0)], b = lum[i + (x < w - 1 ? 1 : 0)];
    tmp[i] = (a + 2 * lum[i] + b) / 4;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, a = tmp[i - (y > 0 ? w : 0)], b = tmp[i + (y < h - 1 ? w : 0)];
    bl[i] = (a + 2 * tmp[i] + b) / 4;
  }
  for (let i = 0; i < lum.length; i++) lum[i] = Math.max(0, Math.min(1, lum[i] + amount * (lum[i] - bl[i])));
}

function percentile(sorted, p) { return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))]; }

/* file -> {blob (image/jpeg), url (a data: URL of the map), width, height} */
export function toDensity(file) { return prepareMap(file, {}); }

export async function prepareMap(file, { mode = 'legible' } = {}) {
  const hermetic = mode === 'hermetic';
  const src = await decode(file);
  const sw = src.width || src.naturalWidth, sh = src.height || src.naturalHeight;
  if (!sw || !sh) throw new Error('decode');
  /* a small working copy to find the borders and the ground */
  const ws = Math.min(1, 320 / Math.max(sw, sh));
  const pw = Math.max(1, Math.round(sw * ws)), ph = Math.max(1, Math.round(sh * ws));
  const probe = document.createElement('canvas'); probe.width = pw; probe.height = ph;
  const px = probe.getContext('2d', { willReadFrequently: true });
  px.drawImage(src, 0, 0, pw, ph);
  const plum = luminance(px.getImageData(0, 0, pw, ph).data);
  let [bx, by, bw, bh] = trimBox(plum, pw, ph);
  /* the ground: the mean tone of a band just inside the trimmed edge */
  let edge = 0, en = 0;
  for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) {
    const e = Math.min(x - bx, bx + bw - 1 - x, y - by, by + bh - 1 - y);
    if (e < Math.max(2, Math.min(bw, bh) * 0.06)) { edge += plum[y * pw + x]; en++; }
  }
  const lightGround = en > 0 && edge / en > 0.6;
  /* back to source pixels, then cut to 3:2 at most, about the centre */
  let cx = bx / ws, cy = by / ws, cw = bw / ws, ch = bh / ws;
  const ratio = cw / ch;
  const maxR = hermetic ? 1.5 : 2;
  if (ratio > maxR) { const nw = ch * maxR; cx += (cw - nw) / 2; cw = nw; }
  if (ratio < 1 / maxR) { const nh = cw * maxR; cy += (ch - nh) / 2; ch = nh; }
  const long = Math.min(hermetic ? 560 : LONG, Math.max(MIN_LONG, Math.max(cw, ch)));
  const PAD = hermetic ? 0 : 0.05;
  const s = long / (1 + 2 * PAD) / Math.max(cw, ch);
  const IW = Math.max(1, Math.round(cw * s)), IH = Math.max(1, Math.round(ch * s));
  const P = Math.round(Math.max(IW, IH) * PAD), W = IW + 2 * P, H = IH + 2 * P;
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const ox = out.getContext('2d', { willReadFrequently: true });
  ox.imageSmoothingQuality = 'high';
  if (lightGround && hermetic) ox.filter = 'blur(1px)';
  ox.fillStyle = lightGround ? '#fff' : '#000'; ox.fillRect(0, 0, W, H);   /* the margin reads as ground */
  ox.drawImage(src, cx, cy, cw, ch, P, P, IW, IH);
  ox.filter = 'none';
  if (src.close) src.close();
  const img = ox.getImageData(0, 0, W, H);
  const lum = luminance(img.data);
  if (lightGround) for (let i = 0; i < lum.length; i++) lum[i] = 1 - lum[i];
  if (!hermetic) {
    if (energy(lum, W, H) > 0.05) { for (let k = 0; k < 3; k++) soften(lum, W, H); } else sharpen(lum, W, H, 0.4);
  }
  const sorted = Float32Array.from(lum).sort();
  const lo = percentile(sorted, hermetic ? 0.30 : 0.01);
  const hi = Math.max(lo + 0.02, percentile(sorted, hermetic ? 0.975 : 0.995));
  let gamma = 0.8;
  if (!hermetic) {
    const med = Math.max(0.02, Math.min(0.98, (percentile(sorted, 0.5) - lo) / (hi - lo)));
    gamma = Math.max(0.55, Math.min(1.6, Math.log(0.42) / Math.log(med)));
  }
  for (let i = 0; i < lum.length; i++) {
    const v = Math.pow(Math.max(0, Math.min(1, (lum[i] - lo) / (hi - lo))), gamma) * 255;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
  }
  ox.putImageData(img, 0, 0);
  /* the lightest JPEG that keeps the map under the Worker's limit */
  let q = 0.88, blob = null;
  for (; q >= 0.5; q -= 0.08) {
    blob = await new Promise((resolve, reject) => out.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', q));
    if (blob.size <= MAX_MAP) break;
  }
  const url = out.toDataURL('image/jpeg', Math.max(0.5, q));
  return { blob, url, width: W, height: H, inverted: lightGround };
}
