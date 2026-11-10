/* marks: the section's own small drawings, all made with the brush and the stipple.
   the back mark (a brushed arrow), the underline that draws under a title, the rule beside a quote,
   the stippled rules above and below code, and the brushed rule at the foot of the list. */

const A = window.Aphesis;
const svg = (vb, d, extra = '') =>
  '<svg viewBox="' + vb + '" aria-hidden="true" focusable="false" preserveAspectRatio="none" ' + extra + '><path d="' + d + '" fill="currentColor"/></svg>';

/* back: a stroke drawn right to left that lifts at its end, and the two flicks of its head (24-unit grid) */
export const BACK = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" style="overflow:visible"><path fill="currentColor" d="' +
  A.brush(A.line(20, 12.6, 5.2, 12, 32), 1.7, 91, 0.3) +
  A.brush(A.line(5, 12, 10.4, 7.2, 14), 1.5, 93, 0.38, 0.05) +
  A.brush(A.line(5, 12, 10.6, 16.6, 14), 1.5, 95, 0.38, 0.05) + '"/></svg>';

/* a horizontal stroke, stretched to its box (it only lengthens: the height stays the stroke's own) */
export function hRule(seed, width = 1.5) {
  return svg('0 0 240 6', A.brush(A.line(2, 3.2, 238, 2.8, 80), width, seed, 0.14, 0.1));
}
/* a vertical stroke for the side of a quote */
export function vRule(seed) {
  return svg('0 0 6 240', A.brush(A.line(3.2, 2, 2.8, 238, 80), 1.6, seed, 0.12, 0.1));
}
/* a row of stipple cells: the stippled edge of a code block */
export function stippleRule(seed) {
  /* cells scattered over a 240-unit square, kept in a band 3 units high; the box shows only the band */
  const d = A.stipple((x, y) => y < 3.2 && y > 0.4, seed, 5200, 0.8, 240);
  /* kept at its own ratio, so the cells stay square */
  return '<svg viewBox="0 0 240 3.6" aria-hidden="true" focusable="false" shape-rendering="crispEdges"><path d="' + d + '" fill="currentColor"/></svg>';
}

/* draw every mark a view needs, once */
export function drawMarks(root) {
  root.querySelectorAll('.back-mark').forEach((el) => { if (!el.firstChild) el.innerHTML = BACK; });
  root.querySelectorAll('.uline').forEach((el, i) => { if (!el.firstChild) el.innerHTML = hRule(101 + i, 1.4); });
  root.querySelectorAll('.foot .rule').forEach((el) => { if (!el.firstChild) el.innerHTML = hRule(131, 1.3); });
  root.querySelectorAll('.prose blockquote').forEach((q, i) => {
    if (q.querySelector(':scope > .q-rule')) return;
    const r = document.createElement('span');
    r.className = 'q-rule'; r.setAttribute('aria-hidden', 'true'); r.innerHTML = vRule(141 + i);
    q.prepend(r);
  });
  root.querySelectorAll('.prose pre').forEach((pre, i) => {
    if (pre.parentNode.classList.contains('code')) return;
    const wrap = document.createElement('div');
    wrap.className = 'code';
    pre.replaceWith(wrap);
    const top = document.createElement('span'), bot = document.createElement('span');
    top.className = bot.className = 's-rule'; top.setAttribute('aria-hidden', 'true'); bot.setAttribute('aria-hidden', 'true');
    top.innerHTML = stippleRule(151 + i * 2); bot.innerHTML = stippleRule(152 + i * 2);
    wrap.append(top, pre, bot);
  });
}
