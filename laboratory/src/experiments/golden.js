/* the golden angle: why the fog turns its layers by 137.5°.

   Seeds are placed as a sunflower places them (Vogel's model): seed i at angle i·θ and radius √i, so each seed has
   the same share of area. Evenness is measured by the nearest-neighbour distances of all 300 seeds: their
   coefficient of variation (standard deviation over mean) is 0 when every seed is as far from its closest neighbour
   as every other, and grows as seeds crowd into spokes and spirals. The bench sweeps θ from 130° to 145° in steps of
   0.02°, refines the lowest point found in steps of 0.0005°, and shows the seeds for the angle under the slider. */

import { bench } from '../bench.js';
import { field } from '../stipple.js';
import { chart } from '../chart.js';
import { slider } from '../slider.js';
import { ticker, num } from '../motion.js';

const N = 300, LO = 130, HI = 145, STEP = 0.02, FINE = 0.0005, PER_FRAME = 8;
const GOLDEN = 360 * (1 - 2 / (1 + Math.sqrt(5))); // 137.50776…

function seeds(theta) {
  const xs = new Float64Array(N), ys = new Float64Array(N), k = theta * Math.PI / 180;
  for (let i = 0; i < N; i++) { const r = Math.sqrt(i + 0.5); xs[i] = r * Math.cos(i * k); ys[i] = r * Math.sin(i * k); }
  return [xs, ys];
}

/* coefficient of variation of nearest-neighbour distances */
export function spread(theta) {
  const [xs, ys] = seeds(theta);
  let s = 0, s2 = 0;
  for (let i = 0; i < N; i++) {
    let m = Infinity;
    for (let j = 0; j < N; j++) {
      if (j === i) continue;
      const dx = xs[i] - xs[j], dy = ys[i] - ys[j], q = dx * dx + dy * dy;
      if (q < m) m = q;
    }
    const d = Math.sqrt(m); s += d; s2 += d * d;
  }
  const mu = s / N;
  return Math.sqrt(Math.max(0, s2 / N - mu * mu)) / mu;
}

export function mount(host, ctx) {
  const b = bench(host);
  const cv = b.canvas('seeds', 'the seeds placed by the angle on the slider');
  const sow = field(cv);
  const curve = [];
  let angle = GOLDEN, minAt = null, minV = null, clock = null, i = 0, ymax = 0.6;

  const ch = chart(b.plot, {
    x: { min: LO, max: HI, ticks: [130, 135, 140, 145], fmt: (v) => v + '°', label: 'angle' },
    y: { min: 0, max: ymax, ticks: [0, 0.2, 0.4, 0.6], fmt: (v) => v.toFixed(1), label: 'unevenness of spacing' },
    height: 240,
    label: 'unevenness of nearest-neighbour spacing against the divergence angle, from 130 to 145 degrees',
    step: 0.1,
    readout: (x) => {
      if (!curve.length) return null;
      const k = Math.max(0, Math.min(curve.length - 1, Math.round((x - LO) / STEP)));
      return { x: curve[k][0], y: curve[k][1], text: `angle ${num(curve[k][0], 2)}° · unevenness ${num(curve[k][1], 4)} · enter or click sets the slider` };
    },
    idle: () => 'point at the curve to read it · a click sets the angle',
    pick: (x) => { set(Math.round(x / STEP) * STEP); },
  });
  const s = slider(b.controls, {
    min: LO, max: HI, step: 0.001, value: GOLDEN, name: 'angle',
    label: 'divergence angle in degrees', fmt: (v) => num(v, 3) + '°', input: (v) => set(v, true),
  });
  b.button('the golden angle', () => set(GOLDEN), '360° · (1 − 1/φ) = 137.508°');
  b.button('the lowest point measured', () => { if (minAt !== null) set(minAt); }, 'where the sweep found the most even spacing');

  function paintSeeds() {
    const [xs, ys] = seeds(angle), R = Math.sqrt(N);
    sow.paint((W, H, D) => {
      const scale = (Math.min(W, H) / 2 - 3) / R, cx = W / 2, cy = H / 2, rad = Math.max(1.4, scale * 0.5);
      for (let p = 0; p < N; p++) {
        const px = cx + xs[p] * scale, py = cy + ys[p] * scale;
        for (let y = Math.floor(py - rad); y <= Math.ceil(py + rad); y++) {
          if (y < 0 || y >= H) continue;
          for (let x = Math.floor(px - rad); x <= Math.ceil(px + rad); x++) {
            if (x < 0 || x >= W) continue;
            const q = Math.hypot(x + 0.5 - px, y + 0.5 - py) / rad;
            if (q < 1) D[y * W + x] = Math.max(D[y * W + x], 0.8 * (1 - q * q * 0.5));
          }
        }
      }
    });
    b.caption(`${N} seeds at ${num(angle, 3)}° · unevenness ${num(spread(angle), 4)}`);
  }

  function plot() {
    const layers = [];
    if (curve.length > 1) {
      layers.push({ type: 'area', pts: curve, density: 0.36, seed: 41, tone: 'soft' });
      layers.push({ type: 'line', pts: curve, width: 1.6, seed: 42, tone: 'ink' });
    }
    layers.push({ type: 'rule', x: GOLDEN, tone: 'soft', label: '137.508°', seed: 43 });
    layers.push({ type: 'rule', x: angle, tone: 'accent', seed: 44 });
    if (minAt !== null) layers.push({ type: 'ring', at: [minAt, minV], tone: 'accent', seed: 45 });
    ch.set(layers);
    ch.refresh();
  }

  function report() {
    ctx.values({
      angle: num(angle, 3) + '°', here: num(spread(angle), 4),
      minat: minAt === null ? '·' : num(minAt, 4) + '°', minv: minV === null ? '·' : num(minV, 4),
      golden: num(GOLDEN, 4) + '°', gv: num(spread(GOLDEN), 4),
      off: minAt === null ? '·' : num(Math.abs(minAt - GOLDEN), 4) + '°',
      second: curve.length ? secondBest() : '·',
      swept: String(curve.length),
      state: minAt === null ? 'the sweep is still measuring' : 'the sweep has ended',
    });
  }

  /* the lowest point of the sweep at least half a degree away from the golden angle */
  function secondBest() {
    let v = Infinity, a = 0;
    curve.forEach(([x, y]) => { if (Math.abs(x - GOLDEN) > 0.5 && y < v) { v = y; a = x; } });
    return `${num(v, 4)} at ${num(a, 2)}°`;
  }

  let paintQueued = false;
  function set(v, fromSlider) {
    angle = Math.max(LO, Math.min(HI, v));
    if (!fromSlider) s.set(angle);
    if (!paintQueued) { paintQueued = true; requestAnimationFrame(() => { paintQueued = false; paintSeeds(); plot(); report(); }); }
  }

  /* the sweep draws the curve as it measures it, then refines the minimum */
  function sweep() {
    if (clock) clock.stop();
    curve.length = 0; i = 0; minAt = minV = null;
    const steps = Math.round((HI - LO) / STEP);
    clock = ticker(() => {
      for (let n = 0; n < PER_FRAME && i <= steps; n++, i++) { const a = LO + i * STEP; curve.push([a, spread(a)]); }
      if (i > steps) {
        let k = 0; curve.forEach((p, j) => { if (p[1] < curve[k][1]) k = j; });
        let best = curve[k];
        for (let a = curve[k][0] - STEP; a <= curve[k][0] + STEP; a += FINE) { const v = spread(a); if (v < best[1]) best = [a, v]; }
        [minAt, minV] = best;
        const top = Math.max(...curve.map((p) => p[1]));
        const yTop = Math.ceil(top * 5) / 5;
        if (yTop !== ymax) { ymax = yTop; const t = []; for (let v = 0; v <= ymax + 1e-9; v += ymax > 0.8 ? 0.4 : 0.2) t.push(+v.toFixed(1)); ch.axis('y', { max: ymax, ticks: t }); }
        plot(); report();
        ctx.announce(`the sweep found its most even spacing at ${num(minAt, 3)} degrees`);
        return false;
      }
      plot(); report();
    });
  }

  paintSeeds(); plot(); report();
  sweep();
  return { stop() { if (clock) clock.stop(); sow.destroy(); ch.destroy(); s.destroy(); } };
}
