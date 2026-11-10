/* the ground: one fog for the whole section (density .62, light .4, as every section) and its calm zones.
   A page here scrolls, so the zones follow the reader: on every scroll or resize the blocks marked [data-zone]
   that touch the screen are handed to the fog, after the two corners, up to the fog's twelve. On a phone the column
   scrolls in its own frame: the listener captures, so it hears that scroll too. */

const A = window.Aphesis;

export function createGround(canvas, corners) {
  const fog = A.Fog(canvas, { density: 0.62, light: 0.4 });
  let root = null, queued = false;
  function pick() {
    queued = false;
    const list = corners.slice();
    if (root) {
      const h = innerHeight;
      for (const el of root.querySelectorAll('[data-zone]')) {
        if (list.length >= 12) break;
        const r = el.getBoundingClientRect();
        if (r.width && r.bottom > -40 && r.top < h + 40) list.push({ el, pad: +(el.dataset.zone || 16) });
      }
    }
    fog.zones(list);
  }
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(pick); } };
  addEventListener('scroll', queue, { passive: true, capture: true });
  addEventListener('resize', queue);
  return {
    fog,
    /* the view whose [data-zone] blocks keep the fog calm */
    watch(el) { root = el; queue(); },
    refresh: queue,
  };
}
