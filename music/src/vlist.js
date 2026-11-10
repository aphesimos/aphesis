/* vlist: a virtual list. Only the rows on screen (and a few around them) exist; each is absolutely placed with
   `top`, never a transform, so a row makes no stacking context for the .aph-ink text in it and the eye's wave
   still blends every line with the fog. The scroller may be the list's own pane (wide screens) or the whole
   section (phones): the list measures where it sits inside it on every update. */

export function createVList({ scroller, list, rowH, render, overscan = 8 }) {
  let count = 0, rows = new Map(), free = [], queued = 0, dead = false, renderFn = render;

  function offset() {
    if (scroller === list) return 0;
    return list.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
  }
  function range() {
    const top = scroller.scrollTop - offset(), h = scroller.clientHeight;
    const first = Math.max(0, Math.floor(top / rowH) - overscan);
    const last = Math.min(count - 1, Math.ceil((top + h) / rowH) + overscan);
    return [first, last];
  }
  function update() {
    queued = 0;
    if (dead) return;
    const [first, last] = range();
    for (const [i, el] of rows) {
      if (i < first || i > last) { rows.delete(i); el.remove(); free.push(el); }
    }
    for (let i = first; i <= last; i++) {
      if (rows.has(i)) continue;
      const el = free.pop() || document.createElement('div');
      el.style.top = i * rowH + 'px';
      el.dataset.i = i;
      renderFn(i, el);
      rows.set(i, el);
      list.appendChild(el);
    }
  }
  function schedule() { if (!queued) queued = requestAnimationFrame(update); }
  scroller.addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);

  return {
    /* a new set of rows: render(i, el) fills one */
    set(n, fn) {
      count = n; if (fn) renderFn = fn;
      for (const el of rows.values()) { el.remove(); free.push(el); }
      rows.clear();
      list.style.height = count * rowH + 'px';
      update();
    },
    /* draw the visible rows again (a track started, the theme changed) */
    refresh() { for (const [i, el] of rows) renderFn(i, el); },
    rows() { return rows; },
    get count() { return count; },
    get rowH() { return rowH; },
    setRowH(h) { if (h !== rowH) { rowH = h; this.set(count); } },
    /* bring row i into view, nearest edge */
    reveal(i) {
      const off = offset(), top = off + i * rowH, h = scroller.clientHeight;
      const pad = rowH;
      if (top < scroller.scrollTop + (scroller === list ? 0 : pad)) scroller.scrollTop = top - (scroller === list ? 0 : pad);
      else if (top + rowH > scroller.scrollTop + h - pad) scroller.scrollTop = top + rowH - h + pad;
      update();
    },
    scrollTo(y) { scroller.scrollTop = y; update(); },
    update,
    destroy() { dead = true; scroller.removeEventListener('scroll', schedule); removeEventListener('resize', schedule); cancelAnimationFrame(queued); },
  };
}
