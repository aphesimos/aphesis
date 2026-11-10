/* marks: what this section draws with the brush and the stipple. The inscription line, the grain that stands for
   each work on it, and the brushed underline under links. Seeds are fixed, so a mark is the same on every visit. */

const A = window.Aphesis;
const NS = 'http://www.w3.org/2000/svg';

/* a seed from a word, so each work keeps its own unsure edges */
export function seedOf(word) { let h = 2166136261; for (const c of word) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) || 1; }

/* the grain: a small disc of stipple on the 24-unit grid, with a ring of brush around it */
export function grain(seed) {
  const fill = A.stipple(A.inC(12, 12, 5.2), seed, 520, 0.9);
  const ring = A.brush(A.arc(12, 12, 8.6, -80, 250, 72), 1.1, seed + 7, 0.4);
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" shape-rendering="crispEdges"><path d="${fill}"/><path d="${ring}" shape-rendering="geometricPrecision"/></svg>`;
}

/* the line through the grains: one long stroke from (x0, y0) to (x1, y1), in the svg's own pixels */
export function stroke(svg, x0, y0, x1, y1, seed) {
  const r = svg.getBoundingClientRect();
  svg.setAttribute('viewBox', `0 0 ${Math.max(1, r.width).toFixed(1)} ${Math.max(1, r.height).toFixed(1)}`);
  const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(24, Math.round(len / 6));
  svg.querySelector('path').setAttribute('d', A.brush(A.line(x0, y0, x1, y1, n), 1.6, seed, 0.42, 0.1));
}

/* a brushed underline under a link: drawn to the link's width, a little loose at both ends */
export function underline(el, seed) {
  let svg = el.querySelector(':scope > svg');
  if (!svg) { svg = document.createElementNS(NS, 'svg'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false'); svg.appendChild(document.createElementNS(NS, 'path')); el.appendChild(svg); }
  const txt = el.querySelector('.txt') || el, w = Math.max(12, txt.getBoundingClientRect().width);
  svg.setAttribute('width', w.toFixed(1)); svg.setAttribute('height', '8'); svg.setAttribute('viewBox', `0 0 ${w.toFixed(1)} 8`);
  const r = A.rng(seed), sag = 0.6 + r() * 0.8;
  const pts = A.line(-2, 4.4, w + 3, 3.6, Math.max(16, Math.round(w / 5))).map(([x, y]) => [x, y + Math.sin(Math.PI * (x / w)) * sag]);
  svg.querySelector('path').setAttribute('d', A.brush(pts, 1.3, seed, 0.38, 0.12));
}
