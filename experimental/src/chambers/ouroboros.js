/* the ouroboros.
   Cagnacci's Allegory of Human Life, with the serpent above her head redrawn by the brush as a living field.
   Circle the pointer (a finger, or the arrow keys) and the serpent travels round; its head reaches its tail and
   bites, and as you keep turning it swallows itself while the woman beneath slowly erodes. Stop, and it lets go. */

import { MAPS } from '../assets.js';
import { image, cut, layer, simulacrum } from '../stage.js';
import { REDUCED } from '../motion.js';

const A = window.Aphesis;
const TAU = Math.PI * 2;
/* the painted halo, in map pixels (cagnacci.jpg is 640 × 590) */
const HALO = { cx: 227, cy: 43, rx: 184, ry: 33, tilt: -0.04 };
const OPEN = TAU * 0.8, SHUT = TAU - 0.05;

export const ouroboros = {
  id: 'ouroboros',
  caption: 'allegory of human life · Guido Cagnacci, c. 1650',
  label: 'a woman looks up; above her head a serpent made of fog circles and eats its tail.',
  async create(ctx) {
    const img = await image(MAPS.cagnacci);
    const portrait = innerHeight > innerWidth * 1.1;
    /* landscape: halo, head, the raised hourglass. portrait: halo and head. the painted halo is cut away */
    const crop = portrait ? [0, 0, 470, 440] : [0, 0, 640, 360];
    const field = cut(img, { crop, masks: [[0, 0, 440, 100]] });
    const S = 1.5, snake = document.createElement('canvas');
    snake.width = crop[2] * S; snake.height = crop[3] * S;
    const sx = snake.getContext('2d');

    const margin = portrait ? 0.02 : 0.1;
    const lWoman = layer(ctx.root), lSnake = layer(ctx.root);
    const woman = simulacrum(lWoman, { margin, accent: 0.02 });
    const serpent = simulacrum(lSnake, { margin, gain: 1.05, scatter: 0.4, erosion: 0.3, ceiling: 0.82 });

    /* serpent state: tail angle, body span (radians), turns swallowed */
    let tail = Math.PI * 0.62, span = OPEN, eaten = 0, bite = 0, wound = 0, lastA = null, keyPush = 0, dirty = true, lastDraw = 0;

    function pt(a) {
      const x = HALO.rx * Math.cos(a), y = HALO.ry * Math.sin(a), c = Math.cos(HALO.tilt), s = Math.sin(HALO.tilt);
      return [(HALO.cx + x * c - y * s) * S, (HALO.cy + x * s + y * c) * S];
    }
    /* the serpent as a density map: back of the ring dimmer than the front, a head, open jaws */
    function draw() {
      sx.fillStyle = '#000'; sx.fillRect(0, 0, snake.width, snake.height);
      const head = tail + span, n = Math.max(24, Math.round(span * 34)), body = [];
      for (let i = 0; i <= n; i++) body.push(pt(tail + span * i / n));
      sx.fillStyle = '#8a8a8a';
      sx.fill(new Path2D(A.brush(body, 10 * S, 211, 0.34, 0.1)));
      /* the front of the ring, nearer to us, in full light */
      let run = [];
      const flush = (seed) => { if (run.length > 3) { sx.fillStyle = '#fff'; sx.fill(new Path2D(A.brush(run, 9 * S, seed, 0.12, 0.08))); } run = []; };
      body.forEach((p, i) => { const a = tail + span * i / n; if (Math.sin(a) > -0.15) run.push(p); else flush(213 + i); });
      flush(219);
      /* head: a swelling stroke along the last stretch of the body, slightly beyond it */
      const hp = [], hn = 14;
      for (let i = 0; i <= hn; i++) hp.push(pt(head - 0.16 + 0.2 * i / hn));
      sx.fillStyle = '#fff'; sx.fill(new Path2D(A.brush(hp, 21 * S, 223, 0.45, 0.05)));
      /* jaws, opening toward the tail; they close as it bites */
      const tip = pt(head + 0.04), ahead = pt(head + 0.12), dx = ahead[0] - tip[0], dy = ahead[1] - tip[1], L = Math.hypot(dx, dy) || 1;
      const ux = dx / L, uy = dy / L, open = (1 - bite) * 0.55 + 0.12, len = 12 * S;
      [-1, 1].forEach((side, i) => {
        const ca = Math.cos(open * side), sa = Math.sin(open * side);
        const ex = tip[0] + (ux * ca - uy * sa) * len, ey = tip[1] + (ux * sa + uy * ca) * len;
        sx.fill(new Path2D(A.brush(A.line(tip[0], tip[1], ex, ey, 10), 3.4 * S, 227 + i, 0.4, 0.06)));
      });
      /* the eye: a hole in the field */
      const eye = pt(head - 0.06);
      sx.fillStyle = '#000'; sx.fill(new Path2D(A.brush(A.arc(eye[0], eye[1] - 2.5 * S, 1.6 * S, 0, 360, 12), 1.6 * S, 229, 0, 0)));
    }
    draw();

    function turn(da) {
      /* the head goes where the hand goes; the tail only follows once the jaws have closed on it */
      if (da > 0) {
        const room = SHUT - span, grow = Math.min(room, da);
        span += grow; tail += da - grow;
        if (da - grow > 0) eaten += (da - grow) / TAU;
      } else {
        const give = Math.max(OPEN * 0.82 - span, da);
        span += give; tail += da - give;
      }
      wound = Math.min(1, wound + Math.abs(da) * 0.35);
      dirty = true;
    }

    const onMove = (e) => {
      if (e.pointerType !== 'mouse' && !e.buttons) { lastA = null; return; }
      const cx = innerWidth / 2, cy = innerHeight / 2, dx = e.clientX - cx, dy = e.clientY - cy;
      if (Math.hypot(dx, dy) < 30) { lastA = null; return; }
      const a = Math.atan2(dy, dx);
      if (lastA !== null) { let da = a - lastA; if (da > Math.PI) da -= TAU; if (da < -Math.PI) da += TAU; turn(da); }
      lastA = a;
    };
    const onUp = () => { lastA = null; };
    addEventListener('pointermove', onMove, { passive: true });
    addEventListener('pointerup', onUp);

    return {
      layers: [lWoman, lSnake],
      enter(done) {
        lWoman.classList.add('on'); lSnake.classList.add('on');
        woman.show(field);
        setTimeout(() => serpent.show(snake, done), REDUCED ? 0 : 900);
      },
      leave(done) { woman.hide(); serpent.hide(done); },
      key(e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { keyPush += 0.5; return true; }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { keyPush -= 0.5; return true; }
        return false;
      },
      loop(dt, now, paused) {
        if (paused) return;
        if (keyPush) { const d = keyPush * Math.min(1, dt * 5); keyPush -= d; if (Math.abs(keyPush) < 0.002) keyPush = 0; turn(d); }
        /* at rest the jaws let go and the ring drifts on its own */
        if (!REDUCED) {
          wound = Math.max(0, wound - dt * 0.6);
          if (wound < 0.05 && span > OPEN) { span -= (span - OPEN) * Math.min(1, dt * 0.35); dirty = true; }
          tail += dt * 0.035; dirty = true;
        }
        const shut = span > SHUT - 0.01;
        bite += ((shut ? 1 : 0) - bite) * Math.min(1, dt * (shut ? 6 : 1.2));
        /* the moment of impact: a few red cells in the serpent when it bites */
        serpent.o.accent = 0.05 * bite;
        /* time eats the figure: erosion grows with every turn swallowed, and heals slowly */
        eaten = Math.max(0, eaten - dt * 0.02);
        const worn = Math.min(0.75, eaten / 6);
        woman.o.erosion = 0.45 + 0.35 * worn; woman.o.gain = 1 - 0.4 * worn; woman.o.scatter = 0.5 + 0.3 * worn;
        if (dirty && now - lastDraw > 40 && serpent.ready) { draw(); serpent.redraw(snake); dirty = false; lastDraw = now; }
      },
      destroy() {
        removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp);
        woman.stop(); serpent.stop();
      },
    };
  },
};
