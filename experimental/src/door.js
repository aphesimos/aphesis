/* the door: the design system's threshold (limen), drawn large in rubedo. It is the icon itself: the brush strokes
   of Aphesis.ICONS.threshold and the stipple of its night state, the squares of Aphesis.stipple, at their own
   places on the 24-unit grid. It stands open (the empty doorway) between chambers.
     rest: the open doorway, still.
     hover or focus: fog gathers in the doorway. Squares of its night appear and fade in a slow wave that breathes
       and drifts upward; leave it and they settle away. Nothing changes colour.
     enter (click, tap, Enter or Space): the night fills the doorway square by square, the doorway grows toward the
       viewer, and its stipple dissolves into the fog while the chamber's picture coalesces behind it (about 2 s).
     return: the doorway comes back from close by, full of night, and its night thins away square by square.
     sealed (after the ending): it returns filled with night and stays so.
   It is painted on one 2D canvas over the whole screen, so it can grow past its own box. Every square is drawn at
   whole device pixels with no smoothing, so the stipple stays crisp and square at any size. Everything that travels
   is eased with minimum jerk; the canvas is only redrawn while something moves. */

import { travel, STEP } from './motion.js';

const A = window.Aphesis;
const OPEN = A.ICONS.threshold(0), NIGHT = A.ICONS.threshold(1);
const STROKES = new Path2D(OPEN.strokes);

/* the night's squares, read from the icon's own stipple path: M x y h s v s h -s z */
const rand = A.rng(4021);
const SQUARES = [];
NIGHT.dots.replace(/M(-?[\d.]+) (-?[\d.]+)h([\d.]+)/g, (_, x, y, s) => {
  x = +x; y = +y; s = +s;
  SQUARES.push({
    x, y, s,
    h: 0.12 + rand() * 0.8,                                    /* where the hover fog lights it */
    rank: Math.min(1, Math.max(0, (20.4 - (y + s / 2)) / 14.4 * 0.75 + rand() * 0.25)),   /* night rises from the sill */
    gone: rand(),                                              /* when it dissolves into the fog */
  });
  return '';
});
/* the doorway grows about the middle of its opening */
const AX = 12, AY = 15;

/* a small value noise for the hover fog, 0..1 */
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function noise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp = (x) => Math.max(0, Math.min(1, x));

export function createDoor(el, canvas) {
  const ctx = canvas.getContext('2d');
  const root = document.documentElement;
  let accent = '#ab0d19', dpr = 1;
  /* shown: the whole door; scale: toward the viewer; strokes: the doorway's lines; fill: the night rising square by
     square; dis: the night dissolving into the fog; hov: the hover fog */
  const st = { shown: 0, scale: 1, strokes: 1, fill: 0, dis: 0, hov: 0 };
  let mode = 'rest', hovered = false, focused = false, stopHover = null, stopMain = null, raf = 0, t0 = performance.now();

  function colors() { accent = getComputedStyle(root).getPropertyValue('--accent').trim() || accent; kick(); }
  new MutationObserver(colors).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', colors);

  function size() {
    dpr = window.devicePixelRatio || 1;
    const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    canvas.style.width = w / dpr + 'px'; canvas.style.height = h / dpr + 'px';
    kick();
  }
  addEventListener('resize', size);

  function draw(now) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (st.shown < 0.002) return;
    const r = el.getBoundingClientRect();
    const u = (r.width / 24) * st.scale;                       /* CSS pixels per grid unit */
    const ax = r.left + r.width * AX / 24, ay = r.top + r.height * AY / 24;   /* the anchor stays put on screen */
    const X = (x) => ax + (x - AX) * u, Y = (y) => ay + (y - AY) * u;
    ctx.fillStyle = accent;
    /* the strokes: the brush paths, as drawn by the icon */
    if (st.strokes > 0.002) {
      ctx.globalAlpha = st.shown * st.strokes;
      ctx.setTransform(dpr * u, 0, 0, dpr * u, dpr * X(0), dpr * Y(0));
      ctx.fill(STROKES);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    /* the night: whole device pixels, never smoothed */
    const t = (now - t0) / 1000;
    const breath = 0.62 + 0.38 * (0.5 - 0.5 * Math.cos(t * Math.PI * 2 / 5.2));
    for (const q of SQUARES) {
      let a = 0;
      if (st.hov > 0.002) {
        const f = noise(q.x * 0.34 + 3.1, q.y * 0.34 + t * 0.32) * 0.75 + noise(q.x * 0.9 - t * 0.11, q.y * 0.9 + t * 0.21) * 0.25;
        a = st.hov * smooth(q.h - 0.09, q.h + 0.09, f * breath * 1.05);
      }
      if (st.fill > 0) a = Math.max(a, smooth(q.rank * 0.82, q.rank * 0.82 + 0.18, st.fill));
      if (st.dis > 0) a *= 1 - A.MJ(clamp((st.dis - q.gone * 0.7) / 0.3));
      a *= st.shown;
      if (a < 0.01) continue;
      const s = Math.max(1, Math.round(q.s * u * dpr));
      ctx.globalAlpha = a * 0.85;
      ctx.fillRect(Math.round(X(q.x + q.s / 2) * dpr - s / 2), Math.round(Y(q.y + q.s / 2) * dpr - s / 2), s, s);
    }
    ctx.globalAlpha = 1;
  }

  /* redraw while anything moves: a transition, the hover fog, or its settling */
  function busy() { return stopMain !== null || st.hov > 0.002 || hovered || focused; }
  function tick(now) {
    raf = 0;
    draw(now);
    if (busy()) raf = requestAnimationFrame(tick);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(tick); }

  /* hover and focus: the fog gathers over 1.1 s and settles away over 1.4 s */
  function hover() {
    const want = (hovered || focused) && mode === 'rest' ? 1 : 0;
    if (stopHover) stopHover();
    const h0 = st.hov;
    stopHover = travel(want ? 1100 : 1400, (e) => { st.hov = h0 + (want - h0) * e; }, () => { stopHover = null; kick(); });
    kick();
  }
  el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' || e.pointerType === 'pen') { hovered = true; hover(); } });
  el.addEventListener('pointerleave', () => { hovered = false; hover(); });
  el.addEventListener('focus', () => { focused = el.matches(':focus-visible'); hover(); });
  el.addEventListener('blur', () => { focused = false; hover(); });

  /* one transition at a time: fn(ms since start) sets the state; it ends after dur */
  function run(dur, fn, done) {
    if (stopMain) stopMain();
    if (dur <= 0) { fn(dur); stopMain = null; kick(); if (done) done(); return; }
    let live = true, ms = 0, last = performance.now();
    stopMain = () => { live = false; };
    (function step(now) {
      if (!live) return;
      ms = Math.min(dur, ms + Math.min(STEP, Math.max(0, now - last)));   /* a stalled frame pauses, never skips */
      last = now;
      fn(ms);
      if (ms < dur) requestAnimationFrame(step);
      else { stopMain = null; kick(); if (done) done(); }
    })(last);
    kick();
  }
  const seg = (ms, a, b) => A.MJ(clamp((ms - a) / (b - a)));

  colors(); size();

  return {
    el,
    /* return: from close by, full of night, which then thins away square by square (1.8 s) */
    show(done) {
      mode = 'returning';
      el.classList.remove('sealed');
      el.inert = false; el.removeAttribute('aria-hidden'); el.removeAttribute('aria-disabled');
      el.setAttribute('aria-label', 'a door'); el.dataset.tip = 'limen · the threshold';
      st.dis = 0; st.hov = 0;
      run(1800, (ms) => {
        st.shown = seg(ms, 0, 900);
        st.scale = 1 + 0.22 * (1 - seg(ms, 0, 1800));
        st.strokes = 1;
        st.fill = 1 - seg(ms, 650, 1800);
      }, () => { mode = 'rest'; hover(); if (done) done(); });
    },
    /* enter: the night fills the doorway, the doorway grows toward the viewer and its stipple dissolves into the fog.
       mid() is called when the picture behind it should begin to coalesce. */
    open(done, mid) {
      mode = 'entering';
      el.inert = true; el.setAttribute('aria-hidden', 'true');
      if (stopHover) { stopHover(); stopHover = null; }
      const h0 = st.hov, s0 = st.shown;
      let midSent = false;
      run(2100, (ms) => {
        st.hov = h0 * (1 - seg(ms, 0, 700));
        st.shown = s0 + (1 - s0) * seg(ms, 0, 300);
        st.fill = seg(ms, 0, 850);
        st.scale = 1 + 1.7 * seg(ms, 450, 2100);
        st.strokes = 1 - seg(ms, 700, 1900);
        st.dis = seg(ms, 950, 2100);
        if (!midSent && ms >= 850) { midSent = true; if (mid) mid(); }
      }, () => {
        st.shown = 0; st.hov = 0; st.fill = 0; st.dis = 0; st.scale = 1;
        if (!midSent && mid) mid();
        if (done) done();
      });
    },
    /* closed for good: it returns filled with night, square by square, and stays so (3.2 s) */
    seal(done) {
      mode = 'sealed';
      el.classList.add('sealed');
      el.inert = false; el.removeAttribute('aria-hidden'); el.setAttribute('aria-disabled', 'true');
      el.setAttribute('aria-label', 'the door, closed. the seal leads back.'); el.dataset.tip = 'clausum · closed';
      st.dis = 0; st.hov = 0; st.fill = 0;
      run(3200, (ms) => {
        st.shown = seg(ms, 0, 1200);
        st.scale = 1 + 0.22 * (1 - seg(ms, 0, 1800));
        st.strokes = 1;
        st.fill = seg(ms, 700, 3200);
      }, done);
    },
    get state() { return Object.assign({ mode }, st); },
  };
}
