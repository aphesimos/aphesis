/* wall · paries, as it will stand inside the site: the fog thinned for a section, the seal in the corner, the eye
   in the bottom-left, the passage corner kept free, the runtime's cursor and tooltip. Between the title and the
   line to write in, the wall's lines drift through the fog. */

import { createApi } from './api.js';
import { createDrift } from './drift.js';
import { createComposer } from './composer.js';

const A = window.Aphesis;
const $ = (id) => document.getElementById(id);
const root = document.documentElement;

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
/* the switch is a stipple wave from the eye (Aphesis.themeShift); a runtime without it switches at once.
   The fog reads its colours from the theme on its own, so the eye and the root are all there is to set. */
$('bTheme').addEventListener('click', () => {
  const b = $('bTheme').getBoundingClientRect();
  const next = isDark() ? 'light' : 'dark';
  (A.themeShift || ((f) => f()))(() => { root.dataset.theme = next; themeState(); },
    { origin: [b.left + b.width / 2, b.top + b.height / 2] });
});

/* ---------- ground, seal, cursor, tooltip ---------- */
/* the fog canvas stays hidden until it has drawn, so no blank canvas ever shows */
const fogCanvas = $('fog');
const fog = A.Fog(fogCanvas, { density: 0.62, light: 0.4 });
requestAnimationFrame(() => requestAnimationFrame(() => fogCanvas.classList.add('on')));
A.seal($('seal'));
A.cursor();
A.tooltip();

/* ---------- the wall ---------- */
const api = createApi();
root.classList.toggle('preview', !api.live);
const header = $('wallHead'), form = $('composer'), status = $('status');

/* the field the lines may use: between the title and the line to write in, inside the gutters */
function rect() {
  const h = header.getBoundingClientRect(), f = form.getBoundingClientRect();
  const gut = Math.max(16, innerWidth * 0.04);
  const top = h.bottom + 8, bottom = f.top - 12;
  return { left: gut, top, width: innerWidth - gut * 2, height: Math.max(80, bottom - top) };
}

function describe(m) {
  if (m.mine && !api.live) return { tip: 'your line · kept on this device', label: m.text + ', your line, kept on this device' };
  return { tip: '', label: '' };
}

const drift = createDrift($('lines'), { rect, describe });

/* the quiet voice under the line: what just happened, then back to what is always true */
const IDLE = api.live ? '' : 'a preview: your lines stay on this device.';
let quiet = null;
function say(text, refused) {
  clearTimeout(quiet);
  status.textContent = text;
  /* a refusal is red, so it leaves the black-and-white ink while it shows */
  status.classList.toggle('refused', !!refused);
  status.classList.toggle('aph-ink', !refused);
  quiet = setTimeout(() => { status.textContent = IDLE; status.classList.remove('refused'); status.classList.add('aph-ink'); }, refused ? 6000 : 4200);
}
status.textContent = IDLE;
if (!api.live) $('line').dataset.tip = 'one line · no names · preview: it stays on this device';

/* an empty wall is quiet, not broken: one gloss and one line in the middle of the field, until a line arrives */
const hush = $('hush');
let lines = 0;
function quietState() {
  const r = rect();
  hush.style.top = Math.round(r.top + r.height / 2 - hush.offsetHeight / 2) + 'px';
  hush.classList.toggle('on', lines === 0);
  hush.setAttribute('aria-hidden', String(lines > 0));
}

createComposer(form, {
  api, say,
  onSent: (m) => { lines++; quietState(); drift.push(m); $('announce').textContent = 'your line is on the wall: ' + m.text; },
});

api.list().then((ms) => { lines = ms.length; quietState(); drift.set(ms); });
addEventListener('resize', () => { drift.resize(); quietState(); });

/* ---------- calm zones in the fog ---------- */
const fixed = [
  { el: $('controls'), pad: 8 }, { el: $('seal'), pad: 10 },
  { el: header, pad: 16 }, { el: form, pad: 14 },
];
(function zones() {
  fog.zones(fixed.concat(lines ? [] : [{ el: hush, pad: 18 }], drift.zones()).slice(0, 12));
  requestAnimationFrame(zones);
})();
