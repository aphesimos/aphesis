/* music · phonotheca, as it will stand inside the site: the fog thinned to .62, the seal in the corner, the eye
   in the bottom-left, the passage corner kept free, and the now-playing line top-right once something plays.

   Two ways to run. Alone (this page), the script is also its own small host: #music (or no hash) mounts the
   section, any other route (the seal's #home) unmounts it and shows a stand-in for the rest of the site, while the
   player core keeps playing. Inside the one-page shell (#aph-host exists) the shell mounts and unmounts; the
   section mounts at once and the shell's own routes do the rest. See README.md, "continuity". */

import { loadLibrary } from './library.js';
import { getPlayer } from './player.js';
import { mountView } from './view.js';

const A = window.Aphesis;
const $ = (id) => document.getElementById(id);
const root = document.documentElement;
const inShell = !!document.getElementById('aph-host');

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

/* ---------- the section ---------- */
let section = $('music');
const pristine = section.cloneNode(true);
const away = $('m-away');
let lib = null, core = null, view = null, leaving = 0, leavingView = null;
const corners = [{ el: $('seal'), pad: 10 }, { el: $('controls'), pad: 8 }];

function mount() {
  if (view || !lib) return;
  if (leavingView) { clearTimeout(leaving); leaving = 0; leavingView.unmount(); leavingView = null; section.remove(); }
  if (!section.isConnected) { section = pristine.cloneNode(true); away.before(section); }
  root.dataset.sec = 'music';
  away.hidden = true;
  view = mountView(section, lib, core, { fog, zones: inShell ? [] : corners });
  const h = section.querySelector('.m-title');
  if (!inShell && document.activeElement === document.body) h.focus({ preventScroll: true });
}
/* leaving: each piece dissolves on its own (no ancestor of the .aph-ink text is faded), then the view goes */
function leave() {
  if (!view) return;
  const v = view; view = null; leavingView = v;
  const pieces = v.pieces();
  pieces.forEach((el) => { el.style.transition = 'opacity .72s var(--easing-settle), filter .72s var(--easing-settle), translate .72s var(--easing-settle)'; el.style.transitionDelay = '0s'; });
  requestAnimationFrame(() => pieces.forEach((el) => { el.style.opacity = '0'; el.style.filter = 'blur(10px)'; el.style.translate = '0 14px'; }));
  leaving = setTimeout(() => {
    v.unmount(); section.remove(); delete root.dataset.sec; leaving = 0; leavingView = null;
    away.hidden = false;
    const els = Array.from(away.children);
    els.forEach((el, i) => { el.classList.remove('m-on'); el.classList.add('m-e'); el.style.transitionDelay = i * 90 + 'ms'; });
    requestAnimationFrame(() => requestAnimationFrame(() => els.forEach((el) => el.classList.add('m-on'))));
    fog.zones([{ el: away, pad: 20 }].concat(corners, [{ el: $('aph-np'), pad: 10 }]));
    document.title = 'aphes.ist';
  }, 1000);
}
const wanted = () => location.hash === '' || /^#music(\/|$)/.test(location.hash);
function route() {
  if (inShell || wanted()) { document.title = 'aphes.ist music'; mount(); } else leave();
}

/* the library comes from a worker (library.js); the view is made in a frame of its own, after the player, so no one
   task holds up the seal's travel or the section coming in */
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
loadLibrary().then(async (l) => {
  lib = l;
  core = getPlayer(lib);
  await nextFrame();
  route();
}).catch((err) => {
  console.error(err);
  const t = section.querySelector('.m-here .h-text');
  if (t) t.textContent = 'the library would not load. try again later.';
});
if (!inShell) addEventListener('hashchange', route);

/* for a host that mounts sections itself, and for checks */
window.AphesisMusic = { mount, unmount: leave, get player() { return core; }, get view() { return view; }, get library() { return lib; } };
