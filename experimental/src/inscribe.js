/* inscribe: a chamber's passage, typed into the fog by the Typist, line after line, in order.
   Each line is in its original language; the English is in the tooltip and, whole, for screen readers. */

import { REDUCED, wait, onPause } from './motion.js';

const A = window.Aphesis;

/* once: the passage is written through one time and then onDone() is called after the last line's hold.
   advance(): finishes the line being typed, or moves to the next one (a click, a tap, Enter or Space). */
export function inscribe(parent, { cls, lang, lines, hold = 6500, gap = 1400, onLine, once = false, onDone }) {
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
    if (once && i === lines.length - 1) return;
    i = (i + 1) % lines.length;
    const l = line();
    p.dataset.tip = l.en + (l.src ? '  · ' + l.src : '');
    sr.textContent = l.text + ' (' + l.en + ')';
    onLine && onLine(l, i);
    type();
  }
  function type() {
    phase = 'type';
    typist.type(line().text, held);
  }
  function held() {
    phase = 'hold';
    if (once && i === lines.length - 1) { cancel = wait(REDUCED ? hold * 1.2 : hold * 0.6, () => { phase = 'done'; onDone && onDone(); }); return; }
    cancel = wait(REDUCED ? hold * 1.6 : hold, erase);
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
    advance() {
      if (!running) return;
      if (phase === 'type') { typist.stop(); typist.buf = Array.from(line().text); typed.textContent = line().text; if (cancel) cancel(); held(); }
      else if (phase === 'hold') { if (cancel) cancel(); if (once && i === lines.length - 1) { phase = 'done'; onDone && onDone(); } else erase(); }
      else if (phase === 'erase' || phase === 'gap') { typist.stop(); if (cancel) cancel(); typist.buf = []; typed.textContent = ''; next(); }
    },
    done: () => phase === 'done',
    progress() { const l = line(); return l ? Math.min(1, typist.buf.length / Array.from(l.text).length) : 0; },
    phase: () => phase,
    stop() { running = false; typist.stop(); if (cancel) cancel(); p.classList.remove('on'); },
    destroy() { this.stop(); off(); p.remove(); },
  };
}
