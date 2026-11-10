/* 4 · the emerald tablet.
   Hermes Trismegistus from the pavement of Siena, sunk in the fog. The motion: strike the tablet: each click,
   tap, Enter or Space brings him up one step, six in all. Each step travels with minimum jerk, and the fog around
   him shivers once as it lands. At the sixth he stands clear for a breath, and the chamber ends.
   At rest he sinks a little and rises again: the only hint. */

import { MAPS } from '../assets.js';
import { image, picture, chaser } from '../stage.js';

const STRIKES = 6;

export const tablet = {
  id: 'tablet',
  caption: 'hermes trismegistus · Siena Cathedral pavement, 1488',
  label: 'a robed figure on a stone pavement, sunk in the fog.',
  async create(ctx) {
    const img = await image(MAPS.trismegistus);
    const portrait = innerHeight > innerWidth * 1.1;
    const sim = picture(ctx.root, { margin: portrait ? 0.02 : 0.08, gain: 0.42, erosion: 0.8, scatter: 0.8, ceiling: 0.62 });
    const shown = chaser(1100);
    let playing = false, struck = 0, clear = false, end = null, shiver = -1;
    const strike = () => {
      if (!playing || clear) return;
      struck = Math.min(STRIKES, struck + 1);
      shown.target = struck / STRIKES;
      shiver = performance.now();
    };
    const onDown = (e) => { if (!(e.target.closest && e.target.closest('a, button'))) strike(); };
    const onKey = (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); strike(); } };
    addEventListener('pointerdown', onDown);
    addEventListener('keydown', onKey);
    return {
      pictures: [[sim, img]],
      play(done) { end = done; playing = true; },
      loop(dt, now) {
        const p = shown.step(now);
        ctx.root.dataset.progress = shown.target.toFixed(3);
        ctx.root.dataset.shown = p.toFixed(3);
        if (struck >= STRIKES && p > 0.999 && !clear) { clear = true; setTimeout(() => end && end(), 3200); }
        const rest = clear ? 0 : 0.04 * Math.sin(now / 1300) * (1 - p);
        /* the shiver: a smooth swell of loose points around him, 0.8 s, after each strike */
        const s = shiver < 0 || Math.max(0, Math.min(1, (now - shiver) / 800));
        const swell = s > 0 && s < 1 ? Math.sin(Math.PI * s) ** 2 : 0;
        sim.o.gain = 0.42 + 0.68 * p + rest;
        sim.o.erosion = 0.85 - 0.65 * p;
        sim.o.scatter = 0.8 - 0.45 * p + 0.25 * swell;
        sim.o.ceiling = 0.62 + 0.2 * p;
      },
      destroy() { removeEventListener('pointerdown', onDown); removeEventListener('keydown', onKey); },
    };
  },
};
