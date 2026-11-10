/* 6 · the veil.
   Strazza's veiled virgin, under a second veil: a shroud of fog that hides even the marble one. The motion: drag,
   with the mouse or a finger, slowly, as if lifting cloth upward; what counts is how far the hand travels while
   pressed, in any direction, not the path. Arrow keys, Space or Enter lift it a little each. The shroud's hem rises
   from her breast over her mouth, her eyes and her brow, and the sculpture comes clear beneath it; the hem follows
   the hand in minimum-jerk steps. At rest the hem stirs: the only hint. When the shroud has lifted off, a few red
   cells spark, the caption gives Heraclitus's line, and after a breath the chamber ends. She is still veiled. */

import { MAPS } from '../assets.js';
import { image, picture, chaser, dragging, smooth } from '../stage.js';

export const veil = {
  id: 'veil',
  caption: 'the veiled virgin · Giovanni Strazza, c. 1850s',
  label: 'a marble bust under a veil, and over it a shroud of fog.',
  async create(ctx) {
    const img = await image(MAPS.veiled);
    const W = img.naturalWidth, H = img.naturalHeight;
    const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
    /* the shroud: the bust blurred into a soft mass, dimmer than the marble */
    const shroud = mk(), sx = shroud.getContext('2d');
    sx.fillStyle = '#000'; sx.fillRect(0, 0, W, H);
    sx.filter = 'blur(8px) brightness(0.62)'; sx.drawImage(img, 0, 0); sx.filter = 'none';
    const mask = mk(), kx = mask.getContext('2d');
    const part = mk(), px = part.getContext('2d');
    const map = mk(), mx = map.getContext('2d');
    /* the map: marble below the hem, shroud above it; the hem a soft, slightly wavy line at height y */
    function draw(y, phase) {
      kx.clearRect(0, 0, W, H);
      kx.filter = 'blur(' + Math.round(H * 0.05) + 'px)';
      kx.fillStyle = '#fff';
      kx.beginPath(); kx.moveTo(-60, -60); kx.lineTo(W + 60, -60);
      for (let x = W + 60; x >= -60; x -= 12) kx.lineTo(x, y + H * 0.018 * Math.sin(x / 47 + phase) + H * 0.01 * Math.sin(x / 19 - phase * 1.7));
      kx.closePath(); kx.fill(); kx.filter = 'none';
      px.globalCompositeOperation = 'copy'; px.drawImage(shroud, 0, 0);
      px.globalCompositeOperation = 'destination-in'; px.drawImage(mask, 0, 0);
      px.globalCompositeOperation = 'source-over';
      mx.globalCompositeOperation = 'copy'; mx.drawImage(img, 0, 0);
      mx.globalCompositeOperation = 'destination-out'; mx.drawImage(mask, 0, 0);
      mx.globalCompositeOperation = 'lighter'; mx.drawImage(part, 0, 0);
      mx.globalCompositeOperation = 'destination-over'; mx.fillStyle = '#000'; mx.fillRect(0, 0, W, H);
      mx.globalCompositeOperation = 'source-over';
    }
    const hem = (p) => H * (0.72 - 1.02 * p);   /* at first the shroud covers the head and leaves the marble of the breast bare */
    draw(hem(0), 0);

    const portrait = innerHeight > innerWidth * 1.1;
    /* sculpture on a plain ground: erosion .5, scatter .85, ceiling .76 */
    const sim = picture(ctx.root, { margin: portrait ? 0.04 : 0.07, erosion: 0.5, scatter: 0.85, ceiling: 0.76, gain: 1.05 });
    const shown = chaser(650);
    const need = () => Math.max(1400, 2.8 * Math.min(innerWidth, innerHeight));
    let playing = false, lifted = false, end = null, spark = 0, moved = 0, lastDraw = 0, drawnSig = '', lastKey = 0;
    const add = (px2) => {
      if (!playing || lifted) return;
      moved += px2;
      shown.target = moved / need();
    };
    const drag = dragging(add, () => playing);
    const onKey = (e) => {
      if (!playing) return;
      if (e.key.startsWith('Arrow') || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        const t = performance.now();
        if (e.repeat && t - lastKey < 90) return;
        lastKey = t; add(need() * 0.04);
      }
    };
    addEventListener('keydown', onKey);

    return {
      pictures: [[sim, map]],
      play(done) { end = done; playing = true; },
      loop(dt, now) {
        const p = shown.step(now);
        ctx.root.dataset.progress = Math.min(1, shown.target).toFixed(3);
        ctx.root.dataset.shown = p.toFixed(3);
        if (p > 0.999 && shown.target >= 1 && !lifted) {
          lifted = true;
          ctx.setCaption('φύσις κρύπτεσθαι φιλεῖ · nature loves to hide');
          setTimeout(() => end && end(), 3600);
        }
        if (lifted) spark = Math.min(1, spark + dt * 1.5);
        sim.o.accent = 0.05 * smooth(0, 1, spark);
        sim.o.gain = 1.05 + 0.15 * p;
        /* the hem stirs while there is a shroud to stir */
        const phase = now / 1300;
        const y = hem(p), sig = Math.round(y) + ':' + (p < 0.999 ? Math.round(phase * 20) : 'still');
        if (sim.ready && sig !== drawnSig && now - lastDraw >= 66) { draw(y, phase); sim.redraw(map); drawnSig = sig; lastDraw = now; }
      },
      destroy() { drag.off(); removeEventListener('keydown', onKey); },
    };
  },
};
