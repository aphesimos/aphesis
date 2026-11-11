/* forum · ἀγορά, as it will stand inside the site: the section's fog, the seal in the corner, the eye in the
   bottom-left, the passage corner kept free, the runtime's cursor and tooltip. Hash routes inside the one document:
   #forum is the board, #forum/<thread> a thread, #forum/<thread>/<n> a thread at post n. */

import { createApi } from './api.js';
import { createGround } from './ground.js';
import { createViewer } from './viewer.js';
import { boardView, threadView, enter } from './views.js';
import { scrollToEl } from './motion.js';
import { esc, firstLine } from './text.js';
import { sigilSVG } from './sigil.js';
import { ownerEye, ownerIcon, ownerWord } from './owner.js';
import { load, save } from './store.js';

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
/* the switch travels as the design system's stipple wave from the eye, where the runtime has it; otherwise at once.
   Canvas colours follow data-theme on their own (the runtime watches it). */
$('bTheme').addEventListener('click', () => {
  const b = $('bTheme').getBoundingClientRect();
  (A.themeShift || ((f) => f()))(() => { root.dataset.theme = isDark() ? 'light' : 'dark'; themeState(); },
    { origin: [b.left + b.width / 2, b.top + b.height / 2] });
});

/* ---------- shell ---------- */
A.seal($('seal'));
A.cursor();
A.tooltip();
const scroller = $('scroller'), view = $('view'), forum = $('forum');
const ground = createGround($('fog'), forum, scroller, [{ el: $('controls'), pad: 8 }, { el: $('seal'), pad: 10 }]);
const announceEl = $('announce');
const announce = (t) => { announceEl.textContent = ''; setTimeout(() => { announceEl.textContent = t; }, 60); };
const viewer = createViewer({ scroller, ground, announce });
const api = createApi();

if (api.preview) {
  const note = $('note');
  note.hidden = false;
  note.dataset.tip = 'this preview keeps your posts on this device only';
  note.innerHTML = 'preview<span class="sr">: this preview keeps your posts on this device only</span>';
}

/* ---------- images on or off (the text-only fallback) ---------- */
const IMG_KEY = 'aphesis.forum.images';
let imagesOn = load(IMG_KEY, true) !== false;
function imagesState() {
  const b = $('bImages');
  b.textContent = 'images · ' + (imagesOn ? 'on' : 'off');
  b.setAttribute('aria-pressed', String(imagesOn));
}
imagesState();
$('bImages').addEventListener('click', () => {
  imagesOn = !imagesOn; save(IMG_KEY, imagesOn); imagesState();
  announce(imagesOn ? 'pictures shown as fog' : 'words only');
  show(route(), { keepScroll: true, quiet: true });
});

/* ---------- routes ---------- */
function route() {
  const m = location.hash.match(/^#forum\/([\w-]{1,40})(?:\/(\d{1,6}))?$/);
  return m ? { thread: m[1], n: m[2] ? +m[2] : 0 } : { thread: null, n: 0 };
}

let current = { thread: null, data: null, comp: null }, seq = 0, first = true;
let board = null;   /* the board's pages gathered so far, kept for a redraw in place */
const ctx = {
  api,
  scroller,
  announce,
  images: () => imagesOn,
  onPosted: (r) => {
    const h = '#forum/' + r.thread + '/' + r.n;
    postedNext = r;
    if (location.hash === h) show(route(), { force: true, posted: takePosted() }); else { forceNext = true; location.hash = h; }
  },
};
let forceNext = false, postedNext = null;
const takePosted = () => { const r = postedNext; postedNext = null; return r; };

function highlight(n, focus) {
  const post = $('p-' + n);
  if (!post) return;
  scrollToEl(scroller, post);
  post.classList.add('hit');
  setTimeout(() => post.classList.remove('hit'), 2400);
  /* the owner's eye is rubedo already: reached, it opens wide for a moment instead */
  const eye = ownerEye(post);
  if (eye) eye.wide(10);
  if (focus) post.focus({ preventScroll: true });
}

async function show(r, opts = {}) {
  const my = ++seq;
  hideQuote();
  if (viewer.open) viewer.hide();
  /* the same thread, another post: no new page, the post comes to the reader */
  if (!opts.force && !opts.quiet && r.thread && r.thread === current.thread && current.data) {
    if (r.n) highlight(r.n, true);
    return;
  }
  /* a reply just posted to the thread on screen: the thread stays as it is, where it is, and only the new post rises
     into it (no leaving, no jump to the top and back down to it) */
  const inPlace = !!(opts.posted && r.thread && r.thread === current.thread && current.data);
  /* the posts already on screen (read from the page: the thread's data may already hold the new one) */
  const had = inPlace ? Math.max(0, ...Array.from(view.querySelectorAll('article[id^="p-"]'), (el) => +el.id.slice(2))) : 0;
  if (inPlace) opts = Object.assign({}, opts, { keepScroll: true, quiet: true });
  const keep = opts.keepScroll ? scroller.scrollTop : 0;
  if (!first && !opts.quiet) view.classList.add('leaving');
  /* between the board and a thread the head changes shape (the lede goes, the title gets smaller): it leaves with
     the view and comes back once the new one is in, so its lines never jump while they are seen */
  const turning = !first && !opts.quiet && root.classList.contains('is-thread') !== !!r.thread;
  if (turning) forum.classList.add('turning');
  const leave = new Promise((res) => setTimeout(res, first || opts.quiet ? 0 : 320));
  /* the head changes shape only once it has gone (its fade ends, or a second has passed) */
  const headGone = turning ? new Promise((res) => {
    const head = $('head');
    const done = () => { head.removeEventListener('transitionend', end); res(); };
    const end = (e) => { if (e.target === head && e.propertyName === 'opacity') done(); };
    head.addEventListener('transitionend', end);
    setTimeout(done, 1000);
  }) : null;
  let data = null, err = null;
  /* a redraw in place (images on or off) keeps every page of the board already gathered, and the scroll with it */
  if (!r.thread && opts.quiet && board) data = board;
  else { try { data = await (r.thread ? api.thread(r.thread) : api.board()); } catch (e) { err = e; } }
  await leave;
  if (headGone) await headGone;
  if (my !== seq) return;
  root.classList.toggle('is-thread', !!r.thread);
  let v;
  if (err) {
    const el = document.createElement('section');
    el.innerHTML = '<p class="crumbs"><a class="act" href="#forum">back to the board</a></p><p class="body">' +
      esc(err.status === 404 ? 'this thread is gone.' : (err.message || 'the board did not answer.')) + '</p>';
    v = { el, items: Array.from(el.children) };
    current = { thread: null, data: null, comp: null };
  } else {
    if (!r.thread) board = data;
    v = r.thread ? threadView(data, ctx) : boardView(data, ctx);
    current = { thread: r.thread, data: r.thread ? data : null, comp: v.comp || null };
  }
  view.replaceChildren(v.el);
  view.classList.remove('leaving');
  forum.classList.remove('turning');
  if (!opts.quiet) enter(v.items);
  else if (inPlace && !err) enter(v.items.filter((el) => { const a = el.querySelector && el.querySelector('article[id^="p-"]'); return a && +a.id.slice(2) > had; }));
  scroller.scrollTop = keep;
  document.title = (r.thread ? 'a thread · ' : '') + 'forum · aphes.ist';
  if (!opts.quiet) {
    announce(err ? 'not found' : r.thread ? 'thread, ' + data.posts.length + ' posts' : 'board, ' + data.threads.length + ' threads');
    if (r.thread && r.n) setTimeout(() => highlight(r.n, !first), 450);
    else if (!first) document.querySelector('h1').focus({ preventScroll: true });
  } else if (inPlace && !err) {
    announce('posted, post ' + r.n);
    setTimeout(() => { if (my === seq) highlight(r.n, true); }, 120);
  }
  ground.refresh();
  first = false;
}

addEventListener('hashchange', () => { const f = forceNext; forceNext = false; show(route(), { force: f, posted: f ? takePosted() : null }); });

/* ---------- inside a thread: reply, report, open a picture ---------- */
view.addEventListener('click', (e) => {
  const q = e.target.closest('[data-quote]');
  if (q && current.comp) {
    current.comp.quote(+q.dataset.quote);
    scrollToEl(scroller, current.comp.el, Math.max(120, scroller.clientHeight - current.comp.el.offsetHeight - 40));
    return;
  }
  const rep = e.target.closest('[data-report]');
  if (rep && current.thread) {
    rep.disabled = true;
    api.report(current.thread, +rep.dataset.report).then(() => {
      rep.textContent = 'reported'; rep.removeAttribute('aria-label'); announce('reported. thank you.');
    }).catch(() => { rep.disabled = false; announce('the report did not go through'); });
    return;
  }
  const op = e.target.closest('[data-open]');
  if (op && current.data) {
    const p = current.data.posts.find((x) => x.n === +op.dataset.open);
    if (p && p.image) viewer.show(p.image, op);
  }
});

/* ---------- >>n: the quoted post beside the reference, on hover and on focus, shown whole ---------- */
const qtip = $('qtip');
let qFor = null;
function showQuote(a) {
  if (!current.data) return;
  const p = current.data.posts.find((x) => x.n === +a.dataset.ref);
  qFor = a;
  if (!p) qtip.textContent = 'no post ' + a.dataset.ref + ' in this thread';
  else if (p.removed) qtip.textContent = p.n + ' · removed';
  else {
    const words = firstLine(p.text.replace(/^>(?!>).*$/gm, ''), 220) || 'a picture';
    qtip.innerHTML = p.owner === true
      ? '<span class="qs qo aph-red" aria-hidden="true">' + ownerIcon() + '</span>' + ownerWord() + ' · ' + p.n + ' · ' + esc(words)
      : '<span class="qs" aria-hidden="true">' + sigilSVG(p.poster) + '</span>' + p.n + ' · ' + esc(words);
  }
  const r = a.getBoundingClientRect();
  qtip.classList.add('on');
  const w = qtip.offsetWidth, h = qtip.offsetHeight;
  let x = Math.min(innerWidth - 16 - w, Math.max(16, r.left));
  let y = r.bottom + 10;
  if (y + h > innerHeight - 16) y = r.top - 10 - h;
  qtip.style.left = x + 'px'; qtip.style.top = Math.max(16, y) + 'px';
}
function hideQuote() { qFor = null; qtip.classList.remove('on'); }
view.addEventListener('pointerover', (e) => { const a = e.target.closest('a.ref'); if (a && a !== qFor) showQuote(a); });
view.addEventListener('pointerout', (e) => { const a = e.target.closest('a.ref'); if (a && !a.contains(e.relatedTarget)) hideQuote(); });
view.addEventListener('focusin', (e) => { const a = e.target.closest('a.ref'); if (a) showQuote(a); });
view.addEventListener('focusout', (e) => { if (e.target.closest('a.ref')) hideQuote(); });
scroller.addEventListener('scroll', () => { if (qFor && document.activeElement !== qFor) hideQuote(); }, { passive: true });
addEventListener('pointerdown', (e) => { if (!e.target.closest('a.ref')) hideQuote(); });

show(route());
