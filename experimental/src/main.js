/* experimental · ἄδυτον, as it will stand inside the site: fog at .62, the seal in the corner, the eye and the
   pause in the bottom-left corner, the passage corner kept free, the runtime's cursor and tooltip. */

import { setPaused, isPaused, pulse, onPause, REDUCED } from './motion.js';
import { found } from './memory.js';
import { createGround } from './stage.js';
import { createGestures } from './gestures.js';
import { createThreshold } from './threshold.js';
import { createManager } from './manager.js';
import { ouroboros } from './chambers/ouroboros.js';
import { hands } from './chambers/hands.js';
import { scholar } from './chambers/scholar.js';
import { tablet } from './chambers/tablet.js';

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
sysDark.addEventListener('change', () => { themeState(); pulse(1200); });
$('bTheme').addEventListener('click', () => {
  root.dataset.theme = isDark() ? 'light' : 'dark';
  themeState();
  pulse(1200);   /* a paused fog still takes the new ground */
});

/* ---------- ground, seal, cursor, tooltip ---------- */
const ground = createGround($('fog'));
let seal = A.seal($('seal'));
A.cursor();
A.tooltip();

/* ---------- pause: everything that loops stops on demand ---------- */
const bPause = $('bPause');
A.letters(bPause);
function pauseLabel(p) {
  bPause.setAttribute('aria-pressed', String(p));
  bPause.dataset.tip = p ? 'let the fog move again' : 'stop the fog and everything that moves';
  bPause.textContent = p ? 'resume' : 'pause';
  delete bPause.dataset.split; A.letters(bPause);
}
bPause.addEventListener('click', () => setPaused(!isPaused()));
onPause((p) => {
  pauseLabel(p);
  seal.stop();
  seal = A.seal($('seal'), { boil: !p });
});
pauseLabel(false);

/* ---------- the threshold and its chambers ---------- */
const threshold = createThreshold();
threshold.marks(found());
const caption = $('caption'), announceEl = $('announce');
const announce = (t) => { announceEl.textContent = ''; setTimeout(() => { announceEl.textContent = t; }, 60); };

let manager = null;
const gestures = createGestures({
  center: threshold.center,
  isFound: (id) => found().includes(id),
  onEnter: (id) => manager.enter(id),
  onEcho: threshold.echo,
});
threshold.limen.addEventListener('click', () => { if (!manager.active) threshold.knock(); });

const baseZones = [{ el: $('h-experimental'), pad: 20 }, { el: $('limen'), pad: 16 }, { el: $('echo'), pad: 10 }, { el: $('controls'), pad: 8 }, { el: $('seal'), pad: 10 }];
manager = createManager({
  chambers: { ouroboros, hands, scholar, tablet },
  ground, threshold, gestures, caption, announce,
  zones: (extra) => ground.zones(baseZones.concat(extra.map((el) => ({ el, pad: 14 })))),
});
ground.zones(baseZones);

/* the seal leaves a chamber; at the threshold it leads home, as it does everywhere in the site */
$('seal').addEventListener('click', (e) => {
  if (manager.active) { e.preventDefault(); manager.leave(); }
});

threshold.show();
gestures.enable();
if (REDUCED) root.classList.add('reduced');
