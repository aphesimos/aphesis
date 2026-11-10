/* validate: what a post may carry. Pure functions over strings and bytes, so they run the same in the Worker and in
   node's test runner.
   - text: up to 2000 characters and 60 lines, control characters removed, line ends normalized;
   - the original picture: jpeg, png, webp or gif, up to 4 MB, its type read from its first bytes (never trusted
     from the upload's own label), with sane dimensions;
   - the density map made in the browser: jpeg or png, up to 400 KB, 64 to 640 pixels on the long side. */

export const LIMITS = {
  text: 2000,
  lines: 60,
  original: 4 * 1024 * 1024,
  density: 400 * 1024,
  densityLong: 640,
  densityShort: 32,
  pixels: 40e6,
};

const SIGS = [
  ['image/jpeg', [0xff, 0xd8, 0xff]],
  ['image/png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  ['image/gif', [0x47, 0x49, 0x46, 0x38]],
];

/* the type a file really is, from its magic bytes, or null */
export function sniff(b) {
  if (!b || b.length < 12) return null;
  for (const [type, sig] of SIGS) if (sig.every((v, i) => b[i] === v)) return type;
  const ascii = (o, n) => String.fromCharCode(...b.subarray(o, o + n));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'image/webp';
  return null;
}

const u16be = (b, o) => (b[o] << 8) | b[o + 1];
const u16le = (b, o) => b[o] | (b[o + 1] << 8);
const u32be = (b, o) => ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];
const u24le = (b, o) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);

/* width and height from the header, or null when they cannot be read */
export function imageSize(b, type = sniff(b)) {
  try {
    if (type === 'image/png') {
      if (String.fromCharCode(...b.subarray(12, 16)) !== 'IHDR') return null;
      return { width: u32be(b, 16), height: u32be(b, 20) };
    }
    if (type === 'image/gif') return { width: u16le(b, 6), height: u16le(b, 8) };
    if (type === 'image/jpeg') {
      let o = 2;
      while (o + 9 < b.length) {
        if (b[o] !== 0xff) { o++; continue; }
        const m = b[o + 1];
        if (m === 0xff) { o++; continue; }
        if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { o += 2; continue; }
        const len = u16be(b, o + 2);
        /* start of frame markers carry the size; c4, c8 and cc are not frames */
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { height: u16be(b, o + 5), width: u16be(b, o + 7) };
        if (len < 2) return null;
        o += 2 + len;
      }
      return null;
    }
    if (type === 'image/webp') {
      const chunk = String.fromCharCode(...b.subarray(12, 16));
      if (chunk === 'VP8 ') return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
      if (chunk === 'VP8L') { const v = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24); return { width: (v & 0x3fff) + 1, height: ((v >>> 14) & 0x3fff) + 1 }; }
      if (chunk === 'VP8X') return { width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
    }
  } catch (_) { /* a short or broken header */ }
  return null;
}

/* the words of a post, cleaned; required: a post with no picture needs words */
export function checkText(raw, { required = true } = {}) {
  let text = String(raw ?? '').replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f​-‏‪-‮⁦-⁩]/g, '')
    .replace(/\n{4,}/g, '\n\n\n').replace(/\s+$/, '').replace(/^\s*\n/, '');
  if (required && !text.trim()) return { ok: false, error: 'a post needs words' };
  if ([...text].length > LIMITS.text) return { ok: false, error: 'at most ' + LIMITS.text + ' characters' };
  if (text.split('\n').length > LIMITS.lines) return { ok: false, error: 'at most ' + LIMITS.lines + ' lines' };
  return { ok: true, text };
}

export function checkOriginal(b) {
  if (!b || !b.length) return { ok: false, error: 'the picture is empty' };
  if (b.length > LIMITS.original) return { ok: false, error: 'pictures up to 4 mb' };
  const type = sniff(b);
  if (!type) return { ok: false, error: 'only jpeg, png, webp or gif' };
  const size = imageSize(b, type);
  if (!size || !size.width || !size.height) return { ok: false, error: 'this picture could not be read' };
  if (size.width * size.height > LIMITS.pixels) return { ok: false, error: 'this picture is too large' };
  return { ok: true, type, ...size };
}

export function checkDensity(b) {
  if (!b || !b.length) return { ok: false, error: 'the density map is missing' };
  if (b.length > LIMITS.density) return { ok: false, error: 'the density map is too heavy' };
  const type = sniff(b);
  if (type !== 'image/jpeg' && type !== 'image/png') return { ok: false, error: 'the density map must be jpeg or png' };
  const size = imageSize(b, type);
  if (!size) return { ok: false, error: 'the density map could not be read' };
  const long = Math.max(size.width, size.height), short = Math.min(size.width, size.height);
  if (long > LIMITS.densityLong || short < LIMITS.densityShort) return { ok: false, error: 'the density map has the wrong size' };
  return { ok: true, type, ...size };
}

export const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' };
