/* tip: the site's tooltip (.aph-tip from the design system's bundle.css), for this section.
   It answers the pointer as the runtime's does (any [data-tip], after 420 ms, beside the pointer) and also
   keyboard focus, which footnotes need: a footnote marker (.fn-mark, its text in data-note) shows its note on
   hover, on focus and on a tap. The text arrives whole with the tooltip's soft entrance (a small blur and rise),
   never typed. */

const DELAY = 420;

export function createTip() {
  const el = document.createElement('div');
  el.className = 'aph-tip arc-tip';
  el.setAttribute('aria-hidden', 'true');
  document.body.appendChild(el);
  let target = null, timer = 0, mode = null, mx = 0, my = 0;

  const textOf = (t) => t.dataset.note || t.dataset.tip || '';
  const find = (node) => node && node.closest && node.closest('.fn-mark, [data-tip]');

  function placeAtPointer() {
    const r = el.getBoundingClientRect(), pad = 16;
    let x = mx + 18, y = my + 20;
    if (x + r.width > innerWidth - pad) x = mx - 18 - r.width;
    if (y + r.height > innerHeight - pad) y = my - 20 - r.height;
    el.style.left = Math.max(pad, x) + 'px'; el.style.top = Math.max(pad, y) + 'px';
  }
  function placeAtElement(t) {
    const b = t.getBoundingClientRect(), r = el.getBoundingClientRect(), pad = 16;
    let x = b.left + b.width / 2 - 24, y = b.bottom + 10;
    if (x + r.width > innerWidth - pad) x = innerWidth - pad - r.width;
    if (y + r.height > innerHeight - pad) y = b.top - 10 - r.height;
    el.style.left = Math.max(pad, x) + 'px'; el.style.top = Math.max(pad, y) + 'px';
  }
  function show(t, how) {
    clearTimeout(timer);
    target = t; mode = how;
    el.classList.toggle('note', !!t.dataset.note);
    el.textContent = textOf(t);
    if (how === 'pointer') placeAtPointer(); else placeAtElement(t);
    el.classList.add('on');
    if (t.classList.contains('fn-mark')) t.setAttribute('aria-expanded', 'true');
  }
  function hide() {
    clearTimeout(timer);
    if (target && target.classList.contains('fn-mark')) target.setAttribute('aria-expanded', 'false');
    target = null; mode = null;
    el.classList.remove('on');
  }

  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    mx = e.clientX; my = e.clientY;
    const t = find(e.target);
    if (t === target) { if (mode === 'pointer' && el.classList.contains('on')) placeAtPointer(); return; }
    if (mode === 'focus' && !t) return;          /* a note opened by the keyboard stays until focus moves */
    hide();
    if (t) { target = t; mode = 'wait'; timer = setTimeout(() => show(t, 'pointer'), DELAY); }
  });
  /* a tap on a footnote marker opens its note beside it; a tap anywhere else closes it */
  addEventListener('click', (e) => {
    const t = e.target.closest && e.target.closest('.fn-mark');
    if (t) {
      e.preventDefault();
      if (target === t && el.classList.contains('on') && mode !== 'pointer') hide(); else show(t, 'tap');
    } else if (mode === 'tap') hide();
  });
  document.addEventListener('focusin', (e) => {
    const t = find(e.target);
    if (t && t.matches(':focus-visible')) show(t, 'focus'); else if (mode === 'focus') hide();
  });
  document.addEventListener('focusout', () => { if (mode === 'focus' || mode === 'tap') hide(); });
  /* a press acts on what the tip names (the eye switches the theme): the tip has said its part */
  addEventListener('pointerdown', (e) => { if (mode === 'pointer' || mode === 'wait') hide(); });
  addEventListener('scroll', () => { if (mode === 'focus' || mode === 'tap') placeAtElement(target); }, true);
  addEventListener('blur', hide);

  return {
    hide,
    /* is a note open? (Escape closes it before it leaves the post) */
    get open() { return !!target && el.classList.contains('on'); },
  };
}
