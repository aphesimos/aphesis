/* the plate: the picture page of the spread. Two Simulacrum canvases, made once and reused for the whole visit, so the
   page never holds more than the fog and these two. Turning the leaf dissolves the picture on one canvas while the
   next coalesces on the other; a canvas that has dissolved is stopped and waits, invisible, for the next picture.

   Each canvas covers the plate element (the left page, or the top of the screen in portrait), snapped to the stipple
   grid so its cells fall on the fog's. The plate's padding is the box the picture fits in: the runtime centres the
   picture in its canvas, and the margin is worked out per picture so it lands inside that box.
   A canvas only becomes visible once its first frame is drawn, and it fades out before it stops, so nothing flashes. */

import { once } from './motion.js';

const A = window.Aphesis;
const SHOW_MS = 2600, HIDE_MS = 1800;

export function createPlate(plateEl, pictures, before) {
  let want = -1;
  const layers = [0, 1].map(() => {
    const cv = document.createElement('canvas');
    cv.className = 'plate-layer';
    cv.setAttribute('aria-hidden', 'true');
    before.after(cv);
    const o = { ground: false, scatter: 0.5, erosion: 0.45, ceiling: 0.8, accent: 0.03, margin: 0.2 };
    const s = A.Simulacrum(cv, o);
    s.stop();
    return { cv, o, s, state: 'hidden', idx: -1, token: 0 };
  });

  /* ---------- geometry ---------- */
  let box = { w: 1, h: 1, W: 1, H: 1 };
  function place() {
    const r = plateEl.getBoundingClientRect(), cs = getComputedStyle(plateEl), c = A.cellPx(2);
    const snap = (v) => Math.round(v / c) * c;
    const left = snap(r.left), top = snap(r.top), W = Math.max(c, snap(r.width)), H = Math.max(c, snap(r.height));
    layers.forEach(({ cv }) => {
      Object.assign(cv.style, { left: left + 'px', top: top + 'px', width: W + 'px', height: H + 'px' });
    });
    const px = (k) => parseFloat(cs[k]) || 0;
    const padX = Math.max(px('paddingLeft'), px('paddingRight')), padY = Math.max(px('paddingTop'), px('paddingBottom'));
    box = { w: Math.max(40, W - 2 * padX), h: Math.max(40, H - 2 * padY), W, H };
    layers.forEach((l) => { if (l.idx >= 0) l.o.margin = margin(l.idx); });
  }
  /* the margin that makes a picture fill the plate's content box: contain-fit in the box, divided by contain-fit in
     the whole canvas */
  function margin(i) {
    const im = pictures[i].src, iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
    const inBox = Math.min(box.w / iw, box.h / ih), inCanvas = Math.min(box.W / iw, box.H / ih);
    return Math.max(0, Math.min(0.9, 1 - inBox / inCanvas));
  }

  /* ---------- one canvas: coalesce, dissolve ---------- */
  function show(l, i) {
    const tk = ++l.token;
    l.state = 'showing'; l.idx = i;
    l.o.margin = margin(i);
    l.s.start();
    l.s.drawn(() => { if (tk === l.token) l.cv.classList.add('on'); });
    once(SHOW_MS + 900, (go) => l.s.show(pictures[i], go), () => {
      if (tk !== l.token) return;
      l.state = 'shown';
      pump();
    });
  }
  function hide(l) {
    const tk = ++l.token;
    l.state = 'hiding';
    /* the canvas fades over duration-scene while its picture dissolves, so its mist never stands as a block */
    setTimeout(() => { if (tk === l.token) l.cv.classList.remove('on'); }, HIDE_MS - 1300);
    once(HIDE_MS + 900, (go) => l.s.hide(go), () => {
      if (tk !== l.token) return;
      setTimeout(() => {
        if (tk !== l.token) return;
        l.state = 'hidden';
        l.s.stop();
        pump();
      }, 160);
    });
  }
  const live = (l) => l.state === 'showing' || l.state === 'shown';

  /* bring the canvases toward the wanted picture: whatever shows another picture dissolves; the wanted picture
     coalesces on a canvas that still holds it (turning back mid-dissolve reverses it), or else on a free one. If both
     are busy dissolving, the next one to finish takes it. */
  function pump() {
    if (want < 0) return;
    layers.forEach((l) => { if (live(l) && l.idx !== want) hide(l); });
    if (layers.some((l) => live(l) && l.idx === want)) return;
    const back = layers.find((l) => l.state === 'hiding' && l.idx === want);
    if (back) return show(back, want);
    const free = layers.find((l) => l.state === 'hidden');
    if (free) show(free, want);
  }

  place();
  addEventListener('resize', place);
  return {
    to(i) { want = i; pump(); },
    place,
    /* for checks: what each canvas is doing */
    get states() { return layers.map((l) => l.state + ':' + l.idx); },
  };
}
