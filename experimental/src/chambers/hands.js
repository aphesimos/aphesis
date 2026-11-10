/* 2 · the two hands.
   Michelangelo's Creation of Adam, pulled apart at the touch: Adam's side and God's side are two simulacra on
   canvases wider than the screen, slid sideways in whole cells. The meeting point of the fingers is the centre of the
   composition, on the screen's centre, in both crops:
     wide screens: the whole fresco panel, Adam reclining on the left, God and the figures in his mantle on the right;
     phones and narrow screens: the hands alone.
   Each map is padded with empty (black) so that the fingers' gap sits in the middle of it, and split along a line
   that runs through the gap, so each half carries its own figure whole.
   The motion: press and hold where the fingers meet (a generous zone, at least 160 px around the gap), with the mouse
   or a finger, or hold Enter or Space. While held the fingers drift together; let go and they slowly part again.
   About two and a half seconds of holding makes them touch: a few red cells spark, and after a breath the chamber
   ends. At rest the gap breathes and the two fingertips glow faintly in the stipple, brighter while held: the only
   hint of where to act. */

import { MAPS } from '../assets.js';
import { image, picture, hold, presses, smooth, snap, screen } from '../stage.js';

const A = window.Aphesis;
/* the maps (system/assets/Simulacra), in their own pixels: gx, gy the middle of the gap between the fingertips,
   gap its width, split the line that parts Adam's side from God's, tips the two fingertips */
const CROPS = {
  full: {
    map: 'panel', W: 640, H: 290, gx: 242.4, gy: 132, gap: 2,
    split: [[242.4, -2], [242.4, 132], [262, 205], [298, 292]],
    tips: [[241.4, 132.9], [243.4, 131.1]],
    caption: 'the creation of adam · Michelangelo, c. 1512',
    label: 'a man reclines on the left and reaches out; from the right an old man borne by figures in a mantle reaches back. their fingers do not touch.',
  },
  hands: {
    map: 'hands', W: 640, H: 268, gx: 319.6, gy: 139, gap: 8,
    split: [[319.6, -2], [319.6, 270]],
    tips: [[315.5, 142.9], [323.7, 135.5]],
    caption: 'the creation of adam, detail · Michelangelo, c. 1512',
    label: 'two hands reach for each other out of the fog, the fingers apart.',
  },
};
/* the whole panel needs room: a landscape screen at least 700 px wide */
const wide = () => innerWidth >= 700 && innerWidth / screen().h >= 1.15;

export const hands = {
  id: 'hands',
  caption: CROPS.full.caption,
  label: CROPS.full.label,
  async create(ctx) {
    const C = wide() ? CROPS.full : CROPS.hands;
    hands.caption = C.caption; hands.label = C.label;
    const img = await image(MAPS[C.map]);
    /* pad so the gap is the middle of the padded map */
    const pl = Math.max(0, C.W - 2 * C.gx), pr = Math.max(0, 2 * C.gx - C.W);
    const pt = Math.max(0, C.H - 2 * C.gy), pb = Math.max(0, 2 * C.gy - C.H);
    const PW = Math.round(C.W + pl + pr), PH = Math.round(C.H + pt + pb);
    const ox = pl, oy = pt;
    const mk = () => { const c = document.createElement('canvas'); c.width = PW; c.height = PH; return c; };
    /* each half: the map clipped to its side of the split line, then the fingertip's glow */
    function side(left) {
      const c = mk(), x = c.getContext('2d');
      const base = mk(), bx = base.getContext('2d');
      bx.fillStyle = '#000'; bx.fillRect(0, 0, PW, PH);
      bx.save();
      bx.beginPath();
      const edge = left ? -10 : PW + 10;
      bx.moveTo(edge, -10);
      C.split.forEach(([sx, sy]) => bx.lineTo(sx + ox, sy + oy));
      bx.lineTo(edge, PH + 10);
      bx.closePath(); bx.clip();
      bx.drawImage(img, ox, oy);
      bx.restore();
      const [tx, ty] = C.tips[left ? 0 : 1];
      return { c, x, base, tx: tx + ox, ty: ty + oy };
    }
    const L = side(true), R = side(false);
    /* the glow: a soft swell of density around the fingertip, never more than a faint light */
    const rad = Math.max(10, C.W * 0.035);
    function draw(s, k) {
      s.x.globalCompositeOperation = 'copy'; s.x.drawImage(s.base, 0, 0);
      s.x.globalCompositeOperation = 'lighter';
      const v = Math.round(255 * Math.max(0, Math.min(1, k)));
      const g = s.x.createRadialGradient(s.tx, s.ty, 0, s.tx, s.ty, rad);
      g.addColorStop(0, `rgb(${v},${v},${v})`); g.addColorStop(0.45, `rgb(${v >> 1},${v >> 1},${v >> 1})`); g.addColorStop(1, '#000');
      s.x.fillStyle = g; s.x.fillRect(s.tx - rad, s.ty - rad, 2 * rad, 2 * rad);
      s.x.globalCompositeOperation = 'source-over';
    }
    draw(L, 0.3); draw(R, 0.3);

    const opts = { margin: 0, gain: 1.15, erosion: 0.46, scatter: 0.55, ceiling: 0.8 };
    const adam = picture(ctx.root, opts), god = picture(ctx.root, opts);
    const lA = adam.canvas, lB = god.canvas;

    let geo = null;
    function layout() {
      const vw = innerWidth, vh = screen().h;
      let Wd;
      if (C === CROPS.full) {
        /* the painting whole: its far (right) side within 42% of the screen from the centre (God's half starts
           slid a little further out), its height within 78% */
        const s = Math.min(0.42 * vw / (C.W - C.gx), 0.78 * vh / C.H);
        Wd = PW * s;
      } else {
        const a = vw / vh, f = Math.max(0, Math.min(1, (a - 0.5) / 0.8));
        Wd = Math.min(vw * (1.7 + (1.08 - 1.7) * f), vh * 2.2);
      }
      const maxOff = snap(C === CROPS.full ? Math.max(48, vw * 0.06) : Math.max(40, vw * 0.1));
      const Rw = vw + 2 * maxOff;
      /* the canvases are as tall as the screen; where the map would be bound by the height, they grow taller,
         centred, so the width always binds and the gap stays on the screen's centre */
      const Hc = Math.max(vh, Rw * PH / PW + 2);
      [adam, god].forEach((p) => p.place({ left: -maxOff, top: (vh - Hc) / 2, width: Rw, height: Hc }));
      const m = 1 - Wd / Rw;
      adam.o.margin = m; god.o.margin = m;
      geo = { vw, vh, maxOff, gx: vw / 2, gy: vh / 2, gap: C.gap / PW * Wd };
      geo.zone = Math.max(160, Math.min(vw, vh) * 0.28);
      ctx.root.dataset.gap = Math.round(geo.gx) + ',' + Math.round(geo.gy) + ',' + Math.round(geo.zone);
      ctx.root.dataset.crop = C === CROPS.full ? 'full' : 'hands';
    }
    layout();
    addEventListener('resize', layout);

    function place(x) {
      /* whole cells only, so the stipple stays square, crisp and on the fog's grid */
      lA.style.transform = 'translateX(' + snap(-x) + 'px)';
      lB.style.transform = 'translateX(' + snap(x) + 'px)';
    }
    place(geo.maxOff);

    let playing = false, touched = false, end = null, spark = 0, lastDraw = 0, drawnSig = -1;
    const press = presses((e) => playing && Math.hypot(e.clientX - geo.gx, e.clientY - geo.gy) < geo.zone);
    const h = hold(2.5, 7);

    return {
      pictures: [[adam, L.c], [god, R.c]],
      play(done) { end = done; playing = true; },
      loop(dt, now) {
        const p = touched ? 1 : h.step(dt, press.held);
        ctx.root.dataset.progress = p.toFixed(3);
        if (p >= 1 && !touched) {
          touched = true;
          ctx.setCaption('the touch · Michelangelo, c. 1512');
          setTimeout(() => end && end(), 3600);
        }
        /* apart: each half is maxOff away; touching: each crosses half the painted gap */
        const wave = 0.5 - 0.5 * Math.cos(now / 1400);
        const breathe = touched ? 0 : 5 * wave * (1 - p);
        const x = geo.maxOff + (-geo.gap / 2 - geo.maxOff) * A.MJ(p) - breathe;
        place(x);
        if (touched) spark = Math.min(1, spark + dt * 1.5);
        adam.o.accent = god.o.accent = 0.05 * smooth(0, 1, spark);
        /* the fingertips' glow breathes with the gap and gathers while held; it settles once they touch */
        const k = touched ? 0.35 * (1 - spark) : 0.22 + 0.2 * wave + 0.35 * p;
        const sig = Math.round(k * 40);
        if (adam.ready && god.ready && sig !== drawnSig && now - lastDraw >= 100) {
          draw(L, k); draw(R, k); adam.redraw(L.c); god.redraw(R.c); drawnSig = sig; lastDraw = now;
        }
      },
      destroy() { removeEventListener('resize', layout); press.off(); },
    };
  },
};
