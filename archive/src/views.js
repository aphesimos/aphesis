/* views: the list and the posts are views in one scrolling column. Moving between them, the outgoing view's
   blocks lift away and blur (0.45 s) while the incoming ones rise out of a small blur (1.1 s), both eased with
   minimum jerk and overlapping, so a frame is never empty. The outgoing view is taken out of the flow where it
   stands, so the column can jump to the incoming view's own scroll position without moving it. */

import { travel } from './motion.js';

const OUT = 450, IN = 1100, OVERLAP = 120;

/* the blocks a view moves as: every .aph-ink container, and every other block that holds none. Whole views are
   never blurred or faded, since that would isolate their text from the fog: during the eye's wave, .aph-ink text
   must blend with the fog cells beneath it, and a filtered or faded ancestor would cut it off. */
const unitCache = new WeakMap();
function units(view) {
  if (!unitCache.has(view)) {
    const out = [];
    const walk = (el) => {
      for (const c of el.children) {
        if (c.classList.contains('aph-ink') || !c.querySelector('.aph-ink')) out.push(c); else walk(c);
      }
    };
    walk(view.querySelector('.col'));
    unitCache.set(view, out);
  }
  return unitCache.get(view);
}

/* opacity leads the blur: the ink is legible early, so a frame never holds only the text's halo of ground
   (on the closed eye a blurred, faint line would leave a dark smudge with no letters in it) */
function paint(view, shown, rise) {
  const o = Math.min(1, shown * 1.8).toFixed(3);
  const f = shown > 0.995 ? '' : 'blur(' + ((1 - shown) * 6).toFixed(2) + 'px)';
  const t = shown > 0.995 ? '' : 'translateY(' + ((1 - shown) * rise).toFixed(2) + 'px)';
  units(view).forEach((u) => { u.style.opacity = o; u.style.filter = f; u.style.transform = t; });
}
function clear(el) {
  units(el).forEach((u) => { u.style.opacity = u.style.filter = u.style.transform = ''; });
  el.style.position = el.style.top = el.style.left = el.style.right = '';
  el.classList.remove('leaving');
  el.inert = false;
}

export function createViews(scroller, views) {
  let current = null, stops = [];

  function settle() {
    stops.forEach((s) => s()); stops = [];
    views.forEach((v) => { if (v !== current) { clear(v); v.hidden = true; } });
    if (current) clear(current);
  }

  /* show `next`; `scrollTo` is where the column should stand once it is in; done() when it has arrived */
  function go(next, scrollTo, done) {
    if (next === current) { if (done) done(); return; }
    settle();
    const prev = current;
    current = next;
    const s = scroller.scrollTop;
    let base = 0;
    if (prev) {
      const top = prev.offsetTop;
      prev.classList.add('leaving');
      prev.inert = true;
      prev.style.position = 'absolute'; prev.style.left = '0'; prev.style.right = '0';
      base = top - s;
      prev.style.top = base + 'px';
    }
    next.hidden = false;
    paint(next, 0, 14);
    scroller.scrollTop = scrollTo || 0;
    if (prev) prev.style.top = (base + scroller.scrollTop) + 'px';
    if (prev) {
      stops.push(travel(OUT, (e) => paint(prev, 1 - e, -8), () => { clear(prev); prev.hidden = true; }));
    }
    const enter = () => stops.push(travel(IN, (e) => paint(next, e, 14), () => { clear(next); if (done) done(); }));
    if (prev) { const id = setTimeout(enter, OVERLAP); stops.push(() => clearTimeout(id)); } else enter();
  }

  return { go, get current() { return current; } };
}
