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
  const now = Date.now();
  data.threads.forEach((t, i) => {
    const li = document.createElement('li');
    const meta = [plural(t.replies, 'reply', 'replies'), age(t.bumped, now)].concat(t.example ? ['example'] : []);
    li.innerHTML = '<a class="row" href="#forum/' + esc(t.id) + '">' +
      '<span class="thumb" aria-hidden="true"></span>' +
      '<span class="txt"><span class="first">' + esc(firstLine(t.first) || 'a picture') + '</span>' +
      '<span class="meta aph-meta">' + esc(meta.join(' · ')) + (t.image ? '<span class="sr"> · with a picture</span>' : '') + '</span></span></a>';
    const thumb = li.querySelector('.thumb');
    if (t.image) {
      if (ctx.images()) still(thumb, t.image, [88, 88], i + 3, 1.3);
      else thumb.innerHTML = '<span class="noimg">[picture]</span>';
    }
    list.appendChild(li);
  });
  root.appendChild(list);
  return { el: root, items: [top].concat(Array.from(list.children)) };
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
