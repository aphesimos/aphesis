/* 5 · the ending.
   The door opens onto nothing: no picture, only more fog. A field of stipple gathers over everything, thin at
   first, then closing in from the edges toward the middle until the screen is swallowed (its gain rises over
   eight seconds; nothing is uploaded after the first frame). Under it, unseen but for a few holes, the door
   returns for the last time, filled with night and, once, in rubedo. The field dissolves and the door stands
   closed for good. No motion is asked; it only happens. Afterwards the seal in the corner is the way back,
   and the next visit begins the journey again. */

import { picture } from '../stage.js';
import { REDUCED, travel } from '../motion.js';


/* the density map: dense at the edges, emptier toward the middle, so rising gain fills it from the outside in */
function field() {
  const c = document.createElement('canvas'); c.width = 320; c.height = 200;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(160, 100, 0, 160, 100, 190);
  g.addColorStop(0, '#2a2a2a'); g.addColorStop(0.45, '#8c8c8c'); g.addColorStop(1, '#ffffff');
  x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
  return c;
}

export const ending = {
  id: 'ending',
  final: true,
  fog: 0.62,
  caption: '',
  label: 'the door opens onto nothing. the fog closes in until nothing is left.',
  async create(ctx) {
    const sim = picture(ctx.root, { fit: 'cover', margin: 0, gain: 0.25, scatter: 0.3, erosion: 0.4, ceiling: 0.86 });
    /* larger than the screen, so the picture's feathered edges never show as a frame */
    Object.assign(sim.canvas.style, { left: '-12vw', top: '-12vh', width: '124vw', height: '124vh' });
    const timers = [];
    let stop = () => {};
    return {
      pictures: [[sim, field()]],
      play(done) {
        stop = travel(REDUCED ? 0 : 8000, (e) => { sim.o.gain = 0.25 + 1.05 * e; sim.o.erosion = 0.4 - 0.15 * e; }, () => {
          ctx.door.seal();
          timers.push(setTimeout(done, REDUCED ? 2500 : 2600));
        });
      },
      loop() {},
      destroy() { stop(); timers.forEach(clearTimeout); },
    };
  },
};
