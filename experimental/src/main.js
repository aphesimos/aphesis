/* experimental · ἄδυτον, as it will stand inside the site: dark fog, the seal in the corner, the eye in the
   bottom-left, the passage corner kept free, the runtime's cursor and tooltip. Nothing else but a door. */

import { REDUCED } from './motion.js';
import { createGround } from './stage.js';
import { createDoor } from './door.js';
import { createJourney } from './journey.js';
import { ouroboros } from './chambers/ouroboros.js';
import { hands } from './chambers/hands.js';
import { scholar } from './chambers/scholar.js';
import { tablet } from './chambers/tablet.js';
import { ending } from './chambers/ending.js';

const A = window.Aphesis;
const $ = (id) => document.getElementById(id);
const root = document.documentElement;
if (REDUCED) root.classList.add('reduced');

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
$('bTheme').addEventListener('click', () => { root.dataset.theme = isDark() ? 'light' : 'dark'; themeState(); });

/* ---------- ground, seal, cursor, tooltip ---------- */
const ground = createGround($('fog'), 0.74);
A.seal($('seal'));
A.cursor();
A.tooltip();

/* ---------- the door and the journey behind it ---------- */
const door = createDoor($('door'));
const announceEl = $('announce');
const announce = (t) => { announceEl.textContent = ''; setTimeout(() => { announceEl.textContent = t; }, 60); };
const corners = [{ el: $('controls'), pad: 8 }, { el: $('seal'), pad: 10 }];
const ZONES = {
  door: corners.concat([{ el: $('door'), pad: 28 }]),
  chamber: corners.concat([{ el: $('caption'), pad: 12 }]),
  none: [],
};
createJourney({
  chambers: [ouroboros, hands, scholar, tablet, ending],
  ground, door, caption: $('caption'), announce, root: $('experimental'),
  zones: (mode) => ground.zones(ZONES[mode] || []),
});
ground.zones(ZONES.door);
door.show();
