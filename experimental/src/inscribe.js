/* inscribe: a chamber's passage, typed into the fog by the Typist, line after line, in order.
   Each line is in its original language; the English is in the tooltip and, whole, for screen readers. */

import { REDUCED, wait, onPause } from './motion.js';

const A = window.Aphesis;

export function inscribe(parent, { cls, lang, lines, hold = 6500, gap = 1400, onLine }) {
  const p = document.createElement('p');
  p.className = 'chamber-text ' + cls;
  p.lang = lang;
  p.innerHTML = '<span class="typed" aria-hidden="true"></span><span class="aph-caret blink" aria-hidden="true"></span><span class="sr" aria-live="polite"></span>';
  parent.appendChild(p);
  const typed = p.querySelector('.typed'), caret = p.querySelector('.aph-caret'), sr = p.querySelector('.sr');
  const typist = new A.Typist(typed, caret);

  let i = -1, phase = 'idle', cancel = null, running = false;
  const line = () => lines[i];

  function next() {
    i = (i + 1) % lines.length;
    const l = line();
    p.dataset.tip = l.en + (l.src ? '  · ' + l.src : '');
    sr.textContent = l.text + ' (' + l.en + ')';
    onLine && onLine(l, i);
    type();
  }
  function type() {
    phase = 'type';
    typist.type(line().text, () => { phase = 'hold'; cancel = wait(REDUCED ? hold * 1.6 : hold, erase); });
  }
  function erase() {
    phase = 'erase';
    const after = () => { phase = 'gap'; cancel = wait(gap, next); };
    if (REDUCED) { typist.buf = []; typed.textContent = ''; after(); } else typist.erase(after);
  }

  const off = onPause((paused) => {
    if (!running) return;
    if (paused) { if (phase === 'type' || phase === 'erase') typist.stop(); }
    else if (phase === 'type') type();
    else if (phase === 'erase') erase();
  });

  return {
    el: p,
    start() { running = true; p.classList.add('on'); next(); },
    /* how much of the current line stands on the page, 0 to 1 */
    progress() { const l = line(); return l ? Math.min(1, typist.buf.length / Array.from(l.text).length) : 0; },
    phase: () => phase,
    stop() { running = false; typist.stop(); if (cancel) cancel(); p.classList.remove('on'); },
    destroy() { this.stop(); off(); p.remove(); },
  };
}
