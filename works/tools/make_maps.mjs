/* Make the density maps in works/maps/ from each work's own visuals.

   Each source is drawn white on black in a headless Chromium canvas, blurred a little so flat logo edges become
   tone, cropped to the figure with a margin of ground, scaled to 640px on the long side and given levels
   (system/README.md, "Density maps": white = dense, dark ground, no frames).

   Sources are read with `git show`, never copied or checked out:
     heild    the heild wordmark (HE · the I pill · LD), design-system/logos/heild-wordmark-papel.svg on the
              `origin/design-system` branch of the heild repository (path in HEILD_REPO, default ../../heild)
     aphesis  the φ, system/assets/Logos/phi.svg on this repository's `design-system` branch
     contraprova  the governed cascade, assets/readme/cascade-dark.svg on `origin/main` of the contraprova
              repository (path in CONTRAPROVA_REPO, default ../../contraprova), with its words, its fog and its
              typing cursor taken out: the edges and the seven brush icons are left
     anamnesis  the demo brain, its 1,100 entries at their own anatomy coordinates, seen from the front as its
              README hero sees it (x, -1.05 y), demo/transcendentalist/snapshot/views.json.gz on `origin/main` of
              the anamnesis repository (path in ANAMNESIS_REPO, default ../../anamnesis)
     heuresis the pipeline in its README.md (the first fenced block) on `origin/main` of the heuresis repository (path
              in HEURESIS_REPO, default ../../heuresis), drawn cell by cell with no font: a word is a row of soft
              cells, ─ and │ are thin bars, ► ▼ ▲ are bright points

     NODE_PATH=$(npm root -g) node works/tools/make_maps.mjs [id ...]   (needs the `playwright` package and its
     Chromium; with ids, only those maps are made)
*/
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { gunzipSync } from 'node:zlib';
/* required, not imported, so a global install found through NODE_PATH works too */
const { chromium } = createRequire(import.meta.url)('playwright');

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const OUT = join(REPO, 'works', 'maps');
const HEILD = process.env.HEILD_REPO || resolve(REPO, '..', 'heild');
const CONTRAPROVA = process.env.CONTRAPROVA_REPO || resolve(REPO, '..', 'contraprova');
const ANAMNESIS = process.env.ANAMNESIS_REPO || resolve(REPO, '..', 'anamnesis');
const HEURESIS = process.env.HEURESIS_REPO || resolve(REPO, '..', 'heuresis');

const show = (repo, spec) => execFileSync('git', ['-C', repo, 'show', spec], { encoding: 'utf8' });
const showBytes = (repo, spec) => execFileSync('git', ['-C', repo, 'show', spec], { maxBuffer: 1 << 26 });
/* every fill becomes white: the map only keeps where the mark is */
const white = (svg) => svg.replace(/fill="#[0-9a-fA-F]{3,8}"/g, 'fill="#fff"');

/* the cascade without its words (<text>), its fog (the .4 stipple layers) and the typing cursor; the edges
   (ink-soft) and icons (accent) become white, the ground black (the discs behind the icons go); cropped to the figure */
function cascade(svg) {
  return svg
    .replace(/<text\b[^>]*>[^<]*<\/text>/g, '')
    .replace(/<path d="[^"]*" fill="#e8e3e3" opacity="0.4">[\s\S]*?<\/path>/g, '')
    .replace(/<rect [^>]*visibility="hidden">[\s\S]*?<\/rect>/g, '')
    .replace('viewBox="0 0 1200 470" width="1200" height="470"', 'viewBox="70 60 930 370" width="930" height="370"')
    .replace(/fill="#050404"/g, 'fill="#000"')
    .replace(/fill="#(857e7e|d43031)"/g, 'fill="#fff"')
    /* thickened, so the thin edges and the small icons read as a figure the simulacrum can gather */
    .replace('</svg>', '<style>path{stroke:#fff;stroke-width:7px;stroke-linejoin:round}circle[fill="#000"]{display:none}</style></svg>');
}

/* the demo brain: one dot per entry at its anatomy (x, y), y up as in the README hero */
function brain(views) {
  const pts = views.anatomy.map(([x, y]) => [x, -1.05 * y]);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys), k = 1000 / (Math.max(...xs) - x0);
  const w = 1000, h = Math.round((Math.max(...ys) - y0) * k);
  const dots = pts.map(([x, y]) => `<circle cx="${((x - x0) * k).toFixed(1)}" cy="${((y - y0) * k).toFixed(1)}" r="13"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 ${w + 20} ${h + 20}" width="${w + 20}" height="${h + 20}"><g fill="#fff" fill-opacity=".4">${dots}</g></svg>`;
}

/* a text diagram, one character cell (12 x 20) at a time, so the map needs no font */
function diagram(md) {
  const lines = md.split('```')[1].split('\n').slice(1).filter((l, i, a) => i < a.length - 1 || l.trim());
  const W = 12, H = 20, cols = Math.max(...lines.map((l) => [...l].length));
  const cells = [];
  lines.forEach((l, r) => [...l].forEach((ch, c) => {
    const x = c * W, y = r * H;
    if (ch === ' ') return;
    if (ch === '─') cells.push(`<rect x="${x}" y="${y + 7}" width="${W}" height="6"/>`);
    else if (ch === '│') cells.push(`<rect x="${x + 3}" y="${y}" width="6" height="${H}"/>`);
    else if ('►▼▲'.includes(ch)) cells.push(`<rect x="${x}" y="${y + 2}" width="${W}" height="${H - 4}"/>`);
    else cells.push(`<rect x="${x}" y="${y + 4}" width="${W}" height="${H - 8}" fill-opacity=".8"/>`);
  }));
  const w = cols * W, h = lines.length * H;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#000"/><g fill="#fff">${cells.join('')}</g></svg>`;
}

const ALL = {
  heild: () => ({ svg: white(show(HEILD, 'origin/design-system:design-system/logos/heild-wordmark-papel.svg')),
    height: 300, blur: 2.2, margin: 0.16, gamma: 1.1 }),
  aphesis: () => ({ svg: white(show(REPO, 'design-system:system/assets/Logos/phi.svg')),
    height: 560, blur: 1.6, margin: 0.12, gamma: 1.1 }),
  contraprova: () => ({ svg: cascade(show(CONTRAPROVA, 'origin/main:assets/readme/cascade-dark.svg')),
    height: 370, blur: 2, margin: 0.06, gamma: 1.0 }),
  anamnesis: () => ({ svg: brain(JSON.parse(gunzipSync(showBytes(ANAMNESIS, 'origin/main:demo/transcendentalist/snapshot/views.json.gz')))),
    height: 560, blur: 6, margin: 0.1, gamma: 0.9 }),
  heuresis: () => ({ svg: diagram(show(HEURESIS, 'origin/main:README.md')), height: 300, blur: 3, margin: 0.06, gamma: 0.9 }),
};
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(ALL);
const MAPS = ids.map((id) => { if (!ALL[id]) throw new Error('no map called ' + id); return { id, ...ALL[id]() }; });

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
