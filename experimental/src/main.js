/* descent · κατάβασις, as it will stand inside the site: dark fog, the seal in the corner, the eye in the
   bottom-left, the passage corner kept free, the runtime's cursor and tooltip. Nothing else but a door.
   Eight chambers stand behind it, then the ending:
     1 the ouroboros (circling) · 2 the two hands (holding) · 3 the scholar (holding) · 4 the emerald tablet (striking)
     5 the wheel of fortune (circling) · 6 the veil (dragging) · 7 the alchemist (striking) · 8 the edge of the sky (holding) */

import { createGround, createPictures } from './stage.js';
import { createDoor } from './door.js';
import { createJourney } from './journey.js';
import { ouroboros } from './chambers/ouroboros.js';
import { hands } from './chambers/hands.js';
import { scholar } from './chambers/scholar.js';
import { tablet } from './chambers/tablet.js';
import { fortune } from './chambers/fortune.js';
import { veil } from './chambers/veil.js';
import { alchemist } from './chambers/alchemist.js';
import { sky } from './chambers/sky.js';
import { ending } from './chambers/ending.js';

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
/* the eye: the new theme spreads from it as a stipple wave (Aphesis.themeShift), applied beneath the wave;
   the door and the canvases take its colours from data-theme */
$('bTheme').addEventListener('click', () => {
  const b = $('bTheme').getBoundingClientRect();
  (A.themeShift || ((f) => f()))(() => { root.dataset.theme = isDark() ? 'light' : 'dark'; themeState(); },
    { origin: [b.left + b.width / 2, b.top + b.height / 2] });
});

/* ---------- ground, seal, cursor, tooltip ---------- */
const ground = createGround($('fog'), 0.74);
/* the two simulacra every chamber borrows, made once, under the door */
createPictures($('doorway'));
A.seal($('seal'));
A.cursor();
A.tooltip();

/* ---------- the door and the journey behind it ---------- */
const door = createDoor($('door'), $('doorway'));
const announceEl = $('announce');
const announce = (t) => { announceEl.textContent = ''; setTimeout(() => { announceEl.textContent = t; }, 60); };
const corners = [{ el: $('controls'), pad: 8 }, { el: $('seal'), pad: 10 }];
const ZONES = {
  door: corners.concat([{ el: $('door'), pad: 28 }]),
  chamber: corners.concat([{ el: $('caption'), pad: 12 }]),
  none: [],
};
createJourney({
  chambers: [ouroboros, hands, scholar, tablet, fortune, veil, alchemist, sky, ending],
  ground, door, caption: $('caption'), announce, root: $('experimental'),
  zones: (mode) => ground.zones(ZONES[mode] || []),
});
ground.zones(ZONES.door);
door.show();
