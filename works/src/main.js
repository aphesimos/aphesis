/* works · opera, as it will stand inside the site: the fog thinned for a section, the seal in the corner, the eye
   in the bottom-left, the passage corner kept free, the runtime's cursor and tooltip.

   Two views in one place, chosen by the hash: #works (or anything else) shows the inscription of works,
   #works-<id> shows that work alone. Links, the back button of the browser, Escape and the arrow keys all
   change the hash, and only the hash changes the view. */

import { DATA, MAPS } from './assets.js';
import { SCENE, step } from './motion.js';
import { createEye } from './theme.js';
import { createPicture } from './picture.js';
import { createInscription } from './inscription.js';
import { createWork } from './work.js';

const A = window.Aphesis;
const $ = (id) => document.getElementById(id);
const works = DATA.works;
const byId = Object.fromEntries(works.map((w) => [w.id, w]));

/* ---------- shell ---------- */
createEye($('bTheme'));
const fog = A.Fog($('fog'), { density: 0.62, light: 0.4 });
A.seal($('seal'));
A.cursor();
A.tooltip();

const announceEl = $('announce');
const announce = (t) => { announceEl.textContent = ''; setTimeout(() => { announceEl.textContent = t; }, 60); };

/* ---------- the two views ---------- */
const listView = $('list'), workView = $('work');
const inscription = createInscription($('inscription'), works);
const picture = createPicture($('picture'), $('caption'));
const work = createWork({
  gloss: $('wGloss'), title: $('wTitle'), desc: $('wDesc'), meta: $('wMeta'), links: $('wLinks'), back: $('back'), next: $('next'),
}, works);

const corners = [{ el: $('controls'), pad: 8 }, { el: $('seal'), pad: 10 }];
const ZONES = {
  list: () => corners.concat([{ el: $('title'), pad: 16 }], inscription.links.map((a) => ({ el: a, pad: 6 }))),
  work: () => corners.concat([{ el: $('figure'), pad: 0 }],
    ['wName', 'wDesc', 'wMeta', 'wLinks'].map((id) => ({ el: $(id), pad: 16 })), [...document.querySelectorAll('#work .way')].map((el) => ({ el, pad: 10 }))),
};

function enter(view) { view.inert = false; view.removeAttribute('aria-hidden'); view.classList.add('on'); }
function leave(view) { view.inert = true; view.setAttribute('aria-hidden', 'true'); view.classList.remove('on'); }

let shown = null;        /* 'list', or the id of the work on screen */

function showList() {
  if (shown === 'list') return;
  const from = shown, s = step();
  shown = 'list';
  document.title = 'works · aphes.is';
  if (from) { picture.hide(); leave(workView); }
  /* the list returns while the picture is still dissolving, once the work's words have gone */
  s.wait(from ? SCENE() * 0.6 : 0, () => {
    enter(listView);
    fog.zones(ZONES.list());
    requestAnimationFrame(inscription.layout);
    const a = from && inscription.link(from);
    if (a) a.focus({ preventScroll: true });
    if (from) announce('works');
  });
}

function showWork(w) {
  if (shown === w.id) return;
  const from = shown, s = step();
  shown = w.id;
  document.title = w.name + ' · works · aphes.is';
  picture.show(w, MAPS[w.id]);
  const open = () => {
    work.render(w);
    workView.scrollTop = 0;
    enter(workView);
    fog.zones(ZONES.work());
    $('wName').focus({ preventScroll: true });
    announce(w.name);
  };
  if (from === 'list' || from === null) {
    leave(listView);
    s.wait(from ? SCENE() * 0.3 : 0, open);
  } else {
    /* from one work to the next: its words leave, the new ones come in while the picture changes */
    workView.classList.remove('on');
    s.wait(SCENE() * 0.6, open);
  }
}

function route() {
  const h = decodeURIComponent(location.hash.slice(1));
  const w = h.startsWith('works-') && byId[h.slice(6)];
  if (w) showWork(w); else showList();
}

addEventListener('hashchange', route);
addEventListener('keydown', (e) => {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || shown === 'list' || !shown) return;
  if (e.key === 'Escape') { location.hash = 'works'; e.preventDefault(); }
  else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && works.length > 1 && !(e.target.closest && e.target.closest('input, textarea'))) {
    const i = works.findIndex((w) => w.id === shown), d = e.key === 'ArrowRight' ? 1 : -1;
    location.hash = 'works-' + works[(i + d + works.length) % works.length].id;
    e.preventDefault();
  }
});

/* layout that depends on the faces waits for them; the screen changing redraws the line and the underlines */
let pending = 0;
function relayout() { cancelAnimationFrame(pending); pending = requestAnimationFrame(() => { if (shown === 'list') inscription.layout(); else work.draw(); }); }
addEventListener('resize', relayout);
leave(workView); leave(listView);
route();
document.fonts.ready.then(relayout);
