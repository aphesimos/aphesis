/* 2 · the two hands.
   The detail of the Creation of Adam, pulled apart: the two hands are two simulacra on canvases wider than the
   screen, slid sideways in whole cells. The motion: press and hold where the fingers meet (a generous zone, at
   least 160 px around the gap), with the mouse or a finger, or hold Enter or Space. While held the fingers drift
   together; let go and they slowly part again. About two and a half seconds of holding makes them touch: a few
   red cells spark, and after a breath the chamber ends. At rest the gap breathes a little: the only hint. */

import { MAPS } from '../assets.js';
import { image, cut, picture, hold, presses, smooth, snap, screen } from '../stage.js';

const A = window.Aphesis;
/* hands.png is 480 × 190; the fingertips leave a gap of 4 px around x 130, y 79. Padding the left side
   puts that gap on the axis of the screen. */
const W = 480, H = 190, GAP_X = 130, GAP_Y = 79, GAP = 4, PAD = W - 2 * GAP_X, PW = W + PAD;

export const hands = {
  id: 'hands',
  caption: 'the creation of adam, detail · Michelangelo, c. 1512',
  label: 'two hands reach for each other out of the fog, the fingers apart.',
  async create(ctx) {
    const imgH = await image(MAPS.hands);
    const pad = [0, 0, 0, PAD];
    const left = cut(imgH, { pad, masks: [[GAP_X, 0, W - GAP_X, H]] });
    const right = cut(imgH, { pad, masks: [[0, 0, GAP_X, H]] });
    const adam = picture(ctx.root, { margin: 0 }), god = picture(ctx.root, { margin: 0 });
    const lA = adam.canvas, lB = god.canvas;

    let geo = null;
    function layout() {
      const vw = innerWidth, vh = screen().h, a = vw / vh;
      const f = Math.max(0, Math.min(1, (a - 0.5) / 0.8));
      const Wd = Math.min(vw * (2.6 + (1.08 - 2.6) * f), vh * 2.2);
      const maxOff = snap(Math.max(48, vw * 0.11)), Rw = vw + 2 * maxOff;
      [adam, god].forEach((p) => p.place({ left: -maxOff, top: 0, width: Rw, height: screen().h }));
      const m = 1 - Wd / Rw;
      adam.o.margin = m; god.o.margin = m;
      const Hd = Wd * H / PW;
      geo = { vw, vh, maxOff, gx: vw / 2, gy: vh / 2 + (GAP_Y / H - 0.5) * Hd, gap: GAP / PW * Wd };
      geo.zone = Math.max(160, Math.min(vw, vh) * 0.28);
      ctx.root.dataset.gap = Math.round(geo.gx) + ',' + Math.round(geo.gy) + ',' + Math.round(geo.zone);
    }
    layout();
    addEventListener('resize', layout);

    function place(x) {
      /* whole cells only, so the stipple stays square, crisp and on the fog's grid */
      lA.style.transform = 'translateX(' + snap(-x) + 'px)';
      lB.style.transform = 'translateX(' + snap(x) + 'px)';
    }
    place(geo.maxOff);

    let playing = false, touched = false, end = null, spark = 0;
    const press = presses((e) => playing && Math.hypot(e.clientX - geo.gx, e.clientY - geo.gy) < geo.zone);
    const h = hold(2.5, 7);

    return {
      pictures: [[adam, left], [god, right]],
      play(done) { end = done; playing = true; },
      loop(dt, now) {
        const p = touched ? 1 : h.step(dt, press.held);
        ctx.root.dataset.progress = p.toFixed(3);
        if (p >= 1 && !touched) {
          touched = true;
          ctx.setCaption('the touch · Michelangelo, c. 1512');
          setTimeout(() => end && end(), 3600);
        }
        /* apart: each hand is maxOff away; touching: each crosses half the painted gap */
        const breathe = touched ? 0 : 5 * (0.5 - 0.5 * Math.cos(now / 1400)) * (1 - p);
        const x = geo.maxOff + (-geo.gap / 2 - geo.maxOff) * A.MJ(p) - breathe;
        place(x);
        if (touched) spark = Math.min(1, spark + dt * 1.5);
        adam.o.accent = god.o.accent = 0.05 * smooth(0, 1, spark);
      },
      destroy() { removeEventListener('resize', layout); press.off(); },
    };
  },
};
