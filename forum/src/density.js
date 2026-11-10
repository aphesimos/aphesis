/* density: an uploaded picture becomes a density map in the browser, before anything is sent.
   The design system's rules for maps (system/README.md, "Simulacra"):
   - grayscale, white = dense, 480 to 640px on the long side (here 560, never enlarged past the source);
   - crop to the figure: flat borders and frames are trimmed, and the picture is cut to no more than 3:2 either way;
   - levels: black point at the 30th percentile, white point at the 97.5th, gamma 0.8 (lifts the half-tones);
   - a light ground (an engraving, a photo on white) is inverted, blurred 1px first so hatching becomes tone,
     because a simulacrum needs its figure light on a dark ground.
   The original file goes up beside the map, untouched, so it stays a click away. */

export const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const MAX_BYTES = 4 * 1024 * 1024;
const LONG = 560, MIN_LONG = 480;

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

function percentile(sorted, p) { return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))]; }

/* file -> {blob (image/jpeg), url (a data: URL of the map), width, height} */
export async function toDensity(file) {
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
  if (ratio > 1.5) { const nw = ch * 1.5; cx += (cw - nw) / 2; cw = nw; }
  if (ratio < 2 / 3) { const nh = cw * 1.5; cy += (ch - nh) / 2; ch = nh; }
  const long = Math.min(LONG, Math.max(MIN_LONG, Math.max(cw, ch)));
  const s = long / Math.max(cw, ch);
  const W = Math.max(1, Math.round(cw * s)), H = Math.max(1, Math.round(ch * s));
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const ox = out.getContext('2d', { willReadFrequently: true });
  ox.imageSmoothingQuality = 'high';
  if (lightGround) ox.filter = 'blur(1px)';
  ox.drawImage(src, cx, cy, cw, ch, 0, 0, W, H);
  ox.filter = 'none';
  if (src.close) src.close();
  const img = ox.getImageData(0, 0, W, H);
  const lum = luminance(img.data);
  if (lightGround) for (let i = 0; i < lum.length; i++) lum[i] = 1 - lum[i];
  const sorted = Float32Array.from(lum).sort();
  const lo = percentile(sorted, 0.30), hi = Math.max(lo + 0.02, percentile(sorted, 0.975));
  for (let i = 0; i < lum.length; i++) {
    const v = Math.pow(Math.max(0, Math.min(1, (lum[i] - lo) / (hi - lo))), 0.8) * 255;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
  }
  ox.putImageData(img, 0, 0);
  const blob = await new Promise((resolve, reject) => out.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', 0.86));
  const url = out.toDataURL('image/jpeg', 0.86);
  return { blob, url, width: W, height: H, inverted: lightGround };
}
