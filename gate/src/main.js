/* gate: the owner's door and desk, as it stands inside the site. It has no name in the inscription and no address:
   the shell mounts it when an entrance opens (an `aph:entrance` event, see INTEGRATION.md). Seal top-left, the eye
   bottom-left, the passage corner free, the fog thinned for a section.

   Step 1: the eye draws itself above a single brushed baseline; the caret blinks on the line; the password, Enter.
     wrong: a hard cut to the closed lid, and the line trembles. right: a cut to wide open, held, then the eye and
     its line dissolve into stipple.
   Step 2: a new baseline condenses, with no words at all; the three words from the mail, Enter.
   Then the desk. A session that is still open goes straight to the desk. */

import { CONFIG } from './config.js';
import { createApi } from './api.js';
import { createMockApi } from './mock.js';
import { createEye } from './eye.js';
import { createLine, cells } from './line.js';
import { createDash } from './dash.js';

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
$('bTheme').addEventListener('click', () => {
  const b = $('bTheme').getBoundingClientRect();
  (A.themeShift || ((f) => f()))(() => { root.dataset.theme = isDark() ? 'light' : 'dark'; themeState(); },
    { origin: [b.left + b.width / 2, b.top + b.height / 2] });
});

/* ---------- ground, seal, cursor, tooltip ---------- */
const fog = A.Fog($('fog'), { density: 0.62, light: 0.4 });
A.seal($('seal'));
A.cursor();
A.tooltip();
const corners = [{ el: $('seal'), pad: 10 }, { el: $('controls'), pad: 8 }];
const zones = (list) => fog.zones(corners.concat(list));

const api = CONFIG.mock && createMockApi ? createMockApi() : createApi(CONFIG.api);
const gate = $('gate'), desk = $('desk');
const announceEl = $('announce');
const announce = (t) => { announceEl.textContent = ''; setTimeout(() => { announceEl.textContent = t; }, 60); };

/* ---------- the gate ---------- */
const one = createLine($('one'), { secret: true });
const two = createLine($('two'), { secret: false });
const caretOfOne = () => (step === 1 ? one.caretPoint() : null);
let eye = createEye($('eye'), { follow: caretOfOne });
let step = 0, busy = false, ticker = 0;

function tick() { one.tick(); two.tick(); }
function lookAtLine() { eye.typed(); }
one.input.addEventListener('input', lookAtLine);
one.input.addEventListener('focus', lookAtLine);

function openGate() {
  step = 1; busy = false;
  desk.hidden = true; gate.hidden = false;
  $('two').hidden = true; $('one').hidden = false;
  [$('eye'), $('one'), $('two')].forEach((el) => { el.style.maskImage = el.style.webkitMaskImage = ''; });
  one.clear(); two.clear();
  one.input.disabled = false; two.input.disabled = false;
  zones([{ el: $('eye'), pad: 20 }, { el: $('one'), pad: 16 }]);
  if (!ticker) ticker = setInterval(tick, 125);
  tick();
  if (!eye.drawn) eye.start();
  setTimeout(() => one.focus(), 400);
  root.dataset.gate = 'one';
}

$('one').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (busy || step !== 1) return;
  busy = true;
  const right = one.input.value ? await api.password(one.input.value) : false;
  if (!right) {
    eye.hit('wrong'); one.tremble(); one.clear();
    busy = false; one.focus();
    return;
  }
  /* wide open, held, then the eye and its line go back into the fog, and a new line condenses */
  step = 2; one.input.disabled = true; one.clear();
  eye.hit('right');
  root.dataset.gate = 'opening';
  setTimeout(() => {
    cells($('eye'), 'out', 9, () => { eye.stop(); $('eye').hidden = true; });
    cells($('one'), 'out', 9, () => {
      $('one').hidden = true;
      $('two').hidden = false;
      zones([{ el: $('two'), pad: 16 }]);
      cells($('two'), 'in', 9, () => { busy = false; two.focus(); root.dataset.gate = 'two'; });
    });
  }, 1100);
});

$('two').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (busy || step !== 2) return;
  busy = true;
  const right = two.input.value.trim() ? await api.code(two.input.value) : false;
  if (!right) { two.tremble(); two.clear(); busy = false; two.focus(); return; }
  two.input.disabled = true;
  cells($('two'), 'out', 9, () => { openDesk(); });
});

/* Escape at the gate goes back to where the visitor was: the shell closes the gate */
gate.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  e.preventDefault();
  dispatchEvent(new CustomEvent('aph:gate-close'));
});

/* ---------- the desk ---------- */
let dash = null;
function openDesk() {
  step = 3; busy = false;
  clearInterval(ticker); ticker = 0;
  gate.hidden = true; desk.hidden = false;
  desk.classList.remove('enter'); void desk.offsetWidth; desk.classList.add('enter');
  if (!dash) dash = createDash({ api, root: $('deskIn'), onLeave: leave });
  zones([{ el: $('deskIn'), pad: 0 }]);
  const t = desk.querySelector('.title'); if (t) t.focus({ preventScroll: true });
  root.dataset.gate = 'desk';
  announce('the desk');
}
function leave() {
  dash = null; $('deskIn').replaceChildren();
  $('eye').hidden = false;
  /* the eye draws itself again */
  eye.destroy();
  eye = createEye($('eye'), { follow: caretOfOne });
  openGate();
}

api.session().then((on) => { if (on) openDesk(); else openGate(); });

/* for checks: the eye's state and every drawing it can show */
window.__gate = { get eye() { return eye; }, get step() { return step; }, api };
