/* line: the gate's one line. A single brushed baseline with no label, the typewriter's underscore blinking on it as
   the caret, and what is typed: for the password a grain of stipple per character, for the words the words
   themselves in the text face. A real input lies over it (transparent), so phones raise their keyboard, password
   managers find it and Enter sends it.

   Like the eye it lives on the 8 fps tick: the baseline is redrawn from one of three drawings each tick (its boil);
   a refusal makes it tremble, a hard offset each tick for a few ticks, never a slide.

   dissolve() and condense() take the line, or the eye, apart into stipple and back: a mask of square cells, 2 CSS
   pixels each, that go out (or come in) a share at a time on the tick, in a fixed random order. */

const A = window.Aphesis;
const VARIANTS = 3;

/* ---------- stipple in and out, for any element ---------- */
export function cells(el, dir, ticks, done) {
  const r = el.getBoundingClientRect();
  const C = 2, w = Math.max(1, Math.ceil(r.width / C)), h = Math.max(1, Math.ceil(r.height / C));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  const order = new Float32Array(w * h);
  const rand = A.rng(7 + w * 31 + h);
  /* not quite random: cells near the ends go first, so the line frays from its edges */
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const edge = Math.min(x, w - 1 - x) / (w / 2);
    order[y * w + x] = rand() * 0.75 + (1 - edge) * 0.25;
  }
  let k = 0;
  el.style.maskSize = el.style.webkitMaskSize = '100% 100%';
  el.style.maskRepeat = el.style.webkitMaskRepeat = 'no-repeat';
  el.style.imageRendering = 'pixelated';
  function frame() {
    k++;
    const share = Math.min(1, k / ticks);
    const img = g.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const on = dir === 'out' ? order[i] >= share : order[i] < share;
      img.data[i * 4 + 3] = on ? 255 : 0;
    }
    g.putImageData(img, 0, 0);
    const url = 'url(' + cv.toDataURL() + ')';
    el.style.maskImage = el.style.webkitMaskImage = url;
    if (k >= ticks) {
      clearInterval(t);
      if (dir === 'in') el.style.maskImage = el.style.webkitMaskImage = '';
      done && done();
    }
  }
  frame();
  const t = setInterval(frame, 125);
  return () => clearInterval(t);
}

export function createLine(form, { secret }) {
  const input = form.querySelector('input');
  const base = form.querySelector('.baseline');
  const marks = form.querySelector('.marks');
  const caret = form.querySelector('.caret');
  const mirror = form.querySelector('.mirror');
  let frame = 0, shake = 0;
  const drawings = [];
  for (let v = 0; v < VARIANTS; v++) drawings.push(A.brush(A.line(2, 7.4, 238, 6.6, 90), 1.6, 301 + v * 17, 0.18, 0.12));
  base.innerHTML = '<svg viewBox="0 0 240 14" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path fill="currentColor"/></svg>';
  const path = base.querySelector('path');
  /* grains: a few cells each, fixed per position, so a character always lands as the same grain */
  const GRAIN = [];
  for (let i = 0; i < 64; i++) GRAIN.push(A.stipple(A.inC(5, 5, 2.6), 900 + i * 7, 60, 1.25, 10));

  function show() {
    const v = input.value;
    if (secret) {
      marks.innerHTML = [...v].map((_, i) => '<svg viewBox="0 0 10 10" aria-hidden="true" focusable="false"><path fill="currentColor" d="' + GRAIN[i % 64] + '"/></svg>').join('');
    } else {
      mirror.textContent = v;
    }
    place();
  }
  function place() {
    const end = secret ? marks : mirror;
    const fr = form.getBoundingClientRect(), er = end.getBoundingClientRect();
    const x = Math.min(fr.width - 12, (er.width ? er.right - fr.left : 0) + 2);
    caret.style.transform = 'translateX(' + x.toFixed(1) + 'px)';
    caret.classList.remove('blink'); void caret.offsetWidth; caret.classList.add('blink');
  }
  input.addEventListener('input', show);
  addEventListener('resize', place);

  return {
    input,
    tick() {
      frame = (frame + 1 + Math.floor(Math.random() * (VARIANTS - 1))) % VARIANTS;
      path.setAttribute('d', drawings[frame]);
      if (shake > 0) {
        shake--;
        const dx = shake ? (Math.random() < 0.5 ? -1 : 1) * (2 + Math.floor(Math.random() * 4)) : 0;
        const dy = shake ? Math.round((Math.random() - 0.5) * 3) : 0;
        /* left and top, not a transform: the line stays in no stacking context of its own (its words are ink) */
        form.style.left = dx + 'px'; form.style.top = dy + 'px';
        form.dataset.tremble = shake ? '1' : '';
      }
    },
    /* the caret's place on screen, for the eye */
    caretPoint() { const r = caret.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; },
    tremble() { shake = 7; },
    clear() { input.value = ''; show(); },
    show,
    focus() { input.focus({ preventScroll: true }); place(); },
  };
}
