/* composer: one quiet line to write in. No box: a brushed baseline under the words and a caret typed in the text
   face. Enter or the send label sends it. The page checks the filter first so a refused word is answered at once;
   the wall decides. When it is taken, the line lifts off the baseline and thins into the fog, and the drift
   receives it among the others.

   createComposer(form, { api, onSent, say }) -> { field }
   say(text, refused, again): a refusal stays, in the accent, until the line is touched or sent again; `again` offers
   `try again` beside it when sending the same line again may work (the check, the network, the wall's own stumble).
   Turnstile is loaded only when the wall is live and a site key is configured, and only when someone starts to
   write; its widget stays invisible unless Cloudflare needs to ask something. */

import { travel } from './motion.js';
import { check, MAX_LENGTH } from './filter.js';

const A = window.Aphesis;
/* the site's texts: the owner's version of a line where the site has one (the shell's Aphesis.text), else this one */
const T = (key, own) => (A.text ? A.text(key, own) : own);

const WORDS = {
  word: 'the fog will not carry that word.',
  link: 'no links on the wall.',
  long: 'too long: one line, ' + MAX_LENGTH + ' characters at most.',
  empty: 'write a line first.',
  turnstile: 'the check did not pass, or it ran out of time.',
  turnstile_load: 'the check did not load; the line was not sent.',
  offline: 'the wall is out of reach; the line was not sent.',
  stumbled: 'the wall stumbled on its side; the line did not go.',
  unavailable: 'the wall is not open yet. try again later.',
  bad: 'that line could not be read.',
};
/* the refusals that sending the same line again may get past */
const AGAIN = new Set(['turnstile', 'turnstile_load', 'offline', 'stumbled']);
const rate = (s) => `too fast: a little patience. try again in ${Math.max(1, Math.ceil(+s || 20))} s.`;

export function createComposer(form, { api, onSent, say }) {
  const input = form.querySelector('#line');
  const mirror = form.querySelector('.mirror');
  const caret = form.querySelector('.caret');
  const base = form.querySelector('.baseline');
  const count = form.querySelector('#count');
  const send = form.querySelector('#send');
  const box = form.querySelector('#turnstile');
  let busy = false, refused = false;
  const refuse = (reason, retryAfter) => {
    refused = true;
    say(reason === 'rate' ? rate(retryAfter) : (WORDS[reason] || WORDS.bad), true, AGAIN.has(reason));
  };

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
    /* a refusal stays until the line changes */
    if (refused) { refused = false; say('', false); }
    placeCaret();
  }
  ['input', 'focus', 'blur', 'keyup', 'click', 'select', 'scroll'].forEach((e) => input.addEventListener(e, e === 'input' ? typed : placeCaret));
  document.addEventListener('selectionchange', () => { if (document.activeElement === input) placeCaret(); });
  addEventListener('resize', placeCaret);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeCaret);

  /* ---------- Turnstile, only when live and configured ----------
     Turnstile forgets a widget whose box leaves the page, which happens whenever the site puts the wall aside and
     brings it back, and asking a forgotten widget for its answer throws: so the widget is checked, and drawn again
     when it is gone, on focus and before every send. Its answer is good for one line and renewed after each. */
  let widget = null, loading = null;
  const useTurnstile = api.live && !!api.sitekey;
  function loadTurnstile() {
    if (!useTurnstile) return Promise.resolve(false);
    if (!loading) {
      loading = new Promise((resolve) => {
        const s = document.createElement('script');
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        s.async = true;
        s.onload = () => resolve(true);
        /* a failed load is tried again on the next send */
        s.onerror = () => { loading = null; s.remove(); resolve(false); };
        document.head.appendChild(s);
      });
    }
    return loading;
  }
  const alive = () => {
    if (widget === null || !window.turnstile) return false;
    try { window.turnstile.getResponse(widget); return box.isConnected; } catch (_) { return false; }
  };
  async function draw() {
    if (!(await loadTurnstile()) || !window.turnstile) return false;
    if (alive()) return true;
    if (widget !== null) { try { window.turnstile.remove(widget); } catch (_) { /* already forgotten */ } }
    widget = null; box.replaceChildren(); box.classList.remove('on');
    try {
      const dark = document.documentElement.classList.contains('is-dark');
      widget = window.turnstile.render(box, {
        sitekey: api.sitekey, appearance: 'interaction-only', theme: dark ? 'dark' : 'light', size: 'flexible',
        'before-interactive-callback': () => box.classList.add('on'),
        'after-interactive-callback': () => box.classList.remove('on'),
      });
    } catch (_) { widget = null; }
    return widget !== null;
  }
  if (useTurnstile) input.addEventListener('focus', () => { draw(); });
  /* the answer, or a reason it could not be had: waiting quietly up to 25 s for the challenge to finish */
  async function token() {
    if (!useTurnstile) return { token: '' };
    if (!(await draw())) return { reason: 'turnstile_load' };
    for (let n = 0; n < 100; n++) {
      let v = '';
      try { v = window.turnstile.getResponse(widget) || ''; } catch (_) { if (!(await draw())) return { reason: 'turnstile_load' }; }
      if (v) return { token: v };
      await new Promise((r) => setTimeout(r, 250));
    }
    return { reason: 'turnstile' };
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
      if (v.reason !== 'empty' || document.activeElement !== input) refuse(v.reason);
      input.focus();
      return;
    }
    busy = true;
    form.classList.add('busy');
    refused = false;
    say('condensing…');
    let res;
    try {
      const t = await token();
      res = t.reason ? { ok: false, reason: t.reason } : await api.post(v.text, t.token);
    } catch (_) {
      res = { ok: false, reason: 'offline' };
    } finally {
      if (useTurnstile && widget !== null) try { window.turnstile.reset(widget); } catch (_) { widget = null; }
      busy = false;
      form.classList.remove('busy');
    }
    if (!res.ok) {
      /* the line stays where it was written */
      refuse(res.reason, res.retryAfter);
      return;
    }
    release(v.text);
    say(api.live ? T('wall.sent', 'it is in the fog now.') : 'it is in the fog now, on this device.');
    setTimeout(() => onSent(res.message), 520);
  });

  send.addEventListener('pointerdown', (e) => { if (document.activeElement === input) e.preventDefault(); });
  return { field: form };
}
