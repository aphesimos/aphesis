/* 8 · the edge of the sky.
   The Flammarion engraving: a pilgrim at the end of the world puts his head through the vault of the sky. At first
   only the world is there, the stars, the sun, the tree; past the edge of the sky, nothing yet. The motion: press
   and hold, anywhere, with the mouse or a finger, or hold Enter or Space, and push: while held, what lies beyond the
   edge (the wheels and fires of the outer heavens) gathers out of the fog and the world behind dims. Let go and
   it slowly closes again. About nine seconds of holding opens it; a few red cells spark, and after a breath the
   chamber ends. At rest the beyond glimmers faintly: the only hint. */

import { MAPS } from '../assets.js';
import { image, cut, picture, hold, presses, smooth } from '../stage.js';

const A = window.Aphesis;
/* flammarion.png is 480 × 394 with a printed frame; the crop drops the frame. The edge of the sky runs from the
   pilgrim at the bottom left up to the top, through these points (map pixels); the beyond lies to its left. */
const CROP = [16, 16, 448, 350];
const EDGE = [[262, -10], [250, 0], [228, 33], [167, 108], [111, 222], [47, 355], [30, 400]];

export const sky = {
  id: 'sky',
  caption: 'the edge of the sky · Flammarion engraving, 1888',
  label: 'a pilgrim at the end of the world puts his head through the vault of the sky.',
  async create(ctx) {
    const img = await image(MAPS.flammarion);
    const base = cut(img, { crop: CROP });
    const W = base.width, H = base.height;
    const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
    /* the beyond: a soft mask left of the edge */
    const mask = mk(), kx = mask.getContext('2d');
    /* Safari's 2D canvas has no filter: there the runtime's box blur of the same radius */
    const viaFilter = typeof kx.filter === 'string' || !A.blur2d;
    if (viaFilter) kx.filter = 'blur(6px)';
    kx.fillStyle = '#fff'; kx.beginPath(); kx.moveTo(-20, -20);
    EDGE.forEach(([x, y]) => kx.lineTo(x - CROP[0], y - CROP[1]));
    kx.lineTo(-20, H + 20); kx.closePath(); kx.fill();
    if (!viaFilter) A.blur2d(kx, 6);
    const beyond = mk(), bx = beyond.getContext('2d');
    bx.drawImage(base, 0, 0); bx.globalCompositeOperation = 'destination-in'; bx.drawImage(mask, 0, 0);
    const world = mk(), wx = world.getContext('2d');
    wx.drawImage(base, 0, 0); wx.globalCompositeOperation = 'destination-out'; wx.drawImage(mask, 0, 0);
    const map = mk(), mx = map.getContext('2d');
    function draw(w, b) {
      mx.globalCompositeOperation = 'source-over'; mx.globalAlpha = 1;
      mx.fillStyle = '#000'; mx.fillRect(0, 0, W, H);
      mx.globalAlpha = w; mx.drawImage(world, 0, 0);
      /* the beyond is fainter than the world in the engraving: up to twice over, so it can outshine it */
      mx.globalCompositeOperation = 'lighter';
      for (let pass = b; pass > 0.004; pass -= 1) { mx.globalAlpha = Math.min(1, pass); mx.drawImage(beyond, 0, 0); }
      mx.globalCompositeOperation = 'source-over'; mx.globalAlpha = 1;
    }
    const mix = (e, glint) => [1 - 0.3 * e, 0.08 + 1.92 * e + glint];
    draw(...mix(0, 0));

    const portrait = innerHeight > innerWidth * 1.1;
    const sim = picture(ctx.root, { margin: portrait ? -0.25 : 0.06, gain: 1.15, erosion: 0.45, scatter: 0.55 });
    let playing = false, open = false, end = null, spark = 0, lastDraw = 0, drawnSig = '';
    const press = presses(() => playing);
    const h = hold(9, 22);
    return {
      pictures: [[sim, map]],
      play(done) { end = done; playing = true; },
      loop(dt, now) {
        const p = open ? 1 : h.step(dt, press.held);
        ctx.root.dataset.progress = p.toFixed(3);
        if (p >= 1 && !open) { open = true; setTimeout(() => end && end(), 3400); }
        if (open) spark = Math.min(1, spark + dt * 1.5);
        sim.o.accent = 0.05 * smooth(0, 1, spark);
        const e = A.MJ(p), glint = open ? 0 : 0.05 * (0.5 + 0.5 * Math.sin(now / 900)) * (1 - p);
        const [w, b] = mix(e, glint);
        sim.o.erosion = 0.45 - 0.12 * e;
        sim.o.gain = 1.15 + 0.15 * e;
        const sig = Math.round(w * 200) + ':' + Math.round(b * 150);
        if (sim.ready && sig !== drawnSig && now - lastDraw >= 66) { draw(w, b); sim.redraw(map); drawnSig = sig; lastDraw = now; }
      },
      destroy() { press.off(); },
    };
  },
};
