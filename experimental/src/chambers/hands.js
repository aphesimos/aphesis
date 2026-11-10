/* the two hands.
   The Creation of Adam gathers out of the fog, then gives way to its detail: two hands, pulled apart.
   As the pointer (a finger, or the arrow keys) nears the space between them, the fingers close in, and they
   hesitate the nearer they come. They never touch. */

import { MAPS } from '../assets.js';
import { image, cut, layer, simulacrum, pointer, follower, smooth } from '../stage.js';
import { REDUCED, wait } from '../motion.js';

const A = window.Aphesis;
/* hands.png is 480 × 190; the fingertips leave a gap of 4 px around x 130, y 79. Padding the left side
   puts that gap on the axis of the screen. */
const W = 480, H = 190, GAP_X = 130, GAP_Y = 79, GAP = 4, PAD = W - 2 * GAP_X, PW = W + PAD;

export const hands = {
  id: 'hands',
  caption: 'the creation of adam · Michelangelo, Sistine Chapel, c. 1512',
  detail: 'the creation of adam, detail · Michelangelo, c. 1512',
  label: 'two hands reach for each other out of the fog; the fingers never touch.',
  async create(ctx) {
    const [imgC, imgH] = await Promise.all([image(MAPS.creation), image(MAPS.hands)]);
    const pad = [0, 0, 0, PAD];
    const left = cut(imgH, { pad, masks: [[GAP_X, 0, W - GAP_X, H]] });
    const right = cut(imgH, { pad, masks: [[0, 0, GAP_X, H]] });

    const lC = layer(ctx.root), lA = layer(ctx.root), lB = layer(ctx.root);
    const portrait = innerHeight > innerWidth * 1.1;
    const creation = simulacrum(lC, { margin: portrait ? 0.04 : 0.1, accent: 0.02 });
    const adam = simulacrum(lA, { margin: 0 }), god = simulacrum(lB, { margin: 0 });

    let geo = null, live = false, keyX = null, keyY = null, tremor = 0, cancelWait = null;
    const off = follower(0, 2.6);

    /* the hands' layers are wider than the screen, so their edges never show as they slide */
    function layout() {
      const vw = innerWidth, vh = innerHeight, a = vw / vh;
      const f = Math.max(0, Math.min(1, (a - 0.5) / 0.8));
      const Wd = Math.min(vw * (2.6 + (1.08 - 2.6) * f), vh * 2.2);
      const maxOff = Math.round(Math.max(48, vw * 0.11) / 2) * 2, Rw = vw + 2 * maxOff;
      [lA, lB].forEach((c) => { c.style.width = Rw + 'px'; c.style.left = -maxOff + 'px'; });
      const m = 1 - Wd / Rw;
      adam.o.margin = m; god.o.margin = m;
      const Hd = Wd * H / PW;
      geo = { vw, vh, maxOff, gx: vw / 2, gy: vh / 2 + (GAP_Y / H - 0.5) * Hd, gap: GAP / PW * Wd };
    }
    layout();
    off.set(geo.maxOff);
    const onResize = () => layout();
    addEventListener('resize', onResize);
    const onMove = (e) => { if (e.pointerType === 'mouse') keyX = keyY = null; };
    addEventListener('pointermove', onMove, { passive: true });

    function place(x) {
      const s = (v) => Math.round(v / 2) * 2;   /* whole cells only, so the stipple stays square and crisp */
      lA.style.transform = 'translateX(' + s(-x + tremor) + 'px)';
      lB.style.transform = 'translateX(' + s(x) + 'px)';
    }
    place(geo.maxOff);

    return {
      layers: [lC, lA, lB],
      enter(done) {
        lC.classList.add('on');
        creation.show(imgC, () => {
          cancelWait = wait(REDUCED ? 3000 : 2200, () => {
            creation.hide(() => lC.classList.remove('on'));
            ctx.setCaption(hands.detail);
            lA.classList.add('on'); lB.classList.add('on');
            adam.show(left); god.show(right, () => { live = true; done && done(); });
          });
        });
      },
      leave(done) {
        if (cancelWait) cancelWait();
        let n = 0; const one = () => { if (++n === 3) done && done(); };
        creation.hide(one); adam.hide(one); god.hide(one);
      },
      key(e) {
        const step = 0.06 * Math.min(innerWidth, innerHeight);
        const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
        if (!d) return false;
        if (keyX === null) { keyX = geo.gx + 0.38 * geo.vw; keyY = geo.gy + 0.3 * geo.vh; }
        keyX += d[0] * step; keyY += d[1] * step;
        return true;
      },
      loop(dt, now, paused) {
        if (paused || !geo) return;
        let x = geo.maxOff, e = 0;
        const has = keyX !== null || pointer.present;
        if (live && has) {
          const px = keyX !== null ? keyX : pointer.x, py = keyX !== null ? keyY : pointer.y;
          const d = Math.hypot(px - geo.gx, py - geo.gy);
          e = A.MJ(1 - Math.max(0, Math.min(1, (d - 20) / (0.5 * Math.max(geo.vw, geo.vh)))));
          /* fully near, the gap narrows to a third of what Michelangelo left, and no further */
          x = geo.maxOff + (-geo.gap / 3 - geo.maxOff) * e;
        }
        /* the nearer, the more the human hand hesitates */
        if (!REDUCED && e > 0.82 && Math.random() < dt * 3) tremor = (Math.random() < 0.5 ? -2 : 2) * smooth(0.82, 1, e);
        else if (e <= 0.82) tremor = 0;
        place(off.step(x, dt));
        const near = smooth(0.92, 1, e);
        adam.o.accent = 0.04 * near; god.o.accent = 0.04 * near;
      },
      destroy() {
        removeEventListener('resize', onResize); removeEventListener('pointermove', onMove);
        if (cancelWait) cancelWait();
        creation.stop(); adam.stop(); god.stop();
      },
    };
  },
};
