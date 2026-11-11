/* composer: one quiet line to write in. No box: a brushed baseline under the words and a caret typed in the text
   face. Enter or the send label sends it. The page checks the filter first so a refused word is answered at once;
   the wall decides. When it is taken, the line lifts off the baseline and thins into the fog, and the drift
   receives it among the others.

   createComposer(form, { api, onSent, say }) -> { field }
   Turnstile is loaded only when the wall is live and a site key is configured, and only when someone starts to
   write; its widget stays invisible unless Cloudflare needs to ask something. */

import { travel } from './motion.js';
import { check, MAX_LENGTH } from './filter.js';

const A = window.Aphesis;
/* the site's texts: the owner's version of a line where the site has one (the shell's Aphesis.text), else this one */
const T = (key, own) => (A.text ? A.text(key, own) : own);

const WORDS = {
  word: "that word isn't allowed.",
  link: 'no links.',
  long: 'one line, ' + MAX_LENGTH + ' characters at most.',
  empty: 'write a line first.',
  turnstile: 'the check did not pass. try once more.',
  offline: 'the wall is out of reach. try again later.',
  unavailable: 'the wall is out of reach. try again later.',
  bad: 'that line could not be read.',
};
const rate = (s) => `a little patience: try again in ${Math.max(1, s | 0)} s.`;

export function createComposer(form, { api, onSent, say }) {
  const input = form.querySelector('#line');
  const mirror = form.querySelector('.mirror');
  const caret = form.querySelector('.caret');
  const base = form.querySelector('.baseline');
  const count = form.querySelector('#count');
  const send = form.querySelector('#send');
  const box = form.querySelector('#turnstile');
  let busy = false;

  /* ---------- the brushed baseline ---------- */
  function drawBase() {
    const w = Math.max(40, Math.round(base.getBoundingClientRect().width));
    const pts = [];
    for (let i = 0; i <= 96; i++) {
      const u = i / 96;
      pts.push([2 + u * (w - 4), 5 + Math.sin(u * Math.PI) * 0.9 + Math.sin(u * 7.3 + 1.1) * 0.35]);
    }
    base.setAttribute('viewBox', `0 0 ${w} 10`);
    base.innerHTML = `<path fill="currentColor" d="${A.brush(pts, 1.7, 61, 0.3, 0.1)}"/>`;
  }
  drawBase();
  addEventListener('resize', drawBase);

  /* ---------- the caret: a typed underscore where the text would continue ---------- */
  function placeCaret() {
    const focused = document.activeElement === input;
    const a = input.selectionStart, b = input.selectionEnd;
    if (!focused || a === null || a !== b) { caret.classList.remove('on'); return; }
    mirror.textContent = input.value.slice(0, a).replace(/ /g, ' ');
    const cs = getComputedStyle(input);
    const x = parseFloat(cs.paddingLeft) + mirror.getBoundingClientRect().width - input.scrollLeft;
    const max = input.clientWidth - parseFloat(cs.paddingRight);
    caret.style.transform = `translateX(${Math.min(Math.max(x, 0), max).toFixed(1)}px)`;
    caret.classList.add('on');
  }
  function typed() {
    caret.classList.remove('blink');
    void caret.offsetWidth;
    caret.classList.add('blink');
    const n = Array.from(input.value).length;
    count.textContent = n ? `${n} / ${MAX_LENGTH}` : '';
    count.classList.toggle('near', n > MAX_LENGTH - 20);
    count.classList.toggle('aph-ink', n <= MAX_LENGTH - 20); /* red near the limit: out of the ink then */
    form.classList.toggle('has-text', n > 0);
    placeCaret();
  }
  ['input', 'focus', 'blur', 'keyup', 'click', 'select', 'scroll'].forEach((e) => input.addEventListener(e, e === 'input' ? typed : placeCaret));
  document.addEventListener('selectionchange', () => { if (document.activeElement === input) placeCaret(); });
  addEventListener('resize', placeCaret);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeCaret);

  /* ---------- Turnstile, only when live and configured ---------- */
  let widget = null, loading = null;
  const useTurnstile = api.live && !!api.sitekey;
  function loadTurnstile() {
    if (!useTurnstile || loading) return loading;
    loading = new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.onload = () => {
        try {
          const dark = document.documentElement.classList.contains('is-dark');
          widget = window.turnstile.render(box, {
            sitekey: api.sitekey, appearance: 'interaction-only', theme: dark ? 'dark' : 'light', size: 'flexible',
            'before-interactive-callback': () => box.classList.add('on'),
            'after-interactive-callback': () => box.classList.remove('on'),
          });
        } catch (_) { widget = null; }
        resolve();
      };
      s.onerror = () => resolve();
      document.head.appendChild(s);
    });
    return loading;
  }
  if (useTurnstile) input.addEventListener('focus', loadTurnstile, { once: true });
  async function token() {
    if (!useTurnstile) return '';
    await loadTurnstile();
    if (widget === null || !window.turnstile) return '';
    const t = window.turnstile.getResponse(widget);
    if (t) return t;
    /* wait for the challenge to finish, quietly, up to 20 s */
    return new Promise((resolve) => {
      let n = 0;
      const id = setInterval(() => {
        const v = window.turnstile.getResponse(widget);
        if (v || ++n > 80) { clearInterval(id); resolve(v || ''); }
      }, 250);
    });
  }

  /* ---------- the line leaves the baseline ---------- */
  function release(text) {
    const ghost = document.createElement('span');
    ghost.className = 'ghost aph-ink';
    ghost.setAttribute('aria-hidden', 'true');
    ghost.textContent = text;
    const cs = getComputedStyle(input);
    ghost.style.left = parseFloat(cs.paddingLeft) - input.scrollLeft + 'px';
    input.parentNode.appendChild(ghost);
    input.value = '';
    typed();
    travel(1300, (e) => {
      ghost.style.transform = `translateY(${(-26 * e).toFixed(2)}px)`;
      ghost.style.filter = `blur(${(8 * e).toFixed(2)}px)`;
      ghost.style.opacity = (1 - e).toFixed(3);
    }, () => ghost.remove());
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    const text = input.value;
    const v = check(text);
    if (!v.ok) {
      if (v.reason !== 'empty' || document.activeElement !== input) say(WORDS[v.reason] || WORDS.bad, true);
      input.focus();
      return;
    }
    busy = true;
    form.classList.add('busy');
    say('sending…');
    const res = await api.post(v.text, await token());
    if (useTurnstile && widget !== null) try { window.turnstile.reset(widget); } catch (_) { /* nothing to reset */ }
    busy = false;
    form.classList.remove('busy');
    if (!res.ok) {
      say(res.reason === 'rate' ? rate(res.retryAfter) : (WORDS[res.reason] || WORDS.bad), true);
      return;
    }
    release(v.text);
    say(api.live ? T('wall.sent', 'posted.') : 'saved on this device.');
    setTimeout(() => onSent(res.message), 520);
  });

  send.addEventListener('pointerdown', (e) => { if (document.activeElement === input) e.preventDefault(); });
  return { field: form };
}
