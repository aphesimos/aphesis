/* inscription: the list of works as one line drawn with the brush. Each work is a grain on the line, its name
   above it in the text face and its gloss below in Aphesis Script. The works share the width evenly: two face
   each other across the middle, more spread along the same line. When they no longer fit across, the line turns
   and runs down the screen, with the names to its right. The order is the order of content/works.json. */

import { grain, stroke, seedOf } from './marks.js';

const A = window.Aphesis;

export function createInscription(nav, works) {
  const list = nav.querySelector('#names'), svg = nav.querySelector('.line');
  const links = works.map((w) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.className = 'work aph-wave'; a.href = '#works-' + w.id; a.dataset.id = w.id;
    a.innerHTML = '<span class="name aph-ink"></span><span class="node"></span><span class="gl" lang=""></span>';
    a.querySelector('.name').textContent = w.name;
    a.querySelector('.node').innerHTML = grain(seedOf(w.id));
    const gl = a.querySelector('.gl');
    gl.textContent = w.gloss;
    gl.lang = /[Ͱ-Ͽἀ-῿]/.test(w.gloss) ? 'grc' : 'la';
    if (w.gloss_tip) a.dataset.tip = w.gloss_tip;
    a.setAttribute('aria-label', w.name + ', ' + w.gloss);
    li.appendChild(a); list.appendChild(li);
    A.letters(a.querySelector('.name'));
    a.querySelector('.name').removeAttribute('aria-label');
    return a;
  });

  /* lay the works out across, or down when they do not fit, and draw the line through their grains */
  function layout() {
    nav.classList.remove('stack');
    const avail = nav.parentElement.clientWidth - 2 * 16;
    const need = links.reduce((s, a) => s + a.scrollWidth, 0) + 20 * (links.length + 1);
    nav.classList.toggle('stack', need > Math.min(avail, 880));
    const r = nav.getBoundingClientRect();
    const pts = links.map((a) => { const n = a.querySelector('.node').getBoundingClientRect(); return [n.left + n.width / 2 - r.left, n.top + n.height / 2 - r.top]; });
    if (!pts.length) return;
    const seed = seedOf(works.map((w) => w.id).join(' '));
    if (nav.classList.contains('stack')) {
      const x = pts[0][0], ext = 40;
      stroke(svg, x, pts[0][1] - ext, x + 2, pts[pts.length - 1][1] + ext, seed);
    } else {
      const y = pts[0][1], first = pts[0][0], last = pts[pts.length - 1][0];
      const ext = Math.min(first, r.width - last, Math.max(64, (last - first) * 0.28));
      stroke(svg, first - ext, y + 1, last + ext, y - 1, seed);
    }
    nav.classList.add('drawn');
  }

  return { links, layout, link: (id) => links.find((a) => a.dataset.id === id) };
}
