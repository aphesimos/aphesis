/* laboratory · officina, as it will stand inside the site: the fog thinned to a section's .62, the seal in the
   corner, the eye in the bottom-left, the passage corner kept free, the runtime's cursor and tooltip.
   Routes: #laboratory (the index) and #laboratory/<slug> (one experiment). Any other hash shows the index here;
   in the site, #home belongs to the shell. */

import { EXPERIMENTS } from './assets.js';
import { MODULES } from './modules.js';
import { once } from './motion.js';
import { createGround } from './ground.js';
import { indexView, experimentView, wave, filler } from './views.js';

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
/* the switch is a stipple wave from the eye (Aphesis.themeShift); until the runtime has it, the theme changes at once.
   Canvas colours follow on their own: the fog and the bench's fields listen for data-theme. */
$('bTheme').addEventListener('click', () => {
  const b = $('bTheme').getBoundingClientRect();
  (A.themeShift || ((f) => f()))(() => { root.dataset.theme = isDark() ? 'light' : 'dark'; themeState(); },
    { origin: [b.left + b.width / 2, b.top + b.height / 2] });
});

/* ---------- ground, seal, cursor, tooltip ---------- */
const ground = createGround($('fog'), [{ el: $('controls'), pad: 8 }, { el: $('seal'), pad: 10 }]);
A.seal($('seal'));
A.cursor();
A.tooltip();

const announceEl = $('announce');
const announce = (t) => { announceEl.textContent = ''; setTimeout(() => { announceEl.textContent = t; }, 60); };

/* ---------- routing: leave softly, swap, enter with a blur and a rise ---------- */
const view = $('view');
let live = null, current = null, busy = false, pending = false;

function parse() {
  const m = location.hash.match(/^#laboratory\/([\w-]+)/);
  const e = m && EXPERIMENTS.find((x) => x.slug === m[1]);
  return e ? e.slug : '';
}

function show(slug, first) {
  if (busy) { pending = true; return; }
  if (slug === current && !first) return;
  busy = true;
  if (live) { live.stop(); live = null; }
  view.classList.add('out');
  once(first ? 0 : 520, (go) => { if (first) go(); }, () => {
    current = slug;
    const e = EXPERIMENTS.find((x) => x.slug === slug);
    view.innerHTML = e ? experimentView(e, EXPERIMENTS) : indexView(EXPERIMENTS);
    wave(view);
    document.title = e ? `${e.title} · laboratory · aphes.ist` : 'laboratory · aphes.ist';
    scrollTo(0, 0);
    ground.watch(view);
    void view.offsetWidth;
    view.classList.remove('out');
    announce(e ? `${e.title}, experiment ${e.order}` : 'laboratory, the index of experiments');
    if (!first) $('laboratory').focus({ preventScroll: true });
    if (e) {
      const mod = MODULES[e.module];
      const values = filler(view);
      /* the bench starts as the page settles, so its canvases arrive after the text */
      setTimeout(() => {
        if (current !== slug) return;
        try { live = mod.mount(view.querySelector('.bench'), { values, announce }); }
        catch (err) { console.error(err); }
        ground.refresh();
      }, 300);
    }
    busy = false;
    if (pending) { pending = false; show(parse()); }
  });
}

addEventListener('hashchange', () => show(parse()));
document.fonts.ready.then(() => show(parse(), true));
