/* the scholar.
   Caravaggio's Saint Jerome writing. As his sentences are typed into the fog, the picture gathers with them:
   each letter brings more of him out of the stipple, and when a line is erased he thins again. */

import { MAPS } from '../assets.js';
import { image, layer, simulacrum, follower } from '../stage.js';
import { inscribe } from '../inscribe.js';

const LINES = [
  { text: 'facito aliquid operis, ut te semper diabolus inveniat occupatum', en: 'always be doing some work, so that the devil may find you busy', src: 'Jerome, letter 125' },
  { text: 'ama scientiam scripturarum, et carnis vitia non amabis', en: 'love the knowledge of the scriptures, and you will not love the vices of the flesh', src: 'Jerome, letter 125' },
  { text: 'facile contemnit omnia, qui se semper cogitat moriturum', en: 'he easily scorns all things who always remembers that he will die', src: 'Jerome, letter 53' },
];

export const scholar = {
  id: 'scholar',
  caption: 'saint jerome writing · Caravaggio, 1605–06',
  label: 'an old man writes by a skull; he grows clearer as his words are typed.',
  async create(ctx) {
    const img = await image(MAPS.jerome);
    const portrait = innerHeight > innerWidth * 1.1;
    const l = layer(ctx.root);
    const sim = simulacrum(l, { margin: portrait ? -0.45 : 0.06, gain: 0.42, accent: 0.02 });
    const text = inscribe(ctx.root, { cls: 'scholar-text', lang: 'la', lines: LINES, hold: 7000 });
    const gain = follower(0.42, 2.2);
    let floor = 0.42, started = false;

    return {
      layers: [l],
      texts: [text.el],
      enter(done) {
        l.classList.add('on');
        sim.show(img, done);
        setTimeout(() => { text.start(); started = true; }, 900);
      },
      leave(done) { text.stop(); sim.hide(done); },
      key() { return false; },
      loop(dt, now, paused) {
        if (paused || !started) return;
        const k = text.progress();
        if (k > 0.98) floor = 0.55;   /* once he has been written whole, he never quite leaves */
        sim.o.gain = gain.step(floor + (1.02 - floor) * k, dt);
        sim.o.scatter = 0.5 + 0.25 * (1 - k);
      },
      destroy() { text.destroy(); sim.stop(); },
    };
  },
};
