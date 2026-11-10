/* stipple fields on a 2D canvas: the bench's specimens drawn with the fog's own mark.

   A field is a density map (0 to 1) on the canvas's cell grid. Each cell lights where its fixed hash falls below the
   density, exactly as the fog decides, and a lit cell is painted in `fog` at .62; everything else stays transparent,
   so the specimen lies on the (calmed) fog with no box around it. One canvas pixel is one cell, Aphesis.cellPx(2) CSS
   pixels wide, scaled up with hard edges: cells are always crisp squares.

     const f = field(canvas);
     f.paint((W, H, D) => { ...fill D, a Float32Array of W*H, row by row from the top... });

   paint() remembers its painter and calls it again on resize and on a theme change. The canvas stays invisible
   until its first frame is on it (class `on`). */

import { onTheme } from './motion.js';

const A = window.Aphesis;

/* the cell's threshold: a fixed integer hash, uniform on [0, 1) */
export function cellHash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function field(canvas, { alpha = 0.62 } = {}) {
  const ctx = canvas.getContext('2d');
  canvas.style.imageRendering = 'pixelated';
  let painter = null, color = [0, 0, 0], img = null, H32 = null, gone = false;
  function readColor() { color = A.cssColor('--fog').map((v) => Math.round(v * 255)); }
  readColor();
  function grid() {
    const r = canvas.getBoundingClientRect(), c = A.cellPx(2);
    const W = Math.max(1, Math.round(r.width / c)), H = Math.max(1, Math.round(r.height / c));
    if (canvas.width !== W || canvas.height !== H || !img) {
      canvas.width = W; canvas.height = H;
      img = ctx.createImageData(W, H);
      H32 = new Float32Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) H32[y * W + x] = cellHash(x, y);
    }
    return [W, H];
  }
  function draw() {
    if (!painter || gone) return;
    const [W, H] = grid();
    const D = new Float32Array(W * H);
    painter(W, H, D);
    const px = img.data, a = Math.round(alpha * 255);
    for (let i = 0; i < W * H; i++) {
      const lit = H32[i] < D[i], o = i * 4;
      px[o] = color[0]; px[o + 1] = color[1]; px[o + 2] = color[2]; px[o + 3] = lit ? a : 0;
    }
    ctx.putImageData(img, 0, 0);
    canvas.classList.add('on');
  }
  const ro = new ResizeObserver(() => draw());
  ro.observe(canvas);
  const theme = () => { readColor(); draw(); setTimeout(() => { readColor(); draw(); }, 120); };
  onTheme(theme);
  return {
    canvas,
    paint(fn) { painter = fn; draw(); },
    redraw: draw,
    /* the canvas size in cells */
    size() { return grid(); },
    destroy() { gone = true; ro.disconnect(); },
  };
}
