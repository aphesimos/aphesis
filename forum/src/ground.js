/* ground: the section's fog (density .62, light .4) and its calm zones. The column is long and scrolls, and the fog
   takes at most 12 zones, so the zones follow the reading: on every scroll, the text blocks in view (headings, lines
   of meta, bodies, pictures, the form) nearest the middle of the screen become the zones, ten at most, with the two
   corners (seal, eye) as the last two. While a picture is open, only its caption and the corners are zones.
   The board can hold thousands of rows, so only blocks near the screen are measured: an IntersectionObserver keeps
   that set, and a scroll measures it alone. */

const A = window.Aphesis;
const BLOCKS = 'h1 .gloss, h1 .w, .lede, .tools, .crumbs, .start, .row, .pm, .body, .pic, .textpic, .composer:not([hidden]), .empty, .board-end';
const MAX = 10;

export function createGround(canvas, column, scroller, corners) {
  const fog = A.Fog(canvas, { density: 0.62, light: 0.4 });
  /* the fog canvas stays invisible until it has drawn */
  requestAnimationFrame(() => requestAnimationFrame(() => canvas.classList.add('on')));
  let mode = 'column', extra = [], queued = false, dirty = true, near = null;
  function pick() {
    queued = false;
    if (near && dirty) { dirty = false; near.watch(); }
    if (mode !== 'column') { fog.zones(extra.concat(corners)); return; }
    const s = scroller.getBoundingClientRect(), mid = (s.top + s.bottom) / 2;
    const seen = [];
    (near ? near.inView : column.querySelectorAll(BLOCKS)).forEach((el) => {
      if (!el.isConnected) return;
      const r = el.getBoundingClientRect();
      if (r.height && r.bottom > s.top - 20 && r.top < s.bottom + 20) seen.push([Math.abs((r.top + r.bottom) / 2 - mid), el, r.height]);
    });
    seen.sort((a, b) => a[0] - b[0]);
    fog.zones(seen.slice(0, MAX).map(([, el, h]) => ({ el, pad: h > 120 ? 26 : 16 })).concat(corners));
  }
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(pick); } };
  /* the blocks near the screen, kept by the browser; new blocks are watched as they are added */
  near = typeof IntersectionObserver === 'function' ? (() => {
    const inView = new Set(), watched = new Set();
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) inView.add(e.target); else inView.delete(e.target); });
      queue();
    }, { root: scroller, rootMargin: '40px 0px' });
    return {
      inView,
      watch() {
        watched.forEach((el) => { if (!el.isConnected) { watched.delete(el); inView.delete(el); io.unobserve(el); } });
        column.querySelectorAll(BLOCKS).forEach((el) => { if (!watched.has(el)) { watched.add(el); io.observe(el); } });
      },
    };
  })() : null;
  scroller.addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  new ResizeObserver(queue).observe(column);
  new MutationObserver(() => { dirty = true; queue(); }).observe(column, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  pick();
  return {
    column() { mode = 'column'; queue(); },
    only(list) { mode = 'only'; extra = list; queue(); },
    refresh: queue,
  };
}
