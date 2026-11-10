/* views: the board (a list of threads) and a thread (its posts in order), as markup in the text face.
   Pictures are still simulacra (SVGs of square cells, rendered once from the density map), drawn after the words
   and faded in only once they exist; with images off, a line of words stands in their place. */

import { esc, render, firstLine, age } from './text.js';
import { sigilSVG, sigilLabel } from './sigil.js';
import { image, stillSimulacrum } from './thumb.js';
import { createComposer } from './composer.js';

/* a still simulacrum into el, once its map has loaded; nothing shows before it is drawn */
function still(el, pic, box, seed, gain = 1.15) {
  image(pic.density).then((im) => {
    el.innerHTML = stillSimulacrum(im, box, Object.assign({ seed, gain }, pic)).svg;
    const svg = el.firstChild;
    svg.classList.add('enter');
    requestAnimationFrame(() => requestAnimationFrame(() => { svg.classList.add('in'); svg.classList.remove('enter'); }));
  }).catch(() => { el.innerHTML = '<span class="noimg">picture unavailable</span>'; });
}

/* the entrance: children of root rise out of a blur, one after another */
export function enter(items) {
  items.forEach((el, i) => { el.style.setProperty('--i', i); el.classList.add('enter'); });
  requestAnimationFrame(() => requestAnimationFrame(() => items.forEach((el) => { el.classList.add('in'); el.classList.remove('enter'); })));
}

const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

/* ---------- the board ---------- */
/* The board keeps every thread. It arrives a page at a time ({threads, next}, newest activity first): the first page
   is drawn at once, older pages are gathered as the reader nears the end of the list (or presses `older threads`,
   the same thing by keyboard), until `next` runs out. Rows stay light for thousands of threads: each is one link,
   its still simulacrum is drawn only once the row comes near the screen, and rows far from it are skipped by the
   browser (content-visibility). data is kept and grown in place, so a redraw (images on or off) keeps every page. */
function row(t, now) {
  const li = document.createElement('li');
  const meta = [plural(t.replies, 'reply', 'replies'), age(t.bumped, now)].concat(t.example ? ['example'] : []);
  li.innerHTML = '<a class="row" href="#forum/' + esc(t.id) + '">' +
    '<span class="thumb" aria-hidden="true"></span>' +
    '<span class="txt"><span class="first">' + esc(firstLine(t.first) || 'a picture') + '</span>' +
    '<span class="meta aph-meta">' + esc(meta.join(' · ')) + (t.image ? '<span class="sr"> · with a picture</span>' : '') + '</span></span></a>';
  return li;
}

export function boardView(data, ctx) {
  const root = document.createElement('section');
  root.className = 'board';
  root.setAttribute('aria-label', 'threads');
  const top = document.createElement('div');
  top.className = 'board-top';
  top.innerHTML = '<button type="button" class="act start" aria-expanded="false" data-cursor=".55">start a thread</button>';
  const start = top.querySelector('.start');
  const comp = createComposer({ api: ctx.api, thread: null, label: 'a new thread', onPosted: ctx.onPosted });
  comp.el.hidden = true;
  comp.el.id = 'new-thread';
  start.setAttribute('aria-controls', 'new-thread');
  start.addEventListener('click', () => {
    const show = comp.el.hidden;
    comp.el.hidden = !show; start.setAttribute('aria-expanded', String(show));
    start.textContent = show ? 'not now' : 'start a thread';
    if (show) { enter([comp.el]); comp.focus(); } else start.focus();
  });
  top.appendChild(comp.el);
  root.appendChild(top);

  const list = document.createElement('ol');
  list.className = 'threads';
  if (!data.threads.length) list.innerHTML = '<li class="empty">no threads yet. the first line is yours.</li>';
  root.appendChild(list);

  /* still simulacra, drawn when their row nears the screen */
  const pics = new Map();
  const near = typeof IntersectionObserver === 'function' ? new IntersectionObserver((es) => {
    es.forEach((e) => {
      if (!e.isIntersecting || !pics.has(e.target)) return;
      const [t, seed] = pics.get(e.target);
      pics.delete(e.target); near.unobserve(e.target);
      still(e.target.querySelector('.thumb'), t.image, [88, 88], seed, 1.3);
    });
  }, { root: ctx.scroller || null, rootMargin: '400px 0px' }) : null;

  /* threads at position base onwards of the board: each simulacrum's seed is its position, as it always was */
  function add(threads, base) {
    const now = Date.now(), frag = document.createDocumentFragment(), rows = [];
    threads.forEach((t, i) => {
      const li = row(t, now), seed = base + i + 3;
      if (t.image) {
        if (!ctx.images()) li.querySelector('.thumb').innerHTML = '<span class="noimg">[picture]</span>';
        else if (near) { pics.set(li, [t, seed]); near.observe(li); }
        else still(li.querySelector('.thumb'), t.image, [88, 88], seed, 1.3);
      }
      frag.appendChild(li); rows.push(li);
    });
    list.appendChild(frag);
    return rows;
  }
  const first = add(data.threads, 0);

  /* the end of the list: `older threads` while there are more, then the board's beginning */
  const foot = document.createElement('p');
  foot.className = 'board-end aph-meta';
  root.appendChild(foot);
  let loading = false, watch = null;
  function footState(failed) {
    if (data.next) {
      foot.innerHTML = '<button type="button" class="act older" data-cursor=".55">' + (failed ? 'older threads · try again' : 'older threads') + '</button>';
      foot.firstChild.addEventListener('click', () => more(true));
    } else {
      foot.textContent = data.threads.length > 1 ? 'the board begins here.' : '';
      if (watch) { watch.disconnect(); watch = null; }
    }
  }
  async function more(byHand) {
    if (loading || !data.next) return;
    loading = true;
    const btn = foot.querySelector('.older');
    if (btn) btn.setAttribute('aria-busy', 'true');
    let page = null;
    try { page = await ctx.api.board(data.next); } catch (_) { /* below */ }
    loading = false;
    if (!root.isConnected) return;
    /* the button is about to be redrawn: whoever was on it goes on from the first new row */
    const focused = byHand || foot.contains(document.activeElement);
    if (!page) {
      footState(true);
      if (focused && foot.firstChild) foot.firstChild.focus();
      if (ctx.announce) ctx.announce('older threads did not arrive');
      return;
    }
    /* a thread answered meanwhile moved to the top: never show one twice */
    const have = new Set(data.threads.map((t) => t.id));
    const fresh = page.threads.filter((t) => !have.has(t.id));
    const base = data.threads.length;
    data.threads.push(...fresh);
    data.next = page.next || null;
    const rows = add(fresh, base);
    enter(rows);
    footState(false);
    if (ctx.announce) ctx.announce(plural(fresh.length, 'older thread', 'older threads') + (data.next ? '' : ', back to the first'));
    /* the keyboard goes on from the first of the new rows, not past them */
    const target = rows[0] ? rows[0].querySelector('a') : foot.querySelector('.older');
    if (focused && target) target.focus();
    /* still near the end (a tall screen, a short page): keep gathering */
    if (data.next && watch) { watch.unobserve(foot); watch.observe(foot); }
  }
  footState(false);
  if (data.next && typeof IntersectionObserver === 'function') {
    watch = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) more(false); },
      { root: ctx.scroller || null, rootMargin: '0px 0px 800px 0px' });
    watch.observe(foot);
  }
  return { el: root, items: [top].concat(first, [foot]) };
}

/* ---------- a thread ---------- */
function picture(p, t, ctx) {
  const pic = p.image;
  const cap = esc(pic.caption || 'a picture');
  const orig = pic.original ? ' · <a href="' + esc(pic.original) + '" target="_blank" rel="noopener noreferrer" data-cursor=".55" aria-label="original of the picture, in a new tab">original</a>' : '';
  if (!ctx.images()) return '<p class="textpic aph-meta">[picture: ' + cap + ']' + orig + '</p>';
  return '<figure class="pic"><button type="button" class="open" data-open="' + p.n + '" aria-label="open the picture: ' + cap + '"></button>' +
    '<figcaption class="aph-meta">' + cap + orig + '</figcaption></figure>';
}

export function threadView(t, ctx) {
  const root = document.createElement('section');
  root.className = 'thread';
  root.setAttribute('aria-label', 'thread');
  const crumbs = document.createElement('p');
  crumbs.className = 'crumbs';
  crumbs.innerHTML = '<a class="act" href="#forum">back to the board</a>' + (t.example ? ' <span class="aph-meta">· an example thread</span>' : '');
  root.appendChild(crumbs);

  const list = document.createElement('ol');
  list.className = 'posts';
  const now = Date.now(), op = t.posts[0] && t.posts[0].poster;
  t.posts.forEach((p) => {
    const li = document.createElement('li');
    const removed = !!p.removed;
    const isOp = p.n > 1 && p.poster === op;
    li.innerHTML = '<article class="post' + (removed ? ' removed' : '') + '" id="p-' + p.n + '" tabindex="-1" aria-label="post ' + p.n + '">' +
      '<p class="pm aph-meta">' +
        (removed ? '' : '<span class="sigil" role="img" aria-label="' + esc(sigilLabel(p.poster)) + '">' + sigilSVG(p.poster) + '</span>') +
        '<a class="num" href="#forum/' + esc(t.id) + '/' + p.n + '" aria-label="post ' + p.n + '">' + p.n + '</a>' +
        (isOp ? '<span class="op">· the opener</span>' : '') +
        '<span aria-hidden="true">·</span><span>' + esc(age(p.created, now)) + '</span>' +
        (removed ? '' :
          '<span aria-hidden="true">·</span><button type="button" class="quote" data-quote="' + p.n + '" data-cursor=".55" aria-label="reply to post ' + p.n + '">reply</button>' +
          '<span aria-hidden="true">·</span><button type="button" class="report" data-report="' + p.n + '" data-cursor=".55"' +
            (p.reported ? ' disabled>reported' : ' aria-label="report post ' + p.n + '">report') + '</button>') +
      '</p>' +
      (removed ? '<p class="body">removed.</p>' :
        (p.image ? picture(p, t, ctx) : '') + '<p class="body">' + render(p.text, t.id) + '</p>') +
      '</article>';
    if (!removed && p.image && ctx.images()) still(li.querySelector('.open'), p.image, innerWidth < 520 ? [Math.min(280, innerWidth - 32), 240] : [190, 220], p.n + 11);
    list.appendChild(li);
  });
  root.appendChild(list);

  const comp = createComposer({ api: ctx.api, thread: t.id, label: 'reply to this thread', onPosted: ctx.onPosted });
  const h = document.createElement('h2');
  h.className = 'sr';
  h.textContent = 'reply';
  root.appendChild(h);
  root.appendChild(comp.el);
  return { el: root, comp, items: [crumbs].concat(Array.from(list.children), [comp.el]) };
}
