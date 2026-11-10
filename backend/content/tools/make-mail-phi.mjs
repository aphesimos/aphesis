#!/usr/bin/env node
// The φ of the gate's email, as stipple: content/assets/mail-phi.png, which the seed puts in the content bucket as
// mail/phi.png. Mail clients run no script and read no web fonts, so the mark arrives as a picture.
//
//   NODE_PATH=$(npm root -g) node backend/content/tools/make-mail-phi.mjs
//
// It reads the φ (system/assets/Logos/phi.svg) and the dark theme's tokens from the design-system branch with
// git, draws the φ in Chromium as a density field and lights square cells where the field passes a fixed threshold
// per cell (the design system's stipple: cells of 2 CSS pixels, here 4 image pixels at 2x, never smoothed), in
// rubedo on the dark ground. Fixed seeds, so the picture is the same on every run.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');   /* NODE_PATH reaches CommonJS only */

const here = path.dirname(fileURLToPath(import.meta.url));
const git = (p) => execFileSync('git', ['-C', here, 'show', `design-system:${p}`], { encoding: 'utf8' });
const svg = git('system/assets/Logos/phi.svg');
const d = svg.match(/ d="([^"]+)"/)[1];
const vb = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
const BG = '#050404', RED = '#d43031';   /* bg (n-975) and accent (rubedo) of the dark theme; see src/mail.rs */

const browser = await chromium.launch();
const page = await browser.newPage();
const png = await page.evaluate(({ d, vb, BG, RED }) => {
  const S = 224, CELL = 4;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  /* the field: the φ in white, softened a little so its edges come apart into cells */
  const [vx, vy, vw, vh] = vb, k = (S * 0.84) / Math.max(vw, vh);
  x.fillStyle = '#000'; x.fillRect(0, 0, S, S);
  x.filter = 'blur(1.6px)';
  x.setTransform(k, 0, 0, k, (S - vw * k) / 2 - vx * k, (S - vh * k) / 2 - vy * k);
  x.fillStyle = '#fff'; x.fill(new Path2D(d), 'evenodd');
  x.setTransform(1, 0, 0, 1, 0, 0); x.filter = 'none';
  const f = x.getImageData(0, 0, S, S).data;
  /* the cells */
  const out = document.createElement('canvas'); out.width = out.height = S;
  const o = out.getContext('2d');
  o.fillStyle = BG; o.fillRect(0, 0, S, S);
  o.fillStyle = RED;
  const hash = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
  for (let j = 0; j < S / CELL; j++) for (let i = 0; i < S / CELL; i++) {
    let sum = 0;
    for (let yy = 0; yy < CELL; yy++) for (let xx = 0; xx < CELL; xx++) sum += f[((j * CELL + yy) * S + i * CELL + xx) * 4];
    const dens = sum / (CELL * CELL * 255);
    /* never full: the ceiling keeps a few holes inside the strokes */
    if (Math.min(dens, 0.86) > 0.08 + hash(i, j) * 0.8) o.fillRect(i * CELL, j * CELL, CELL, CELL);
  }
  return out.toDataURL('image/png');
}, { d, vb, BG, RED });
await browser.close();
const file = path.join(here, '..', 'assets', 'mail-phi.png');
writeFileSync(file, Buffer.from(png.split(',')[1], 'base64'));
console.log(file);
