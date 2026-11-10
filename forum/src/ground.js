/* ground: the section's fog (density .62, light .4) and its calm zones. The column is long and scrolls, and the fog
   takes at most 12 zones, so the zones follow the reading: on every scroll, the text blocks in view (headings, lines
   of meta, bodies, pictures, the form) nearest the middle of the screen become the zones, ten at most, with the two
   corners (seal, eye) as the last two. While a picture is open, only its caption and the corners are zones. */

const A = window.Aphesis;
const BLOCKS = 'h1 .gloss, h1 .w, .lede, .tools, .crumbs, .start, .row, .pm, .body, .pic, .textpic, .composer:not([hidden]), .empty';
const MAX = 10;

export function createGround(canvas, column, scroller, corners) {
  const fog = A.Fog(canvas, { density: 0.62, light: 0.4 });
  /* the fog canvas stays invisible until it has drawn */
  requestAnimationFrame(() => requestAnimationFrame(() => canvas.classList.add('on')));
  let mode = 'column', extra = [], queued = false;
  function pick() {
    queued = false;
    if (mode !== 'column') { fog.zones(extra.concat(corners)); return; }
    const s = scroller.getBoundingClientRect(), mid = (s.top + s.bottom) / 2;
    const seen = [];
    column.querySelectorAll(BLOCKS).forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.height && r.bottom > s.top - 20 && r.top < s.bottom + 20) seen.push([Math.abs((r.top + r.bottom) / 2 - mid), el, r.height]);
    });
    seen.sort((a, b) => a[0] - b[0]);
    fog.zones(seen.slice(0, MAX).map(([, el, h]) => ({ el, pad: h > 120 ? 26 : 16 })).concat(corners));
  }
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(pick); } };
  scroller.addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  new ResizeObserver(queue).observe(column);
  new MutationObserver(queue).observe(column, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  pick();
  return {
    column() { mode = 'column'; queue(); },
    only(list) { mode = 'only'; extra = list; queue(); },
    refresh: queue,
  };
}
