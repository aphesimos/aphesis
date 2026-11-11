/* wall · paries, as it will stand inside the site: the fog thinned for a section, the seal in the corner, the eye
   in the bottom-left, the passage corner kept free, the runtime's cursor and tooltip. Between the title and the
   line to write in, the wall's lines drift through the fog. */

import { createApi } from './api.js';
import { createDrift, OWNER } from './drift.js';
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
  /* from the layout, not the boxes on screen: the title and the form enter with a rise, and a field measured during
     it would sit 14 px low until the next resize, then jump */
  const top = header.offsetTop + header.offsetHeight + 8, bottom = form.offsetTop - 12;
  const gut = Math.max(16, innerWidth * 0.04);
  return { left: gut, top, width: innerWidth - gut * 2, height: Math.max(80, bottom - top) };
}

function describe(m) {
  if (m.owner === true) return { tip: '', label: OWNER + ', the owner: ' + m.text };
  if (m.mine && !api.live) return { tip: 'your line · kept on this device', label: m.text + ', your line, kept on this device' };
  return { tip: '', label: '' };
}

const drift = createDrift($('lines'), { rect, describe });

/* the quiet voice under the line: what just happened, then back to what is always true */
const IDLE = api.live ? '' : 'a preview: your lines stay on this device.';
let quiet = null;
const retry = $('retry');
/* a refusal stays until the composer clears it (the line touched, or sent again), with `try again` when sending the
   same line again may work; anything else goes back to the quiet after a moment */
function say(text, refused, again) {
  clearTimeout(quiet);
  status.textContent = text;
  /* a refusal is red, so it leaves the black-and-white ink while it shows */
  status.classList.toggle('refused', !!refused);
  status.classList.toggle('aph-ink', !refused);
  retry.hidden = !(refused && again);
  if (!refused) quiet = setTimeout(() => { status.textContent = IDLE; }, text ? 4200 : 0);
}
retry.addEventListener('click', () => { retry.hidden = true; form.requestSubmit(); $('line').focus({ preventScroll: true }); });
status.textContent = IDLE;
if (!api.live) $('line').dataset.tip = 'one line · no names · this preview keeps it on this device only';

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
/* the check floats above the line when it needs a hand, on a calm zone of its own */
const check = $('turnstile');
(function zones() {
  fog.zones(fixed.concat(check.classList.contains('on') ? [{ el: check, pad: 18 }] : [], lines ? [] : [{ el: hush, pad: 18 }], drift.zones()).slice(0, 12));
  requestAnimationFrame(zones);
})();
