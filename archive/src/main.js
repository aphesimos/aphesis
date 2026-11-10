/* archive · codex, as it will stand inside the site: the fog thinned to .62, the seal in the corner, the eye in
   the bottom-left, the passage corner kept free. One scrolling column holds the list and the posts; a post is
   the hash route #<slug>, the list is #archive (or no hash). Escape or the brushed back mark return to the list. */

import { drawStageIcons } from './stage-icon.js';
import { drawMarks } from './marks.js';
import { createTip } from './tip.js';
import { createFigures } from './figure.js';
import { createViews } from './views.js';

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
/* the switch travels as a stipple wave from the eye (Aphesis.themeShift); without it, it switches at once.
   the canvases read their colors from the theme on their own once data-theme changes */
$('bTheme').addEventListener('click', () => {
  const b = $('bTheme').getBoundingClientRect();
  (A.themeShift || ((f) => f()))(() => { root.dataset.theme = isDark() ? 'light' : 'dark'; themeState(); },
    { origin: [b.left + b.width / 2, b.top + b.height / 2] });
});

/* ---------- ground, seal, cursor, tooltip ---------- */
const fog = A.Fog($('fog'), { density: 0.62, light: 0.4 });
A.seal($('seal'));
A.cursor();
const tip = createTip();

/* ---------- marks ---------- */
const scroller = $('scroller');
const main = $('codex');
drawStageIcons(main);
drawMarks(main);

/* ---------- calm fog behind the column ---------- */
/* one zone that follows the column of the view on screen: as wide as the column, as tall as the screen, and
   larger than both, so the fog is fully calm behind the lines and gathers again at the margins */
const list = main.querySelector('.view.list');
const posts = new Map(Array.from(main.querySelectorAll('.view.post')).map((v) => [v.dataset.slug, v]));
const views = createViews(scroller, [list, ...posts.values()]);
const colRect = () => { const c = (views.current || list).querySelector('.col'); return c.getBoundingClientRect(); };
const column = {
  pad: 0,
  get width() { return colRect().width / 0.62; },
  get left() { const r = colRect(); return r.left + r.width / 2 - r.width / 0.62 / 2; },
  get height() { return innerHeight / 0.6; },
  get top() { return innerHeight / 2 - innerHeight / 0.6 / 2; },
};
fog.zones([column, { el: $('seal'), pad: 10 }, { el: $('controls'), pad: 8 }]);

/* ---------- routes ---------- */
const figures = createFigures();
const announceEl = $('announce');
const announce = (t) => { announceEl.textContent = ''; setTimeout(() => { announceEl.textContent = t; }, 60); };
let listScroll = 0, lastSlug = null;

function route() {
  const name = decodeURIComponent(location.hash.slice(1));
  const post = posts.get(name);
  tip.hide();
  if (post) {
    if (views.current === post) return;
    if (views.current === list) listScroll = scroller.scrollTop;
    figures.leave();
    lastSlug = name;
    views.go(post, 0);
    figures.enter(post);
    const h = post.querySelector('.post-title');
    h.focus({ preventScroll: true });
    document.title = 'aphes.is archive · ' + h.textContent;
    announce(h.textContent);
  } else {
    if (views.current === list) return;
    const first = !views.current;
    figures.leave();
    views.go(list, first ? 0 : listScroll);
    document.title = 'aphes.is archive';
    if (!first) {
      const link = lastSlug && list.querySelector('.entry-link[data-slug="' + lastSlug + '"]');
      if (link) link.focus({ preventScroll: true });
      announce('archive');
    }
  }
}
addEventListener('hashchange', route);
route();

/* ---------- keys ---------- */
addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (tip.open) { tip.hide(); return; }
  if (views.current !== list) { e.preventDefault(); location.hash = 'archive'; }
});

/* a note's way back to its marker stays inside the post: the marker takes the focus, the route stays */
main.addEventListener('click', (e) => {
  const back = e.target.closest('.fn-back');
  if (!back) return;
  e.preventDefault();
  const mark = document.getElementById(back.dataset.fnref);
  if (mark) { mark.scrollIntoView({ block: 'center', behavior: 'smooth' }); mark.focus({ preventScroll: true }); }
});
