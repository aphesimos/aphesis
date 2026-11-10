/* 1 · the ouroboros.
   Cagnacci's Allegory of Human Life; the serpent above her head is redrawn by the brush as a living field.
   The motion: circling, with the mouse or a finger, anywhere and in either direction (gestures.js counts the turns).
   Arrow keys and Space add a little each. About five circles complete it (4.5 counted turns, since a hurried or dropped stretch of movement counts a little short). With every circle the serpent closes
   further around itself and the woman beneath slowly comes apart: erosion and scatter rise, gain falls.
   The shown progress follows the real one in minimum-jerk steps, so nothing jumps, and a pause loses nothing.
   At rest the open jaws nudge toward the tail. When the ring is whole the jaws close on it, a few red cells
   spark in the serpent, and after a breath the chamber ends. */

import { MAPS } from '../assets.js';
import { image, cut, picture, chaser, smooth } from '../stage.js';
import { circling } from '../gestures.js';

const A = window.Aphesis;
const TAU = Math.PI * 2;
/* the painted halo, in map pixels (cagnacci.jpg is 640 × 590) */
const HALO = { cx: 227, cy: 43, rx: 184, ry: 33, tilt: -0.04 };
const OPEN = TAU * 0.3, SHUT = TAU - 0.06, CIRCLES = 4.5;   /* counted turns; a slightly loose hand makes about five */

export const ouroboros = {
  id: 'ouroboros',
  caption: 'allegory of human life · Guido Cagnacci, c. 1650',
  label: 'a woman looks up; above her head a serpent made of fog reaches for its tail.',
  async create(ctx) {
    const img = await image(MAPS.cagnacci);
    const portrait = innerHeight > innerWidth * 1.1;
    /* landscape: halo, head, the raised hourglass. portrait: halo and head. the painted halo is cut away */
    const crop = portrait ? [0, 0, 470, 440] : [0, 0, 640, 360];
    const field = cut(img, { crop, masks: [[0, 0, 440, 100]] });
    const snake = document.createElement('canvas');
    snake.width = crop[2]; snake.height = crop[3];
    const sx = snake.getContext('2d');

    const margin = portrait ? 0.02 : 0.1;
    const woman = picture(ctx.root, { margin, accent: 0.02 });
    const serpent = picture(ctx.root, { margin, gain: 1.05, scatter: 0.4, erosion: 0.3, ceiling: 0.82 });

    const shown = chaser(900);
    let tail = Math.PI * 0.62, nudge = 0, bite = 0, playing = false, finished = false, lastDraw = 0, drawn = -1;

    function pt(a) {
      const x = HALO.rx * Math.cos(a), y = HALO.ry * Math.sin(a), c = Math.cos(HALO.tilt), s = Math.sin(HALO.tilt);
      return [HALO.cx + x * c - y * s, HALO.cy + x * s + y * c];
    }
    /* the serpent as a density map: back of the ring dimmer than the front, a head, jaws that close as it bites */
    function draw(span) {
      sx.fillStyle = '#000'; sx.fillRect(0, 0, snake.width, snake.height);
      const head = tail + span, n = Math.max(24, Math.round(span * 30)), body = [];
      for (let i = 0; i <= n; i++) body.push(pt(tail + span * i / n));
      sx.fillStyle = '#8a8a8a';
      sx.fill(new Path2D(A.brush(body, 10, 211, 0.34, 0.1)));
      let run = [];
      const flush = (seed) => { if (run.length > 3) { sx.fillStyle = '#fff'; sx.fill(new Path2D(A.brush(run, 9, seed, 0.12, 0.08))); } run = []; };
      body.forEach((p, i) => { const a = tail + span * i / n; if (Math.sin(a) > -0.15) run.push(p); else flush(213 + i); });
      flush(219);
      const hp = [];
      for (let i = 0; i <= 14; i++) hp.push(pt(head - 0.16 + 0.2 * i / 14));
      sx.fillStyle = '#fff'; sx.fill(new Path2D(A.brush(hp, 21, 223, 0.45, 0.05)));
      const tip = pt(head + 0.04), ahead = pt(head + 0.12), dx = ahead[0] - tip[0], dy = ahead[1] - tip[1], L = Math.hypot(dx, dy) || 1;
      const ux = dx / L, uy = dy / L, open = (1 - bite) * 0.55 + 0.12, len = 12;
      [-1, 1].forEach((side, i) => {
        const ca = Math.cos(open * side), sa = Math.sin(open * side);
        sx.fill(new Path2D(A.brush(A.line(tip[0], tip[1], tip[0] + (ux * ca - uy * sa) * len, tip[1] + (ux * sa + uy * ca) * len, 10), 3.4, 227 + i, 0.4, 0.06)));
      });
      const eye = pt(head - 0.06);
      sx.fillStyle = '#000'; sx.fill(new Path2D(A.brush(A.arc(eye[0], eye[1] - 2.5, 1.6, 0, 360, 12), 1.6, 229, 0, 0)));
    }
    draw(OPEN);

    let turns = 0;
    const add = (k) => {
      if (!playing || finished) return;
      turns += k;
      shown.target = turns / CIRCLES;
    };
    const circles = circling(add);
    const onKey = (e) => {
      if (!playing) return;
      if (e.key.startsWith('Arrow') || e.key === ' ') { e.preventDefault(); add(0.25); }
    };
    addEventListener('keydown', onKey);

    let end = null;
    return {
      pictures: [[woman, field], [serpent, snake]],
      play(done) { end = done; playing = true; },
      loop(dt, now) {
        const p = shown.step(now);
        ctx.root.dataset.progress = shown.target.toFixed(3);
        ctx.root.dataset.shown = p.toFixed(3);
        /* at rest, the jaws reach a little toward the tail and back: the only hint */
        if (!finished) { tail += dt * 0.03; nudge = 0.06 * Math.sin(now / 900) * (1 - p); }
        const span = OPEN + (SHUT - OPEN) * p + (finished ? 0 : nudge);
        if (p > 0.999 && shown.target >= 1 && !finished) {
          finished = true;
          ctx.setCaption('ἓν τὸ πᾶν · the one is the all');
          setTimeout(() => end && end(), 3600);
        }
        if (finished) bite = Math.min(1, bite + dt * 1.6);
        /* the moment of impact: a few red cells in the serpent as it bites */
        serpent.o.accent = 0.05 * smooth(0, 1, bite);
        /* the woman comes apart as the serpent closes */
        woman.o.erosion = 0.45 + 0.4 * p; woman.o.scatter = 0.5 + 0.35 * p; woman.o.gain = 1 - 0.5 * p;
        /* a new density map at most ten times a second, and only when it has changed */
        const sig = Math.round(span * 400) + bite * 1e4 + Math.round(tail * 400) * 1e6;
        if (now - lastDraw >= 100 && sig !== drawn && serpent.ready) { draw(span); serpent.redraw(snake); drawn = sig; lastDraw = now; }
      },
      destroy() { circles.off(); removeEventListener('keydown', onKey); },
    };
  },
};
