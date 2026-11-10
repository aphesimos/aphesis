/* 7 · the alchemist.
   Wright of Derby's alchemist kneels by a glowing flask in a vault that is still all dark. The motion: strike, a
   click, a tap, Enter or Space, seven times, unhurried (strikes closer than 0.6 s count once). Each strike makes the
   flask flare, and its light reaches further into the room: him, the table, his assistants, the arches. Each step
   travels with minimum jerk. At rest the flame flickers: the only hint. At the seventh the room stands lit, a few
   red cells spark in the flask's light, and after a breath the chamber ends. */

import { MAPS } from '../assets.js';
import { image, cut, picture, chaser, swell, smooth } from '../stage.js';

const STRIKES = 7;
/* alchemist.jpg is 493 × 640; the flask glows at 338, 454 */
const FX = 338, FY = 454;

export const alchemist = {
  id: 'alchemist',
  caption: 'the alchemist · Joseph Wright of Derby, 1771',
  label: 'an old man kneels by a glowing flask in a dark vault.',
  async create(ctx) {
    const img = await image(MAPS.alchemist);
    const portrait = innerHeight > innerWidth * 1.1;
    const crop = portrait ? [0, 110, 493, 530] : [20, 220, 473, 410];
    const base = cut(img, { crop });
    const W = base.width, H = base.height, fx = FX - crop[0], fy = FY - crop[1];
    const map = document.createElement('canvas'); map.width = W; map.height = H;
    const mx = map.getContext('2d');
    const reach = Math.hypot(Math.max(fx, W - fx), Math.max(fy, H - fy));
    /* the room lit by the flask: the map multiplied by a light that falls off from it over radius r, never below floor */
    function draw(r, floor) {
      mx.globalCompositeOperation = 'copy'; mx.drawImage(base, 0, 0);
      mx.globalCompositeOperation = 'multiply';
      const g = mx.createRadialGradient(fx, fy, 0, fx, fy, Math.max(4, r));
      const f = Math.round(floor * 255), mid = Math.round((0.6 + 0.4 * floor) * 255);
      g.addColorStop(0, '#fff'); g.addColorStop(0.45, `rgb(${mid},${mid},${mid})`); g.addColorStop(1, `rgb(${f},${f},${f})`);
      mx.fillStyle = g; mx.fillRect(0, 0, W, H);
      mx.globalCompositeOperation = 'source-over';
    }
    const light = (p, flare, flicker) => [reach * (0.1 + 1.25 * p) * (1 + 0.18 * flare + flicker), 0.06 + 0.56 * p];
    draw(...light(0, 0, 0));

    const sim = picture(ctx.root, { margin: portrait ? 0.02 : 0.06, gain: 0.9, erosion: 0.55, scatter: 0.6 });
    const shown = chaser(1200);
    let playing = false, struck = 0, lit = false, end = null, flared = -1, lastStrike = -1e9, spark = 0, lastDraw = 0, drawnSig = '';
    const strike = () => {
      if (!playing || lit) return;
      const t = performance.now();
      if (t - lastStrike < 600) return;
      lastStrike = t;
      struck = Math.min(STRIKES, struck + 1);
      shown.target = struck / STRIKES;
      flared = t;
    };
    const onDown = (e) => { if (!(e.target.closest && e.target.closest('a, button'))) strike(); };
    const onKey = (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); strike(); } };
    addEventListener('pointerdown', onDown);
    addEventListener('keydown', onKey);

    return {
      pictures: [[sim, map]],
      play(done) { end = done; playing = true; },
      loop(dt, now) {
        const p = shown.step(now);
        ctx.root.dataset.progress = shown.target.toFixed(3);
        ctx.root.dataset.shown = p.toFixed(3);
        if (struck >= STRIKES && p > 0.999 && !lit) { lit = true; setTimeout(() => end && end(), 3400); }
        if (lit) spark = Math.min(1, spark + dt * 1.5);
        sim.o.accent = 0.05 * smooth(0, 1, spark);
        sim.o.erosion = 0.55 - 0.15 * p;
        sim.o.gain = 0.9 + 0.35 * p;
        const flicker = lit ? 0 : 0.035 * Math.sin(now / 230) * Math.sin(now / 610);
        const [r, floor] = light(p, swell(flared, now, 900), flicker);
        const sig = Math.round(r) + ':' + Math.round(floor * 100);
        if (sim.ready && sig !== drawnSig && now - lastDraw >= 66) { draw(r, floor); sim.redraw(map); drawnSig = sig; lastDraw = now; }
      },
      destroy() { removeEventListener('pointerdown', onDown); removeEventListener('keydown', onKey); },
    };
  },
};
