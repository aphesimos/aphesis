/* chart: data drawn with the brush and the stipple, never with a library's defaults.

     const c = chart(host, {
       x: { min, max, ticks: [..], fmt: (v) => '..', label: 'generation' },
       y: { min, max, ticks: [..], fmt, label: 'score' },
       height: 220,                       // CSS px; the width follows the host
       label: 'what the chart shows',     // the figure's accessible name
       step: 1,                           // keyboard step along x (arrow keys; shift = ten steps)
       readout: (x) => ({ x, y, text }),  // what the hairline says at x (snap x to your data); null = nothing
       idle: () => 'text',                // what the readout says when nothing is pointed at
       pick: (x) => {},                   // optional: a click or Enter at x
     });
     c.set([...layers]);                  // draw these layers (replaces the last set)
     c.axis('y', { min, max, ticks });    // change a domain; axes redraw
     c.destroy();

   Layers, drawn in this order whatever order they are given in:
     { type: 'area',   pts, density = .5, seed, tone }   stipple under a series, densest at the line, thinning to the base
     { type: 'dots',   pts, tone, seed }                 one small cluster of cells per point (samples, candidates)
     { type: 'dotted', pts, tone }                       a line of single cells: an expectation, a reference
     { type: 'line',   pts, width = 2, seed, tone, step }  a brush stroke through the points (step: a staircase)
     { type: 'rule',   x | y, tone, label, seed }        a hairline brush stroke across the plot, with a meta label
     { type: 'ring',   at: [x, y], tone, seed }          a small brushed ring: the one point that matters
   pts are [[x, y], ...] in data units. tone is 'ink' | 'soft' | 'accent' | 'line' (the role tokens).

   Anatomy: axes are hairline brush strokes in `line` (decorative: the tick labels carry the values), labels are in
   meta style with tabular figures, nothing is filled, no grid. Every stroke has a fixed seed, so the chart is the
   same drawing on every visit and its edges do not shimmer while the data grows. Red is for one mark at most.

   Reading it: pointing at the plot (or focusing it and using the arrow keys, Home and End) moves a hairline and
   writes the readout under the chart in meta style. The readout is also the live region for keyboard users. */

const A = window.Aphesis;
const NS = 'http://www.w3.org/2000/svg';
const M = { l: 46, r: 14, t: 18, b: 34 };
const ORDER = { area: 0, dots: 1, dotted: 2, line: 3, rule: 4, ring: 5 };

function el(name, attrs, parent) {
  const n = document.createElementNS(NS, name);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}
function rng(seed) { return A.rng((seed >>> 0) || 1); }

/* a polyline resampled so no segment is longer than `gap` px: the brush needs a dense centerline */
export function dense(pts, gap = 3) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    if (i === 0) { out.push(pts[0]); continue; }
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / gap));
    for (let k = 1; k <= n; k++) out.push([x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n]);
  }
  return out;
}
/* a square cell at integer CSS pixels */
const cell = (x, y, s = 2) => 'M' + Math.round(x) + ' ' + Math.round(y) + 'h' + s + 'v' + s + 'h-' + s + 'z';

export function chart(host, o) {
  const fig = document.createElement('figure');
  fig.className = 'chart';
  const svg = el('svg', { role: 'img', 'aria-label': o.label || '', tabindex: '0', 'data-cursor': '.55' });
  const gAxes = el('g', {}, svg), gData = el('g', {}, svg), gCursor = el('g', { class: 'cursor' }, svg);
  const read = document.createElement('p');
  read.className = 'chart-read aph-meta num';
  read.setAttribute('aria-live', 'polite');
  fig.append(svg, read);
  host.appendChild(fig);

  const ax = { x: Object.assign({}, o.x), y: Object.assign({}, o.y) };
  let W = 0, H = o.height || 220, layers = [], at = null, gone = false;
  const sx = (v) => M.l + (v - ax.x.min) / ((ax.x.max - ax.x.min) || 1) * (W - M.l - M.r);
  const sy = (v) => H - M.b - Math.max(0, Math.min(1, (v - ax.y.min) / ((ax.y.max - ax.y.min) || 1))) * (H - M.t - M.b);
  const ix = (px) => ax.x.min + (px - M.l) / Math.max(1, W - M.l - M.r) * (ax.x.max - ax.x.min);
  const fmt = (a, v) => (a.fmt ? a.fmt(v) : String(v));

  function text(parent, x, y, s, anchor, cls) {
    const t = el('text', { x, y, 'text-anchor': anchor || 'middle', class: 'tick ' + (cls || '') }, parent);
    t.textContent = s;
    return t;
  }

  function drawAxes() {
    gAxes.textContent = '';
    const x0 = M.l, x1 = W - M.r, y0 = H - M.b, y1 = M.t;
    const d = A.brush(A.line(x0 - 4, y0, x1, y0, Math.ceil((x1 - x0) / 3)), 1, 11, 0.06, 0.05) +
      A.brush(A.line(x0, y0 + 4, x0, y1, Math.ceil((y0 - y1) / 3)), 1, 12, 0.06, 0.05);
    let ticks = '';
    (ax.x.ticks || []).forEach((v, i) => {
      const x = sx(v); ticks += A.brush(A.line(x, y0, x, y0 + 5, 4), 1, 30 + i, 0, 0.04);
      text(gAxes, x, y0 + 17, fmt(ax.x, v));
    });
    (ax.y.ticks || []).forEach((v, i) => {
      const y = sy(v); ticks += A.brush(A.line(x0 - 5, y, x0, y, 4), 1, 60 + i, 0, 0.04);
      text(gAxes, x0 - 9, y + 3.5, fmt(ax.y, v), 'end');
    });
    el('path', { d: d + ticks, class: 't-line' }, gAxes);
    if (ax.x.label) text(gAxes, x1, y0 + 31, ax.x.label, 'end', 'name');
    if (ax.y.label) text(gAxes, x0 - 9, y1 - 7, ax.y.label, 'start', 'name');
  }

  const toPx = (pts) => pts.filter((p) => isFinite(p[0]) && isFinite(p[1])).map((p) => [sx(p[0]), sy(p[1])]);

  function area(L) {
    const pts = toPx(L.pts); if (pts.length < 2) return '';
    const base = sy(ax.y.min), dens = L.density === undefined ? 0.5 : L.density;
    let d = '', j = 0;
    const xa = Math.ceil(pts[0][0] / 3) * 3, xb = pts[pts.length - 1][0];
    for (let x = xa; x <= xb; x += 3) {
      while (j < pts.length - 2 && pts[j + 1][0] < x) j++;
      const [p0, p1] = [pts[j], pts[j + 1]];
      const top = p0[1] + (p1[1] - p0[1]) * Math.max(0, Math.min(1, (x - p0[0]) / ((p1[0] - p0[0]) || 1)));
      const r = rng((L.seed || 1) * 7919 + x * 131);
      for (let y = Math.ceil(top / 3) * 3; y < base - 1; y += 3) {
        const t = (y - top) / Math.max(1, base - top);
        if (r() < dens * (1 - 0.8 * t)) d += cell(x, y);
      }
    }
    return d;
  }
  function dots(L) {
    let d = '';
    toPx(L.pts).forEach(([x, y], i) => {
      const r = rng((L.seed || 3) * 104729 + i * 31);
      const skip = Math.floor(r() * 4);
      [[0, 0], [2, 0], [0, 2], [2, 2]].forEach(([a, b], k) => { if (k !== skip) d += cell(x - 2 + a, y - 2 + b); });
    });
    return d;
  }
  function dotted(L) {
    const pts = dense(toPx(L.pts), 1); let d = '', acc = 6;
    for (let i = 1; i < pts.length; i++) {
      acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (acc >= 6) { acc = 0; d += cell(pts[i][0] - 1, pts[i][1] - 1); }
    }
    return d;
  }
  function line(L) {
    let pts = L.pts;
    if (L.step) { const s = []; pts.forEach((p, i) => { if (i) s.push([p[0], pts[i - 1][1]]); s.push(p); }); pts = s; }
    const px = dense(toPx(pts), 3);
    return px.length > 1 ? A.brush(px, L.width || 2, L.seed || 5, L.taper === undefined ? 0.05 : L.taper, 0.06) : '';
  }
  function rule(L) {
    if (L.x !== undefined) {
      const x = sx(L.x);
      if (L.label) { const right = x < W - M.r - 80; text(gData, right ? x + 6 : x - 6, M.t + 10, L.label, right ? 'start' : 'end', 'rule-label'); }
      return A.brush(A.line(x, H - M.b, x, M.t, 40), 1, L.seed || 7, 0.12, 0.05);
    }
    const y = sy(L.y);
    if (L.label) text(gData, W - M.r, y < M.t + 30 ? y + 15 : y - 7, L.label, 'end', 'rule-label');
    return A.brush(A.line(M.l, y, W - M.r, y, 60), 1, L.seed || 8, 0.12, 0.05);
  }
  function ring(L) {
    const [x, y] = [sx(L.at[0]), sy(L.at[1])];
    return A.brush(A.arc(x, y, 6, -70, 275, 40), 1.4, L.seed || 9, 0.3, 0.06);
  }
  const DRAW = { area, dots, dotted, line, rule, ring };
  const CRISP = { area: 1, dots: 1, dotted: 1 };

  function drawData() {
    gData.textContent = '';
    layers.slice().sort((a, b) => ORDER[a.type] - ORDER[b.type]).forEach((L) => {
      const d = DRAW[L.type](L);
      if (d) el('path', Object.assign({ d, class: 't-' + (L.tone || 'ink') }, CRISP[L.type] ? { 'shape-rendering': 'crispEdges' } : {}), gData);
    });
  }

  function drawCursor() {
    gCursor.textContent = '';
    if (at === null || !o.readout) { read.textContent = o.idle ? o.idle() : ''; return; }
    const r = o.readout(at);
    if (!r) { read.textContent = o.idle ? o.idle() : ''; return; }
    const x = sx(r.x);
    let d = A.brush(A.line(x, H - M.b, x, M.t, 40), 1, 99, 0.12, 0.04);
    el('path', { d, class: 't-soft' }, gCursor);
    if (r.y !== undefined && isFinite(r.y)) {
      const y = sy(r.y);
      el('path', { d: cell(x - 2, y - 2) + cell(x, y - 2) + cell(x - 2, y) + cell(x, y), class: 't-accent', 'shape-rendering': 'crispEdges' }, gCursor);
    }
    read.textContent = r.text;
  }

  function size() {
    const w = Math.round(host.clientWidth);
    if (!w || gone) return;
    W = w;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', W); svg.setAttribute('height', H);
    drawAxes(); drawData(); drawCursor();
  }
  const ro = new ResizeObserver(size);
  ro.observe(host);

  /* reading: pointer, keys, a pick */
  const fromEvent = (e) => { const r = svg.getBoundingClientRect(); return ix(e.clientX - r.left); };
  const clampX = (v) => Math.max(ax.x.min, Math.min(ax.x.max, v));
  svg.addEventListener('pointermove', (e) => { at = clampX(fromEvent(e)); drawCursor(); });
  svg.addEventListener('pointerleave', () => { if (document.activeElement !== svg) { at = null; drawCursor(); } });
  svg.addEventListener('click', (e) => { if (o.pick) o.pick(clampX(fromEvent(e))); });
  svg.addEventListener('blur', () => { at = null; drawCursor(); });
  svg.addEventListener('keydown', (e) => {
    const step = (o.step || (ax.x.max - ax.x.min) / 50) * (e.shiftKey ? 10 : 1);
    const cur = at === null ? (o.readout && o.readout(ax.x.max) ? o.readout(ax.x.max).x : ax.x.min) : at;
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = cur + step;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = cur - step;
    else if (e.key === 'Home') next = ax.x.min;
    else if (e.key === 'End') next = ax.x.max;
    else if ((e.key === 'Enter' || e.key === ' ') && o.pick) { e.preventDefault(); o.pick(cur); return; }
    if (next === null) return;
    e.preventDefault();
    at = clampX(next); drawCursor();
  });

  size();
  return {
    node: fig,
    set(list) { layers = list || []; if (W) { drawData(); drawCursor(); } },
    axis(name, a) { Object.assign(ax[name], a); if (W) { drawAxes(); drawData(); drawCursor(); } },
    /* the readout again (after the data under the hairline changed) */
    refresh() { if (W) drawCursor(); },
    destroy() { gone = true; ro.disconnect(); },
  };
}
