/* the fog itself: does the fog light as many cells as its density says?

   The fog (Aphesis.Fog) decides each 2px cell with step(h(cel), dens): the cell lights when a hash of its grid
   position falls below the density there. If h is uniform on [0, 1), the share of lit cells equals the density.
   This bench runs that exact test on the GPU: a WebGL canvas compiles the fog's own hash (cut from bundle.js at build
   time, HASH_GLSL), lays a density ramp from 0 at the left edge to 1 at the right, and reads every cell back.
   Each patch sits at a random offset in the grid, as the fog's cells sit at different places on different screens.
   The ramp is split into 20 bins; for each, the lit share is compared with the bin's mean density.

   The canvas shows the measured patch itself, drawn the way the fog draws it. Dragging it moves the patch through
   the grid; letting go measures where it rests. Twenty-four patches are measured on their own, then it stops. */

import { HASH_GLSL } from '../assets.js';
import { bench } from '../bench.js';
import { chart } from '../chart.js';
import { ticker, num, pct, onTheme } from '../motion.js';

const A = window.Aphesis;
const BINS = 20, PATCHES = 24, EVERY = 0.45, SPAN = [1400, 800];

const FS = 'precision highp float;uniform vec2 O;uniform vec2 R;uniform float M;uniform vec3 N;' + HASH_GLSL +
  'void main(){vec2 cel=floor(gl_FragCoord.xy);float dens=(cel.x+.5)/R.x;float lit=step(h(cel+O),dens);' +
  'if(M>.5){gl_FragColor=vec4(vec3(lit),1.);return;}' +
  /* shown, not measured: the same cells under a soft envelope, so the dense end gathers like fog instead of a block */
  'vec2 u=(cel+.5)/R;float env=smoothstep(0.,.3,u.y)*smoothstep(1.,.7,u.y)*smoothstep(1.,.86,u.x);' +
  'gl_FragColor=vec4(N,step(h(cel+O),dens*env)*.62);}';

function program(gl) {
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(p); gl.useProgram(p);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const lp = gl.getAttribLocation(p, 'p'); gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 2, gl.FLOAT, false, 0, 0);
  const U = {}; ['O', 'R', 'M', 'N'].forEach((k) => { U[k] = gl.getUniformLocation(p, k); });
  return U;
}

export function mount(host, ctx) {
  const b = bench(host);
  b.specimen.classList.add('wide');
  const cv = b.canvas('patch', 'the measured patch: density rises from 0 at the left to 1 at the right, each cell lit by the fog’s own hash');
  const gl = cv.getContext('webgl', { premultipliedAlpha: false, antialias: false, preserveDrawingBuffer: true });
  let U = gl ? program(gl) : null, color = A.cssColor('--fog');
  cv.style.imageRendering = 'pixelated';

  const sumD = new Float64Array(BINS), sumV = new Float64Array(BINS), samples = [];
  let patches = 0, cellsSeen = 0, offset = [0, 0], clock = null, gone = false;

  const ch = chart(b.plot, {
    x: { min: 0, max: 1, ticks: [0, 0.5, 1], fmt: (v) => v.toFixed(1), label: 'density' },
    y: { min: 0, max: 1, ticks: [0, 0.5, 1], fmt: (v) => v.toFixed(1), label: 'share of cells lit' },
    height: 240,
    label: 'share of lit cells against density: the expectation, each patch, and the mean of all patches',
    step: 1 / BINS,
    readout: (x) => {
      if (!patches) return null;
      const i = Math.max(0, Math.min(BINS - 1, Math.floor(x * BINS))), [d, m] = mean(i);
      return { x: d, y: m, text: `density ${num(d, 3)} · lit ${num(m, 3)} · error ${num(m - d, 3)}` };
    },
    idle: () => 'expected: the line of single cells · each patch: the grains · their mean: the brush line',
  });

  function size() {
    const r = cv.getBoundingClientRect(), c = A.cellPx(2);
    const w = Math.max(1, Math.round(r.width / c)), h = Math.max(1, Math.round(r.height / c));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    gl.viewport(0, 0, w, h);
    return [w, h];
  }

  /* draw the patch at the offset; with measure, read it back and return the lit share per bin */
  function render(measure) {
    if (!gl || gl.isContextLost() || gone) return null;
    const [w, h] = size();
    gl.uniform2f(U.O, offset[0], offset[1]); gl.uniform2f(U.R, w, h); gl.uniform3fv(U.N, color);
    let bins = null;
    if (measure) {
      gl.uniform1f(U.M, 1); gl.drawArrays(gl.TRIANGLES, 0, 3);
      const px = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const lit = new Float64Array(BINS), n = new Float64Array(BINS);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = Math.min(BINS - 1, Math.floor(x / w * BINS));
        n[i]++; if (px[(y * w + x) * 4] > 127) lit[i]++;
      }
      bins = Array.from(lit, (v, i) => v / n[i]);
      cellsSeen += w * h;
    }
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(U.M, 0); gl.drawArrays(gl.TRIANGLES, 0, 3);
    cv.classList.add('on');
    return bins;
  }

  /* the mean density of each bin on a canvas w cells wide (the bins do not split cells evenly) */
  function binDensities(w) {
    const s = new Float64Array(BINS), n = new Float64Array(BINS);
    for (let x = 0; x < w; x++) { const i = Math.min(BINS - 1, Math.floor(x / w * BINS)); s[i] += (x + 0.5) / w; n[i]++; }
    return Array.from(s, (v, i) => v / n[i]);
  }

  /* one patch: per bin, its mean density and its lit share, both measured on the canvas */
  function measure() {
    const bins = render(true); if (!bins) return;
    const dens = binDensities(cv.width);
    patches++;
    bins.forEach((v, i) => { sumD[i] += dens[i]; sumV[i] += v; samples.push([dens[i], v]); });
    plot(); report();
  }

  const mean = (i) => [sumD[i] / patches, sumV[i] / patches];

  function plot() {
    const layers = [{ type: 'dotted', pts: [[0, 0], [1, 1]], tone: 'soft' }, { type: 'dots', pts: samples, tone: 'soft', seed: 21 }];
    if (patches) {
      layers.push({ type: 'line', pts: Array.from({ length: BINS }, (_, i) => mean(i)), width: 2, seed: 22, tone: 'ink' });
      layers.push({ type: 'ring', at: mean(worst().i), tone: 'accent', seed: 23 });
    }
    ch.set(layers);
    ch.refresh();
  }

  function worst() {
    let wi = 0, we = -1;
    for (let i = 0; i < BINS; i++) { const [d, m] = mean(i), e = Math.abs(m - d); if (e > we) { we = e; wi = i; } }
    return { i: wi, e: we };
  }

  function report() {
    if (!patches) return;
    let mae = 0, sxy = 0, sxx = 0;
    for (let i = 0; i < BINS; i++) { const [d, m] = mean(i); mae += Math.abs(m - d); sxy += d * m; sxx += d * d; }
    mae /= BINS;
    const wv = worst();
    ctx.values({
      patches: String(patches), cells: cellsSeen.toLocaleString('en-US'), slope: num(sxy / sxx, 3), mae: num(mae, 4),
      worst: num(wv.e, 4), at: num(mean(wv.i)[0], 3), verdict: mae < 0.01 ? 'holds' : 'does not hold',
      state: patches >= PATCHES ? 'the run has ended' : 'the run is still going',
    });
  }

  const jump = () => { offset = [Math.floor(Math.random() * SPAN[0]), Math.floor(Math.random() * SPAN[1])]; };

  /* drag: the patch slides through the grid; on release, it is measured */
  let drag = null;
  cv.tabIndex = 0; cv.dataset.cursor = '1'; cv.dataset.tip = 'drag · move the patch through the grid';
  cv.addEventListener('pointerdown', (e) => { drag = [e.clientX, e.clientY, offset[0], offset[1]]; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const c = A.cellPx(2);
    offset = [Math.max(0, Math.round(drag[2] - (e.clientX - drag[0]) / c)), Math.max(0, Math.round(drag[3] + (e.clientY - drag[1]) / c))];
    render(false);
  });
  const release = () => { if (drag) { drag = null; measure(); } };
  cv.addEventListener('pointerup', release); cv.addEventListener('pointercancel', release);
  cv.addEventListener('keydown', (e) => {
    const k = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, 8], ArrowDown: [0, -8] }[e.key];
    if (k) { e.preventDefault(); offset = [Math.max(0, offset[0] + k[0]), Math.max(0, offset[1] + k[1])]; render(false); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); measure(); }
  });
  b.button('measure another patch', () => { jump(); measure(); }, 'a new place in the grid');
  b.button('begin again', () => run(), 'forget every patch and measure afresh');

  const ro = new ResizeObserver(() => render(false)); ro.observe(cv);
  onTheme(() => { const f = () => { color = A.cssColor('--fog'); render(false); }; f(); setTimeout(f, 120); });

  function run() {
    if (clock) clock.stop();
    sumD.fill(0); sumV.fill(0); samples.length = 0; patches = 0; cellsSeen = 0;
    plot();
    let acc = EVERY;
    clock = ticker((dt) => {
      acc += dt;
      if (acc >= EVERY) { acc = 0; jump(); measure(); }
      if (patches >= PATCHES) { ctx.announce(`measured ${patches} patches`); return false; }
    });
  }

  if (!gl) { b.caption('this browser gives no WebGL, so the fog cannot be measured here'); return { stop() { ch.destroy(); } }; }
  b.caption('the measured patch, drawn as the fog draws it, its edges softened for the eye only · drag it, or use the arrow keys and enter');
  run();
  return {
    stop() {
      gone = true; if (clock) clock.stop(); ro.disconnect(); ch.destroy();
      const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
    },
  };
}
