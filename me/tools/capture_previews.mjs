#!/usr/bin/env node
/* Capture the link previews of the works page: a density map of each work's page, as a stipple source.
 *
 *   node me/tools/capture_previews.mjs [id ...]      (needs Playwright; run from anywhere)
 *
 * For each work in content/me.json (or the ids given): open its link at 1280x800, wait for load + 2 s (8 s for aphes.ist, whose φ takes that long to draw), screenshot the
 * viewport and write previews/<id>.png: 8-bit grayscale, 560x350 (16:10), white = dense. The map is prepared as the
 * design system's legible maps are: inverted when the page's ground is light (so ink and content are the dense part),
 * auto levels from the 1st to the 99.5th percentile, a gentle contrast curve and a mild unsharp mask. A site that
 * fails to open falls back to its GitHub repository page (the work's `repo`), and the tool says so.
 * The page build (build.py) turns these maps into the static stipple masks and the live simulacrum's sources. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
let pw;
try { pw = createRequire(import.meta.url)('playwright'); }
catch { pw = createRequire(join(execSync('npm root -g').toString().trim(), '/'))('playwright'); }

const W = 560, H = 350;
/* pages whose first seconds are an entrance get longer (aphes.ist draws its φ for about 7 s) */
const SLOW = { aphesis: 8000 };
const content = JSON.parse(readFileSync(join(root, 'content', 'me.json'), 'utf8'));
let works = content.works.items.map((w) => ({ id: w.id, href: w.href, repo: w.repo }));
const only = process.argv.slice(2);
if (only.length) works = works.filter((w) => only.includes(w.id));
mkdirSync(join(root, 'previews'), { recursive: true });

/* a grayscale PNG, written by hand (no dependencies) */
const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = (b) => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const t = Buffer.from(type), len = Buffer.alloc(4), c = Buffer.alloc(4);
  len.writeUInt32BE(data.length); c.writeUInt32BE(crc(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, c]);
}
function png(gray, w, h) {
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w + 1)] = 0; gray.copy(raw, y * (w + 1) + 1, y * w, (y + 1) * w); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/* the preparation, in a page (canvas does the resampling) */
async function prepare(page, shot) {
  return page.evaluate(async ({ b64, W, H }) => {
    const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, W, H);
    const d = x.getImageData(0, 0, W, H).data, n = W * H, L = new Float32Array(n);
    for (let i = 0; i < n; i++) L[i] = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255;
    /* the ground is the median of the border; a light ground inverts, so the content is what is dense */
    const border = []; for (let i = 0; i < W; i++) { border.push(L[i], L[(H - 1) * W + i]); } for (let j = 0; j < H; j++) { border.push(L[j * W], L[j * W + W - 1]); }
    border.sort((a, b) => a - b); const ground = border[border.length >> 1], invert = ground > 0.5;
    if (invert) for (let i = 0; i < n; i++) L[i] = 1 - L[i];
    const sorted = Float32Array.from(L).sort(), lo = sorted[Math.floor(n * 0.01)], hi = sorted[Math.min(n - 1, Math.floor(n * 0.995))], span = Math.max(1e-3, hi - lo);
    for (let i = 0; i < n; i++) { let v = Math.min(1, Math.max(0, (L[i] - lo) / span)); v = v * v * (3 - 2 * v) * 0.55 + v * 0.45; L[i] = v; }   /* gentle S curve */
    /* a mild unsharp mask: radius 1.5 (a separable box blur, twice), amount .5 */
    const blur = (src) => { const t = new Float32Array(n), o = new Float32Array(n);
      for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) { let s = 0, k = 0; for (let dx = -1; dx <= 1; dx++) { const q = xx + dx; if (q >= 0 && q < W) { s += src[y * W + q]; k++; } } t[y * W + xx] = s / k; }
      for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) { let s = 0, k = 0; for (let dy = -1; dy <= 1; dy++) { const q = y + dy; if (q >= 0 && q < H) { s += t[q * W + xx]; k++; } } o[y * W + xx] = s / k; }
      return o; };
    const b = blur(blur(L)), out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = Math.round(Math.min(1, Math.max(0, L[i] + 0.5 * (L[i] - b[i]))) * 255);
    return { invert, ground, gray: out };
  }, { b64: shot.toString('base64'), W, H });
}

const browser = await pw.chromium.launch();
const blank = await (await browser.newContext()).newPage();
const report = [];
for (const w of works) {
  let used = w.href, note = '';
  const tryOpen = async (url, id = w.id) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    try {
      const r = await page.goto(url, { waitUntil: 'load', timeout: 30000 });
      if (r && r.status() >= 400) throw new Error('HTTP ' + r.status());
      await page.waitForTimeout(SLOW[id] || 2000);
      return { shot: await page.screenshot(), ctx };
    } catch (e) { await ctx.close(); throw e; }
  };
  let res;
  try { res = await tryOpen(w.href); }
  catch (e) {
    note = `failed (${e.message.split('\n')[0]})`;
    if (w.repo && w.repo !== w.href) { used = w.repo; try { res = await tryOpen(w.repo); note += `; fell back to ${w.repo}`; } catch (e2) { note += `; fallback failed too (${e2.message.split('\n')[0]})`; } }
  }
  if (!res) { report.push(`${w.id}: NO PREVIEW ${note}`); continue; }
  await res.ctx.close();
  const p = await prepare(blank, res.shot);
  writeFileSync(join(root, 'previews', w.id + '.png'), png(Buffer.from(p.gray), W, H));
  report.push(`${w.id}: ${used} ground ${p.ground.toFixed(2)}${p.invert ? ' (inverted)' : ''} ${note}`);
}
await browser.close();
console.log(report.join('\n'));
