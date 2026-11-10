/* 5 · the wheel of fortune.
   The wheel from the pavement of Siena: a king enthroned above it, figures clinging to its rim as it carries them up
   and throws them down. The motion: circling, with the mouse or a finger, anywhere and in either direction
   (gestures.js counts the turns), or arrow keys and Space, a little each. The wheel turns with the hand: about four
   circles carry it once around, and as it turns the pavement comes clear out of the fog. The shown turn follows the
   real one in minimum-jerk steps, so nothing jumps, and a pause loses nothing. At rest the wheel rocks a little on
   its hub: the only hint. When it has gone once around, a few red cells spark in it, and after a breath the
   chamber ends. */

import { MAPS } from '../assets.js';
import { image, cut, picture, chaser, smooth } from '../stage.js';
import { circling } from '../gestures.js';

const TAU = Math.PI * 2;
/* fortune.jpg is 529 × 640. The crop keeps the king and the wheel; the hub sits at 264, 318 in the map,
   the outer edge of the lozenge ring about 140 px from it. Only the wheel turns: the king and the frame stay. */
const CROP = [44, 88, 440, 446], HX = 264 - 44, HY = 318 - 88, R = 140, TURNS = 4;

export const fortune = {
  id: 'fortune',
  caption: 'the wheel of fortune · Siena Cathedral pavement',
  label: 'a great wheel with figures clinging to its rim, a king enthroned above it, sunk in the fog.',
  async create(ctx) {
    const img = await image(MAPS.fortune);
    const base = cut(img, { crop: CROP });
    const map = document.createElement('canvas');
    map.width = base.width; map.height = base.height;
    const mx = map.getContext('2d');
    function draw(a) {
      mx.drawImage(base, 0, 0);
      mx.save();
      mx.beginPath(); mx.arc(HX, HY, R, 0, TAU); mx.clip();
      mx.fillStyle = '#000'; mx.fillRect(HX - R, HY - R, 2 * R, 2 * R);
      mx.translate(HX, HY); mx.rotate(a); mx.drawImage(base, -HX, -HY);
      mx.restore();
    }
    draw(0);

    const portrait = innerHeight > innerWidth * 1.1;
    const sim = picture(ctx.root, { margin: portrait ? 0.03 : 0.08, gain: 1.05, erosion: 0.5, scatter: 0.6, ceiling: 0.76 });
    const shown = chaser(900);
    let playing = false, turned = false, end = null, spark = 0, turns = 0, drawnA = 0, lastDraw = 0;

    const add = (k) => {
      if (!playing || turned) return;
      turns += k;
      shown.target = turns / TURNS;
    };
    const circles = circling(add);
    const onKey = (e) => {
      if (!playing) return;
      if (e.key.startsWith('Arrow') || e.key === ' ') { e.preventDefault(); add(0.25); }
    };
    addEventListener('keydown', onKey);

    return {
      pictures: [[sim, map]],
      play(done) { end = done; playing = true; },
      loop(dt, now) {
        const p = shown.step(now);
        ctx.root.dataset.progress = shown.target.toFixed(3);
        ctx.root.dataset.shown = p.toFixed(3);
        if (p > 0.999 && shown.target >= 1 && !turned) {
          turned = true;
          setTimeout(() => end && end(), 3400);
        }
        if (turned) spark = Math.min(1, spark + dt * 1.5);
        /* at rest the wheel rocks on its hub, less as it turns */
        const rock = turned ? 0 : 0.035 * Math.sin(now / 1100) * (1 - p);
        const a = TAU * p + rock;
        sim.o.gain = 1.05 + 0.2 * p;
        sim.o.erosion = 0.5 - 0.15 * p;
        sim.o.scatter = 0.6 - 0.15 * p;
        sim.o.ceiling = 0.76 + 0.06 * p;
        sim.o.accent = 0.05 * smooth(0, 1, spark);
        /* a new density map at most fifteen times a second, and only when the wheel has moved */
        if (sim.ready && Math.abs(a - drawnA) > 0.003 && now - lastDraw >= 66) { draw(a); sim.redraw(map); drawnA = a; lastDraw = now; }
      },
      destroy() { circles.off(); removeEventListener('keydown', onKey); },
    };
  },
};
