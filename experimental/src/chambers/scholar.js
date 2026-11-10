/* 3 · the scholar.
   Caravaggio's Saint Jerome writing, first barely there, a dim shape in the dark. The motion: press and hold,
   anywhere, with the mouse or a finger, or hold Enter or Space: light gathers on him. Let go and it slowly
   ebbs. About four seconds of holding reveals him whole; he stays a breath, and the chamber ends.
   At rest the light flickers faintly, as a candle would: the only hint. */

import { MAPS } from '../assets.js';
import { image, picture, hold, presses } from '../stage.js';

const A = window.Aphesis;

export const scholar = {
  id: 'scholar',
  caption: 'saint jerome writing · Caravaggio, 1605–06',
  label: 'an old man writes by a skull, almost lost in the dark.',
  async create(ctx) {
    const img = await image(MAPS.jerome);
    const portrait = innerHeight > innerWidth * 1.1;
    const sim = picture(ctx.root, { margin: portrait ? -0.45 : 0.06, gain: 0.45, erosion: 0.7, scatter: 0.75 });
    let playing = false, whole = false, end = null;
    const press = presses(() => playing);
    const h = hold(4, 10);
    return {
      pictures: [[sim, img]],
      play(done) { end = done; playing = true; },
      loop(dt, now) {
        const p = whole ? 1 : h.step(dt, press.held);
        ctx.root.dataset.progress = p.toFixed(3);
        if (p >= 1 && !whole) { whole = true; setTimeout(() => end && end(), 3200); }
        const e = A.MJ(p), flicker = whole ? 0 : 0.035 * Math.sin(now / 700) * Math.sin(now / 1900);
        sim.o.gain = 0.45 + (1.05 - 0.45) * e + flicker;
        sim.o.erosion = 0.7 - 0.5 * e;
        sim.o.scatter = 0.75 - 0.35 * e;
      },
      destroy() { press.off(); },
    };
  },
};
