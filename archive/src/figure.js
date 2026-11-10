/* figure: pictures inside a post, only as simulacra. One canvas for the whole section, created the first time a
   post holds a figure and moved into whichever figure is in view; with the fog that makes two WebGL canvases at
   most. The canvas stays invisible until the runtime says its first frame is drawn, then fades in while the
   picture coalesces out of the fog (2.6 s). Leaving the post, it dissolves (1.8 s) and rests. */

import { MAPS } from './assets.js';

const A = window.Aphesis;

/* a density map as a canvas: the runtime uploads canvases reliably on every GPU, plain image files not always.
   A figure from the content API names its map by URL (data-src); the build's own figures by name (data-map). */
const maps = new Map();
function mapCanvas(name) {
  if (!maps.has(name)) {
    maps.set(name, new Promise((resolve) => {
      const im = new Image();
      if (!MAPS[name]) im.crossOrigin = 'anonymous';   /* the content API serves its pictures with CORS */
      im.onload = () => {
        const c = document.createElement('canvas');
        c.width = im.naturalWidth; c.height = im.naturalHeight;
        c.getContext('2d').drawImage(im, 0, 0);
        resolve(c);
      };
      im.src = MAPS[name] || name;
    }));
  }
  return maps.get(name);
}

export function createFigures() {
  let canvas = null, sim = null, host = null, running = false, resting = null, observer = null;

  function ensure(box) {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.className = 'sim-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    /* in the document before the runtime reads the theme's colors from it */
    box.appendChild(canvas);
    /* ground: false leaves everything but the cells transparent, so the picture lies on the fog with no blend */
    sim = A.Simulacrum(canvas, { ground: false, fit: 'contain', margin: 0.1, scatter: 0.6, erosion: 0.5, ceiling: 0.8, accent: 0.03, gain: 1 });
    running = true;
  }

  function attach(fig) {
    if (host === fig) return;
    const box = fig.querySelector('.sim-box');
    ensure(box);
    if (resting) { clearTimeout(resting); resting = null; }
    host = fig;
    canvas.classList.remove('on');
    sim.hide();
    if (canvas.parentNode !== box) box.appendChild(canvas);
    if (!running) { sim.start(); running = true; }
    mapCanvas(fig.dataset.src || fig.dataset.map).then((map) => {
      if (host !== fig) return;
      /* the canvas appears only once a frame is on it */
      sim.drawn(() => requestAnimationFrame(() => { if (host === fig) canvas.classList.add('on'); }));
      sim.show(map);
    });
  }

  return {
    /* a post entered: watch its figures and conjure the one that comes into view */
    enter(view) {
      const figs = Array.from(view.querySelectorAll('figure.sim'));
      if (observer) observer.disconnect();
      if (!figs.length) return;
      observer = new IntersectionObserver((list) => {
        list.forEach((en) => { if (en.isIntersecting && en.intersectionRatio > 0.2) attach(en.target); });
      }, { threshold: [0, 0.2, 0.5] });
      figs.forEach((f) => observer.observe(f));
    },
    /* the post is leaving: dissolve, then rest the loop */
    leave() {
      if (observer) { observer.disconnect(); observer = null; }
      if (!sim || !host) return;
      host = null;
      sim.hide();
      resting = setTimeout(() => { canvas.classList.remove('on'); sim.stop(); running = false; resting = null; }, 1900);
    },
  };
}
