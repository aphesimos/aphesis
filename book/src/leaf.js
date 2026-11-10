/* the leaf: the text page of the spread, and the contents that can take its place.
   An entry is its title in Aphesis Script, the author and year in meta, the note, and at most one quote in its own
   language with the English in the tooltip (and, for screen readers, in the text). Text never types itself: a leaf
   leaves with a quick fade and blur, and the next enters with the system's soft entrance (a blur and a rise). */

import { roman } from './numerals.js';

const A = window.Aphesis;
const $ = (id) => document.getElementById(id);

export function createLeaf(entries, { onChoose }) {
  const els = {
    leaf: $('leaf'), entry: $('entry'), title: $('eTitle'), meta: $('eMeta'), note: $('eNote'), quote: $('eQuote'),
    index: $('index'), list: $('indexList'), button: $('bIndex'), folio: $('folio'),
  };
  const n = entries.length;
  let shown = -1, pending = null, open = false;

  /* ---------- the soft entrance ---------- */
  function enter(el) {
    el.classList.remove('enter');
    void el.offsetWidth;   /* restart the animation */
    el.classList.add('enter');
  }

  /* ---------- one entry ---------- */
  function fill(i) {
    const e = entries[i];
    els.title.textContent = e.title;
    els.meta.textContent = e.author + ' · ' + e.year;
    els.note.replaceChildren(...e.note.map((t) => { const p = document.createElement('p'); p.textContent = t; return p; }));
    const q = els.quote, qp = q.querySelector('p');
    if (e.quote) {
      q.hidden = false;
      qp.textContent = e.quote;
      qp.lang = e.quote_lang || '';
      if (e.quote_en) {
        qp.dataset.tip = e.quote_en;
        const en = document.createElement('span');
        en.className = 'sr'; en.lang = 'en';
        en.textContent = ' (' + e.quote_en + ')';
        qp.appendChild(en);
      } else delete qp.dataset.tip;
    } else { q.hidden = true; qp.textContent = ''; }
    els.folio.textContent = roman(i + 1) + ' · ' + roman(n);
    els.leaf.scrollTop = 0;
    [...els.list.children].forEach((li, j) => {
      const b = li.firstElementChild;
      if (j === i) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
  }

  function show(i) {
    if (i === shown && !pending) return;
    shown = i;
    clearTimeout(pending);
    if (els.entry.classList.contains('was-shown') && !open) {
      els.entry.classList.remove('enter');
      els.entry.classList.add('leaving');
      pending = setTimeout(() => {
        pending = null;
        fill(shown);
        els.entry.classList.remove('leaving');
        enter(els.entry);
      }, 360);
    } else {
      pending = null;
      fill(i);
      els.entry.classList.add('was-shown');
      els.entry.classList.remove('leaving');
      if (!open) enter(els.entry);
    }
  }

  /* ---------- the contents ---------- */
  entries.forEach((e, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'aph-wave';
    b.dataset.cursor = '.7';
    b.innerHTML = '<span class="no aph-meta" aria-hidden="true"></span><span class="t"></span><span class="by aph-meta"></span>';
    b.querySelector('.no').textContent = roman(i + 1);
    b.querySelector('.t').textContent = e.title;
    b.querySelector('.by').textContent = e.author + ' · ' + e.year;
    A.letters(b.querySelector('.t'));
    b.setAttribute('aria-label', roman(i + 1) + ', ' + e.title + ', ' + e.author);
    b.addEventListener('click', () => { setOpen(false, false); onChoose(i); });
    li.appendChild(b);
    els.list.appendChild(li);
  });
  A.letters(els.button.querySelector('.name'));

  function setOpen(v, focus = true) {
    if (v === open) return;
    open = v;
    els.button.setAttribute('aria-expanded', String(v));
    document.documentElement.classList.toggle('index-open', v);
    els.leaf.scrollTop = 0;
    if (v) {
      els.entry.hidden = true;
      els.index.hidden = false;
      enter(els.index);
      if (focus) {
        const cur = els.list.querySelector('[aria-current]') || els.list.querySelector('button');
        cur.focus({ preventScroll: true });
      }
    } else {
      const inside = els.index.contains(document.activeElement);
      els.index.hidden = true;
      els.entry.hidden = false;
      if (pending) { clearTimeout(pending); pending = null; fill(shown); els.entry.classList.remove('leaving'); }
      enter(els.entry);
      if (focus && inside) els.button.focus({ preventScroll: true });
    }
  }
  els.button.addEventListener('click', () => setOpen(!open));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) setOpen(false); });

  return {
    show,
    get open() { return open; },
    close(focus) { setOpen(false, focus); },
  };
}
