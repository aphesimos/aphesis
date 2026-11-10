/* viewer: a picture opened from a post. The thread recedes into the fog and the picture coalesces out of it as a live
   simulacrum, on the one canvas this section keeps for that (with the fog, never more than two WebGL canvases).
   The canvas is created once, stays invisible until its first frame is drawn, and rests (stops drawing) once closed.
   Without WebGL it shows the still simulacrum instead, large. The original is a link away; Escape or close returns. */

import { image, stillSimulacrum } from './thumb.js';
import { liveOptions, stillOptions } from './legible.js';

const A = window.Aphesis;
const $ = (id) => document.getElementById(id);
const HAS_GL = (() => { try { return !!document.createElement('canvas').getContext('webgl'); } catch (_) { return false; } })();

export function createViewer({ scroller, ground, announce }) {
  const root = $('viewer'), canvas = $('vcanvas'), still = $('vstill'), bar = $('vbar'), cap = $('vcap'), orig = $('vorig'), close = $('vclose');
  let sim = null, open = false, back = null, token = 0;

  function show(pic, returnTo) {
    if (open) return;
    open = true; back = returnTo || null; const my = ++token;
    root.hidden = false;
    cap.textContent = pic.caption || 'a picture';
    if (pic.original) { orig.hidden = false; orig.href = pic.original; } else { orig.hidden = true; }
    scroller.classList.add('away'); scroller.setAttribute('aria-hidden', 'true'); scroller.inert = true;
    ground.only([{ el: bar, pad: 14 }]);
    requestAnimationFrame(() => bar.classList.add('on'));
    close.focus({ preventScroll: true });
    announce('picture open: ' + (pic.caption || 'a picture'));
    const src = pic.density;
    if (HAS_GL) {
      if (!sim) sim = A.Simulacrum(canvas, Object.assign(liveOptions(), { ground: false, fit: 'contain', margin: 0.07, accent: 0.01 }));
      else sim.start();
      sim.show(src);
      sim.drawn(() => { if (open && my === token) canvas.classList.add('on'); });
    } else {
      image(pic.density).then((im) => {
        if (!open || my !== token) return;
        const box = [Math.min(innerWidth - 32, 720), Math.min(innerHeight - 200, 720)];
        still.innerHTML = stillSimulacrum(im, box, Object.assign(stillOptions(), { seed: 7 })).svg;
        requestAnimationFrame(() => still.classList.add('on'));
      }).catch(() => {});
    }
  }

  function hide() {
    if (!open) return;
    open = false; const my = ++token;
    bar.classList.remove('on'); still.classList.remove('on');
    scroller.classList.remove('away'); scroller.removeAttribute('aria-hidden'); scroller.inert = false;
    ground.column();
    /* the picture dissolves as its canvas fades, while the thread comes back; then the canvas rests */
    canvas.classList.remove('on');
    if (sim && HAS_GL) sim.hide();
    setTimeout(() => { if (my !== token) return; root.hidden = true; if (sim) sim.stop(); still.innerHTML = ''; }, 1400);
    if (back && document.contains(back)) back.focus({ preventScroll: true });
    announce('picture closed');
  }

  close.addEventListener('click', hide);
  addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); hide(); }
    /* keep the keyboard inside the dialog: original and close */
    if (e.key === 'Tab') {
      const items = [orig, close].filter((x) => !x.hidden);
      const i = items.indexOf(document.activeElement);
      e.preventDefault();
      items[(i + (e.shiftKey ? items.length - 1 : 1)) % items.length].focus();
    }
  });
  return { show, hide, get open() { return open; } };
}
