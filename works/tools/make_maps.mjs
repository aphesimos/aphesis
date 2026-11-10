/* Make the density maps in works/maps/ from each work's own visuals.

   Each source is drawn white on black in a headless Chromium canvas, blurred a little so flat logo edges become
   tone, cropped to the figure with a margin of ground, scaled to 640px on the long side and given levels
   (system/README.md, "Density maps": white = dense, dark ground, no frames).

   Sources are read with `git show`, never copied or checked out:
     heild    the heild wordmark (HE · the I pill · LD), design-system/logos/heild-wordmark-papel.svg on the
              `origin/design-system` branch of the heild repository (path in HEILD_REPO, default ../../heild)
     aphesis  the φ, system/assets/Logos/phi.svg on this repository's `design-system` branch

     NODE_PATH=$(npm root -g) node works/tools/make_maps.mjs   (needs the `playwright` package and its Chromium)
*/
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
/* required, not imported, so a global install found through NODE_PATH works too */
const { chromium } = createRequire(import.meta.url)('playwright');

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const OUT = join(REPO, 'works', 'maps');
const HEILD = process.env.HEILD_REPO || resolve(REPO, '..', 'heild');

const show = (repo, spec) => execFileSync('git', ['-C', repo, 'show', spec], { encoding: 'utf8' });
/* every fill becomes white: the map only keeps where the mark is */
const white = (svg) => svg.replace(/fill="#[0-9a-fA-F]{3,8}"/g, 'fill="#fff"');

const MAPS = [
  { id: 'heild', svg: white(show(HEILD, 'origin/design-system:design-system/logos/heild-wordmark-papel.svg')),
    height: 300, blur: 2.2, margin: 0.16, gamma: 1.1 },
  { id: 'aphesis', svg: white(show(REPO, 'design-system:system/assets/Logos/phi.svg')),
    height: 560, blur: 1.6, margin: 0.12, gamma: 1.1 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
mkdirSync(OUT, { recursive: true });
for (const m of MAPS) {
  const data = await page.evaluate(async ({ svg, height, blur, margin, gamma }) => {
    const img = new Image();
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    await img.decode();
    const w = Math.round(height * img.naturalWidth / img.naturalHeight), pad = Math.round(Math.max(w, height) * margin);
    const c = document.createElement('canvas'); c.width = w + pad * 2; c.height = height + pad * 2;
    const x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
    x.filter = `blur(${blur}px)`; x.drawImage(img, pad, pad, w, height); x.filter = 'none';
    /* 640px on the long side */
    const k = 640 / Math.max(c.width, c.height), o = document.createElement('canvas');
    o.width = Math.round(c.width * k); o.height = Math.round(c.height * k);
    const y = o.getContext('2d'); y.imageSmoothingQuality = 'high'; y.drawImage(c, 0, 0, o.width, o.height);
    /* levels: black point 4%, white point 96%, gamma; grayscale */
    const d = y.getImageData(0, 0, o.width, o.height), p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      const v = Math.min(1, Math.max(0, (p[i] / 255 - 0.04) / 0.92));
      p[i] = p[i + 1] = p[i + 2] = Math.round(255 * Math.pow(v, gamma)); p[i + 3] = 255;
    }
    y.putImageData(d, 0, 0);
    return o.toDataURL('image/png');
  }, m);
  const file = join(OUT, m.id + '.png');
  writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
  console.log(file);
}
await browser.close();
