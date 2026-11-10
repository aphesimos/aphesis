/* book · liber, as it will stand inside the site: the fog thins to a section's ground, the seal holds the corner,
   the eye the bottom-left, the passage corner stays free. One entry at a time, as a spread: the picture page and the
   text page. Turning the leaf dissolves one simulacrum into the next. */

import { ENTRIES, MAPS } from './entries.js';
import { travel } from './motion.js';
import { roman } from './numerals.js';
import { createPlate } from './plate.js';
import { createLeaf } from './leaf.js';
import { createTurning } from './turning.js';

const A = window.Aphesis;
const $ = (id) => document.getElementById(id);
const root = document.documentElement;
const n = ENTRIES.length;

/* ---------- theme: the system's setting until the eye says otherwise ---------- */
const sysDark = matchMedia('(prefers-color-scheme: dark)');
const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : sysDark.matches);
function themeState() {
  root.classList.toggle('is-dark', isDark());
  $('bTheme').dataset.tip = isDark() ? 'closed · open the eye' : 'open · close the eye';
}
document.querySelector('#bTheme .eye.open').innerHTML = A.icon('eye', 0);
document.querySelector('#bTheme .eye.closed').innerHTML = A.icon('eye', 1);
themeState();
sysDark.addEventListener('change', themeState);
/* the switch is the design system's stipple wave from the eye where the runtime has it; otherwise it is immediate */
$('bTheme').addEventListener('click', () => {
  const b = $('bTheme').getBoundingClientRect();
  (A.themeShift || ((f) => f()))(() => { root.dataset.theme = isDark() ? 'light' : 'dark'; themeState(); },
    { origin: [b.left + b.width / 2, b.top + b.height / 2] });
});

/* ---------- ground, seal, cursor, tooltip ---------- */
/* the section enters as it will from the home: the fog thins from 1 to .62 and its pointer light from 1 to .4 */
const fog = A.Fog($('fog'), { density: 1, light: 1 });
travel(1800, (e) => fog.set({ density: 1 - 0.38 * e, light: 1 - 0.6 * e }));
A.seal($('seal'));
A.cursor();
A.tooltip();
fog.zones([
  { el: $('seal'), pad: 10 }, { el: $('controls'), pad: 8 }, { el: $('head'), pad: 26 }, { el: document.querySelector('#head .gloss-title'), pad: 14 },
  { el: $('entry'), pad: 20 }, { el: $('index'), pad: 20 }, { el: $('foot'), pad: 14 }, { el: $('caption'), pad: 12 },
]);

/* the spine between the two pages: one long brush stroke in the decorative line colour */
$('spine').innerHTML = '<path d="' + A.brush(A.line(4, 2, 4.4, 398, 160), 1.15, 97, 0.32, 0.05) + '" fill="currentColor"/>';

/* ---------- the spread ---------- */
/* an entry may crop its density map (to lose a frame the map still carries), soften it (so hatching becomes tone)
   and set its levels (so a lit mass stands out of even line work) */
function prepare(img, e) {
  if (!e.crop && !e.blur && !e.contrast && !e.brightness) return img;
  const [x, y, w, h] = e.crop || [0, 0, img.naturalWidth, img.naturalHeight];
  const c = document.createElement('canvas');
  c.width = Math.round(w); c.height = Math.round(h);
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  const f = (e.blur ? 'blur(' + e.blur + 'px) ' : '') + (e.brightness ? 'brightness(' + e.brightness + ') ' : '') +
    (e.contrast ? 'contrast(' + e.contrast + ')' : '');
  if (f) g.filter = f.trim();
  g.drawImage(img, x, y, w, h, 0, 0, c.width, c.height);
  return c;
}

const announceEl = $('announce');
const announce = (t) => { announceEl.textContent = ''; setTimeout(() => { announceEl.textContent = t; }, 60); };

Promise.all(ENTRIES.map((e) => new Promise((resolve) => {
  const im = new Image();
  im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => resolve(im));
  im.onerror = () => resolve(null);
  im.src = MAPS[e.map];
}))).then((images) => {
  const pictures = ENTRIES.map((e, i) => {
    const p = { src: images[i] ? prepare(images[i], e) : document.createElement('canvas') };
    ['gain', 'scatter', 'erosion', 'ceiling'].forEach((k) => { if (e[k] !== undefined) p[k] = e[k]; });
    return p;
  });
  const plate = createPlate($('plate'), pictures, $('fog'));
  const leaf = createLeaf(ENTRIES, { onChoose: (i) => go(i) });
  let cur = -1;

  function go(i, { initial = false } = {}) {
    i = Math.max(0, Math.min(n - 1, i));
    if (i === cur) return;
    cur = i;
    const e = ENTRIES[i];
    leaf.show(i);
    plate.to(i);
    const cap = $('caption');
    cap.classList.remove('on');
    setTimeout(() => { if (cur === i) { cap.textContent = e.caption; cap.classList.add('on'); } }, initial ? 900 : 500);
    $('plate').setAttribute('aria-label', e.caption);
    [[$('prev'), i === 0, i > 0 && ENTRIES[i - 1]], [$('next'), i === n - 1, i < n - 1 && ENTRIES[i + 1]]].forEach(([b, end, other]) => {
      if (end && document.activeElement === b) (b.id === 'prev' ? $('next') : $('prev')).focus({ preventScroll: true });
      b.classList.toggle('end', end);
      b.tabIndex = end ? -1 : 0;
      b.setAttribute('aria-hidden', String(end));
      if (other) {
        const label = (b.id === 'prev' ? 'the previous leaf · ' : 'the next leaf · ') + other.title;
        b.dataset.tip = label; b.setAttribute('aria-label', label);
      }
    });
    root.dataset.entry = e.slug;
    const h = '#book/' + e.slug;
    if (location.hash !== h) { try { history.replaceState(null, '', h); } catch (err) { /* a sandbox may refuse */ } }
    if (!initial) announce(roman(i + 1) + ' of ' + roman(n) + ': ' + e.title + ', ' + e.author);
  }

  function fromHash() {
    const m = /^#book\/(.+)$/.exec(location.hash);
    const i = m ? ENTRIES.findIndex((e) => e.slug === decodeURIComponent(m[1])) : -1;
    return i;
  }

  createTurning({
    prev: $('prev'), next: $('next'),
    onTurn: (d) => { if (leaf.open) leaf.close(false); go(cur + d); },
  });
  addEventListener('hashchange', () => { const i = fromHash(); if (i >= 0) go(i); });
  addEventListener('resize', () => plate.place());

  root.classList.add('ready');
  go(Math.max(0, fromHash()), { initial: true });
  window.__book = { go: (i) => go(i), get cur() { return cur; }, get states() { return plate.states; } };
});
