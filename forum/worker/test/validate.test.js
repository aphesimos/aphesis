import test from 'node:test';
import assert from 'node:assert/strict';
import { sniff, imageSize, checkText, checkOriginal, checkDensity, LIMITS } from '../src/validate.js';

/* minimal headers of each kind, with a given size */
function png(w, h, pad = 64) {
  const b = new Uint8Array(33 + pad);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const v = new DataView(b.buffer); v.setUint32(16, w); v.setUint32(20, h);
  return b;
}
function jpeg(w, h, pad = 64) {
  const b = new Uint8Array(2 + 18 + 19 + pad);
  b.set([0xff, 0xd8]);
  b.set([0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0], 2);   /* APP0, skipped */
  const o = 20;
  b.set([0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, w >> 8, w & 255, 1], o);
  return b;
}
function gif(w, h) { const b = new Uint8Array(32); b.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, w & 255, w >> 8, h & 255, h >> 8]); return b; }
function webpX(w, h) {
  const b = new Uint8Array(40); const s = (o, t) => [...t].forEach((c, i) => { b[o + i] = c.charCodeAt(0); });
  s(0, 'RIFF'); s(8, 'WEBP'); s(12, 'VP8X');
  b[24] = (w - 1) & 255; b[25] = ((w - 1) >> 8) & 255; b[26] = ((w - 1) >> 16) & 255;
  b[27] = (h - 1) & 255; b[28] = ((h - 1) >> 8) & 255; b[29] = ((h - 1) >> 16) & 255;
  return b;
}

test('types come from the bytes, not the label', () => {
  assert.equal(sniff(png(10, 10)), 'image/png');
  assert.equal(sniff(jpeg(10, 10)), 'image/jpeg');
  assert.equal(sniff(gif(10, 10)), 'image/gif');
  assert.equal(sniff(webpX(10, 10)), 'image/webp');
  assert.equal(sniff(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), null);
  assert.equal(sniff(new TextEncoder().encode('<html><script>alert(1)</script>')), null);
  assert.equal(sniff(new Uint8Array(4)), null);
});

test('sizes are read from headers', () => {
  assert.deepEqual(imageSize(png(560, 420)), { width: 560, height: 420 });
  assert.deepEqual(imageSize(jpeg(480, 640)), { width: 480, height: 640 });
  assert.deepEqual(imageSize(gif(300, 200)), { width: 300, height: 200 });
  assert.deepEqual(imageSize(webpX(1024, 768)), { width: 1024, height: 768 });
  assert.equal(imageSize(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 2, 0, 0, 0, 0, 0, 0])), null);
});

test('originals: type, weight and size', () => {
  assert.equal(checkOriginal(jpeg(2000, 1500)).ok, true);
  assert.equal(checkOriginal(new Uint8Array(0)).ok, false);
  const heavy = new Uint8Array(LIMITS.original + 1); heavy.set(jpeg(10, 10));
  assert.equal(checkOriginal(heavy).ok, false);
  assert.equal(checkOriginal(new TextEncoder().encode('GIF? no, a script pretending to be one....')).ok, false);
  assert.equal(checkOriginal(png(10000, 10000)).ok, false);   /* 100 megapixels */
});

test('density maps: jpeg or png, light, 960 on the long side at most', () => {
  assert.equal(checkDensity(jpeg(960, 540)).ok, true);
  assert.equal(checkDensity(jpeg(961, 540)).ok, false);
  assert.equal(checkDensity(jpeg(560, 420)).ok, true);
  assert.equal(checkDensity(png(640, 480)).ok, true);
  assert.equal(checkDensity(jpeg(1200, 900)).ok, false);
  assert.equal(checkDensity(gif(560, 420)).ok, false);
  assert.equal(checkDensity(webpX(560, 420)).ok, false);
  assert.equal(checkDensity(jpeg(560, 10)).ok, false);
  const heavy = new Uint8Array(LIMITS.density + 1); heavy.set(jpeg(560, 420));
  assert.equal(checkDensity(heavy).ok, false);
  assert.equal(checkDensity(null).ok, false);
});

test('text: cleaned, required, bounded', () => {
  assert.deepEqual(checkText('  hello\r\nworld  \n\n'), { ok: true, text: '  hello\nworld' });
  assert.equal(checkText('   \n ').ok, false);
  assert.equal(checkText('', { required: false }).ok, true);
  assert.equal(checkText('a\u0000b‮c').text, 'abc');
  assert.equal(checkText('x'.repeat(LIMITS.text)).ok, true);
  assert.equal(checkText('x'.repeat(LIMITS.text + 1)).ok, false);
  assert.equal(checkText('a\n'.repeat(LIMITS.lines + 2)).ok, false);
  assert.equal(checkText('a\n\n\n\n\n\nb').text, 'a\n\n\nb');
  assert.equal(checkText('>>12 yes\n>quoted').text, '>>12 yes\n>quoted');
});
