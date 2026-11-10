/* circling: how many turns the hand has made, in either direction.
   Each pointer position is measured as an angle around the centre of the recent movement (the mean of the last
   points, up to 6 s old). The change of that angle from one position to the next is added as an absolute value,
   so clockwise and counter-clockwise both count and a change of direction loses nothing. Steps that pass close to
   the centre or swing more than 170° at once (a line crossing the centre, a jump) are ignored, so wandering across
   the page adds little, and eight points a circle are already enough. Coalesced events are read where the browser
   offers them. Nothing is ever taken away: a pause keeps what was turned. */

const TAU = Math.PI * 2;

export function circling(onTurn) {
  const pts = [];
  let last = null;
  function add(x, y, t) {
    if (last && Math.hypot(x - last[0], y - last[1]) < 3) return;   /* a tremor is not a turn */
    pts.push([x, y, t]);
    while (pts.length > 256 || (pts.length > 4 && t - pts[0][2] > 6000)) pts.shift();
    if (pts.length < 4) { last = [x, y]; return; }
    let cx = 0, cy = 0;
    pts.forEach((p) => { cx += p[0]; cy += p[1]; });
    cx /= pts.length; cy /= pts.length;
    /* how far the recent points spread: a step must stand clear of the centre by a share of it */
    let spread = 0;
    pts.forEach((p) => { spread += Math.hypot(p[0] - cx, p[1] - cy); });
    spread /= pts.length;
    const [lx, ly] = last; last = [x, y];
    const r0 = Math.hypot(lx - cx, ly - cy), r1 = Math.hypot(x - cx, y - cy);
    if (spread < 12 || r0 < spread * 0.35 || r1 < spread * 0.35) return;
    let d = Math.atan2(y - cy, x - cx) - Math.atan2(ly - cy, lx - cx);
    d = ((d + Math.PI) % TAU + TAU) % TAU - Math.PI;
    if (Math.abs(d) > Math.PI * 170 / 180) return;
    onTurn(Math.abs(d) / TAU);
  }
  const move = (e) => {
    if (e.pointerType !== 'mouse' && e.buttons === 0 && e.pressure === 0) return;   /* a pen or finger hovering */
    const list = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    (list.length ? list : [e]).forEach((c) => add(c.clientX, c.clientY, c.timeStamp || performance.now()));
  };
  const reset = () => { pts.length = 0; last = null; };
  addEventListener('pointermove', move, { passive: true });
  addEventListener('pointerup', reset);
  return { off() { removeEventListener('pointermove', move); removeEventListener('pointerup', reset); } };
}
