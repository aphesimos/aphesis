/* turning the leaf: a click on the page's edge, the arrow keys (or Page Up / Page Down), or a swipe.
   The swipe is the plainest gesture there is: a touch that ends well to the side of where it began, more sideways
   than up or down, within two seconds. Vertical moves are left to the text page, which scrolls. */

const A = window.Aphesis;

function edgeMark(flip) {
  const f = (p) => p.map(([x, y]) => [flip ? 24 - x : x, y]);
  const edge = A.brush(f(A.arc(3, 12, 11, -48, 48, 40)), 1.5, flip ? 71 : 73, 0.42, 0.06);
  const chev = A.brush(f([].concat(A.line(8.6, 8.4, 11.4, 12, 10), A.line(11.4, 12, 8.6, 15.6, 10).slice(1))), 2.1, flip ? 75 : 77, 0.3);
  return '<path d="' + edge + '" fill="currentColor" opacity=".75"/><path d="' + chev + '" fill="currentColor"/>';
}

export function createTurning({ prev, next, onTurn }) {
  next.querySelector('svg').innerHTML = edgeMark(false);
  prev.querySelector('svg').innerHTML = edgeMark(true);
  prev.addEventListener('click', () => onTurn(-1));
  next.addEventListener('click', () => onTurn(1));

  addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); onTurn(1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); onTurn(-1); }
  });

  let start = null;
  addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || !e.isPrimary) { start = null; return; }
    start = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
  });
  addEventListener('pointerup', (e) => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y, dt = performance.now() - start.t;
    start = null;
    if (Math.abs(dx) >= 48 && Math.abs(dx) > 1.4 * Math.abs(dy) && dt < 2000) onTurn(dx < 0 ? 1 : -1);
  });
  addEventListener('pointercancel', () => { start = null; });
}
