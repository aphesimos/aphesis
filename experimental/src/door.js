/* the door: the design system's threshold (limen), drawn large with the brush, a stippled night beyond it.
   It is the only thing on the screen between chambers. Clicked, tapped, or Enter or Space while focused, it opens:
   the night deepens and the door dissolves. After a chamber it re-forms. After the ending it closes for good:
   the night fills it and, once, it turns rubedo. Every change travels with minimum jerk. */

import { travel, REDUCED } from './motion.js';

const A = window.Aphesis;

/* the icon's own strokes on its 24-unit grid; the night is scattered finer than the icon's, since the door is large */
const STROKES = A.ICONS.threshold(0).strokes;
const inArch = (x, y) => (y > 10.5 && x > 7.7 && x < 16.3 && y < 20.4) || ((x - 12) ** 2 + (y - 10.5) ** 2 < 4.3 * 4.3 && y <= 10.5);
const NIGHT = A.stipple(inArch, 67, 2400, 0.32);

export function createDoor(el) {
  const svg = el.querySelector('svg');
  svg.innerHTML = '<path class="strokes" d="' + STROKES + '"/><path class="night" d="' + NIGHT + '"/>';
  const night = svg.querySelector('.night');
  let shown = 0, dark = 0.16, stop = null;

  function paint() {
    el.style.opacity = shown.toFixed(3);
    el.style.filter = shown > 0.995 ? '' : 'blur(' + ((1 - shown) * 10).toFixed(2) + 'px)';
    el.style.transform = 'translateY(' + ((1 - shown) * 14).toFixed(2) + 'px)';
    night.style.opacity = dark.toFixed(3);
  }
  function go(dur, toShown, toDark, done) {
    if (stop) stop();
    const s0 = shown, d0 = dark;
    stop = travel(dur, (e) => { shown = s0 + (toShown - s0) * e; dark = d0 + (toDark - d0) * e; paint(); }, done);
  }
  paint();

  return {
    el,
    /* re-form: out of the blur, the night faint behind it */
    show(done) {
      el.classList.remove('sealed');
      el.inert = false; el.removeAttribute('aria-hidden'); el.removeAttribute('aria-disabled');
      el.setAttribute('aria-label', 'a door'); el.dataset.tip = 'limen · the threshold';
      go(1800, 1, 0.16, done);
    },
    /* open: the night deepens, then the door dissolves */
    open(done) {
      el.inert = true; el.setAttribute('aria-hidden', 'true');
      go(REDUCED ? 0 : 700, 1, 0.85, () => go(1400, 0, 0.85, done));
    },
    /* close for good: the door returns filled with night, in rubedo */
    seal(done) {
      el.classList.add('sealed');
      el.inert = false; el.removeAttribute('aria-hidden'); el.setAttribute('aria-disabled', 'true');
      el.setAttribute('aria-label', 'the door, closed. the seal leads back.'); el.dataset.tip = 'clausum · closed';
      go(3200, 1, 1, done);
    },
  };
}
