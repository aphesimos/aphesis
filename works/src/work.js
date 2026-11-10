/* work: one work shown alone. Its gloss above its name in Aphesis Script, a short description, the year and the
   role in meta, links out over a brushed underline, and the ways on: back to all works, and on to the next. */

import { underline, seedOf } from './marks.js';

export function createWork(els, works) {
  let shown = null;
  function render(w) {
    els.gloss.textContent = w.gloss;
    els.gloss.lang = /[Ͱ-Ͽἀ-῿]/.test(w.gloss) ? 'grc' : 'la';
    if (w.gloss_tip) els.gloss.dataset.tip = w.gloss_tip; else delete els.gloss.dataset.tip;
    els.title.textContent = w.name;
    els.desc.textContent = w.description;
    els.meta.innerHTML = '';
    [w.year, w.role].filter(Boolean).forEach((t, i) => {
      if (i) { const s = document.createElement('span'); s.className = 'sep'; s.setAttribute('aria-hidden', 'true'); s.textContent = '·'; els.meta.appendChild(s); }
      els.meta.appendChild(document.createTextNode(t));
    });
    els.links.innerHTML = '';
    (w.links || []).forEach((l) => {
      const li = document.createElement('li'), a = document.createElement('a');
      a.className = 'ul enter'; a.href = l.href; a.target = '_blank'; a.rel = 'noopener';
      a.innerHTML = '<span class="txt"></span>';
      a.querySelector('.txt').textContent = l.label;
      a.setAttribute('aria-label', l.label + ' (opens elsewhere)');
      li.appendChild(a); els.links.appendChild(li);
    });
    const i = works.indexOf(w), next = works[(i + 1) % works.length];
    if (works.length > 1) {
      els.next.style.display = '';
      els.next.href = '#works-' + next.id;
      els.next.querySelector('.txt').textContent = 'next · ' + next.name;
    } else els.next.style.display = 'none';
    shown = w; draw();
  }
  /* underlines follow the text's width; redraw them when fonts or the screen change */
  function draw() {
    const s = seedOf(shown ? shown.id : 'works');
    els.links.querySelectorAll('a').forEach((a, i) => underline(a, s + i * 13));
    underline(els.back, 4021); if (els.next.style.display !== 'none') underline(els.next, 4057);
  }
  return { render, draw };
}
