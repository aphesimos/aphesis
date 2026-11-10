/* the threshold: the title, its gloss, the limen icon and nothing else.
   It answers gestures without explaining them: the doorway fills with stippled night while you hold or wait,
   a brush ring follows a circle as it is drawn, typed letters surface in the fog. */

import { REDUCED, frame } from './motion.js';

const A = window.Aphesis;
const $ = (id) => document.getElementById(id);

/* the icon's night, square by square: the runtime's own fill for the closed state, in the order it was scattered */
const NIGHT = A.ICONS.threshold(1).dots.split('M').filter(Boolean).map((s) => 'M' + s);
const STROKES = A.ICONS.threshold(0).strokes;

/* small brush marks under the threshold, one for each chamber found; no names, no list */
const SIGILS = {
  ouroboros: (x) => A.brush(A.arc(x, 12, 5, -60, 250, 40), 1.4, 101, 0.35),
  hands: (x) => A.brush(A.line(x - 7, 12, x - 1.5, 12, 12), 1.3, 103, 0.4) + A.brush(A.line(x + 1.5, 12, x + 7, 12, 12), 1.3, 105, 0.4),
  scholar: (x) => A.brush(A.line(x - 6, 15, x + 6, 9, 16), 1.2, 107, 0.45),
  tablet: (x) => A.stipple((u, v) => Math.abs(u - x) < 4.5 && Math.abs(v - 12) < 5.5, 109, 16000, 0.9, 96),
};
const ORDER = ['ouroboros', 'hands', 'scholar', 'tablet'];

export function createThreshold() {
  const section = $('threshold'), limen = $('limen'), night = limen.querySelector('.night'), echo = $('echo');
  const trace = $('trace'), tracePath = trace.querySelector('path'), foundSvg = $('found');
  limen.querySelector('.strokes').setAttribute('d', STROKES);
  A.letters(section.querySelector('.title'));

  let shownN = -1, knock = 0, lastDeg = -1;

  function fill(p) {
    const n = Math.round(Math.max(0, Math.min(1, p)) * NIGHT.length);
    if (n !== shownN) { night.setAttribute('d', NIGHT.slice(0, n).join('')); shownN = n; }
  }

  function center() {
    const r = limen.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  }

  /* a ring of brush around the threshold, as long as the circle drawn so far */
  function ring(w) {
    const deg = Math.round(Math.min(1, Math.abs(w)) * 360);
    if (deg === lastDeg) return; lastDeg = deg;
    trace.classList.toggle('on', deg > 24);
    if (deg < 8) return;
    const [cx, cy] = center(), r = Math.max(64, limen.offsetWidth * 1.35), a0 = -90;
    const a1 = a0 + (w < 0 ? -deg : deg);
    tracePath.setAttribute('d', A.brush(A.arc(cx, cy, r, a0, a1, Math.max(12, deg / 3)), 2.8, 71, 0.3));
  }

  return {
    section, limen, center,
    update(p, dt) {
      knock = Math.max(0, knock - dt * 0.5);
      fill(Math.max(p.fill, knock));
      ring(p.wind);
    },
    knock() { knock = REDUCED ? 0.3 : 0.42; },
    echo(text) {
      echo.textContent = text;
      echo.classList.toggle('on', !!text);
    },
    marks(list) {
      let d = '';
      ORDER.filter((id) => list.includes(id)).forEach((id, i, all) => {
        const x = 48 + (i - (all.length - 1) / 2) * 22;
        d += SIGILS[id](x);
      });
      foundSvg.innerHTML = d ? '<path d="' + d + '"/>' : '';
    },
    show() {
      section.classList.add('active');
      section.removeAttribute('aria-hidden'); section.inert = false;
    },
    hide() {
      section.classList.remove('active');
      section.setAttribute('aria-hidden', 'true'); section.inert = true;
      trace.classList.remove('on'); lastDeg = -1; fill(0);
    },
    frame,
  };
}
