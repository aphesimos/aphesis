/* composer: the quiet form. A text area whose only line is a brush stroke beneath it, an optional picture (made into
   a density map here, before it is sent, and shown as it will look), Turnstile when the server asks for it, and one
   word to send. Ctrl or Cmd + Enter sends too. Errors are said in words under the form, never in a box. */

import { checkFile, toDensity, ACCEPT } from './density.js';
import { image, stillSimulacrum } from './thumb.js';
import { esc } from './text.js';
import { stillOptions } from './legible.js';

const A = window.Aphesis;
/* the site's texts: the owner's version of a line where the site has one (the shell's Aphesis.text), else this one */
export const T = (key, own) => (A.text ? A.text(key, own) : own);
export const MAX_TEXT = 2000;
let formN = 0;

/* Turnstile: its script is loaded only when a site key is configured */
let tsLoad = null;
function turnstileReady() {
  if (!tsLoad) {
    tsLoad = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true; s.onload = () => resolve(window.turnstile); s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  return tsLoad;
}

function baseline(seed) {
  /* a brushed line on a 600 × 8 box, stretched across the form's width */
  const d = A.brush(A.line(3, 4, 597, 4, 160), 1.5, seed, 0.06, 0.1);
  return '<svg class="baseline" viewBox="0 0 600 8" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="' + d + '"/></svg>';
}

/* api: the client; thread: the thread id (a reply) or null (a new thread); onPosted({thread, n}) */
export function createComposer({ api, thread, onPosted, label }) {
  const id = 'c' + (++formN);
  const form = document.createElement('form');
  form.className = 'composer';
  form.noValidate = true;
  form.setAttribute('aria-label', label);
  form.innerHTML =
    '<label class="sr" for="' + id + 't">' + esc(label) + '</label>' +
    '<textarea id="' + id + 't" name="text" rows="4" maxlength="' + MAX_TEXT + '" placeholder="' +
      esc(thread ? T('forum.placeholder.reply', 'say it plainly. >>n quotes a post') : T('forum.placeholder.thread', 'begin with a first line worth reading')) + '"></textarea>' +
    baseline(thread ? 811 : 523) +
    '<div class="chosen" hidden><span class="pv"></span><button type="button" class="act rm" data-cursor=".55">remove the image</button></div>' +
    '<div class="ts" hidden></div>' +
    '<div class="crow">' +
      '<input class="file" id="' + id + 'f" type="file" accept="' + ACCEPT.join(',') + '">' +
      '<label class="act attach" for="' + id + 'f" data-cursor=".55">add an image</label>' +
      '<span class="grow"></span>' +
      '<span class="count aph-meta" aria-hidden="true">0 / ' + MAX_TEXT + '</span>' +
      '<button type="submit" class="act send" data-cursor=".55">' + (thread ? 'reply' : 'post') + '</button>' +
    '</div>' +
    '<p class="status aph-meta" role="status" aria-live="polite"></p>';
  const ta = form.querySelector('textarea'), file = form.querySelector('.file'), chosen = form.querySelector('.chosen');
  const pv = form.querySelector('.pv'), count = form.querySelector('.count'), status = form.querySelector('.status');
  const send = form.querySelector('.send'), tsBox = form.querySelector('.ts');
  let picked = null, busy = false, tsWidget = null;

  if (api.preview) {
    send.dataset.tip = 'this preview keeps your posts on this device only';
    send.setAttribute('aria-describedby', id + 'n');
    form.insertAdjacentHTML('beforeend', '<span class="sr" id="' + id + 'n">this preview keeps your posts on this device only</span>');
  }

  const say = (t, err) => { status.textContent = t; status.classList.toggle('err', !!err); };
  /* the area grows with its words (no resize grip: it would be the one solid mark on the form) */
  const counted = () => {
    count.textContent = ta.value.length + ' / ' + MAX_TEXT;
    ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px';
  };
  ta.addEventListener('input', counted);
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); form.requestSubmit(); } });

  if (api.turnstile) {
    tsBox.hidden = false;
    turnstileReady().then((ts) => { tsWidget = ts.render(tsBox, { sitekey: api.turnstile, appearance: 'interaction-only' }); })
      .catch(() => say('the check that keeps robots out did not load', true));
  }

  file.addEventListener('change', async () => {
    const f = file.files && file.files[0];
    if (!f) return;
    const bad = checkFile(f);
    if (bad) { say(bad, true); file.value = ''; return; }
    say('turning the picture into fog…');
    try {
      const density = await toDensity(f, api.densityLimits ? await api.densityLimits() : null);
      picked = { original: f, density };
      const im = await image(density.url);
      pv.innerHTML = stillSimulacrum(im, [160, 160], Object.assign(stillOptions(), { seed: 5 })).svg;
      chosen.hidden = false;
      say('this is how it will appear. the original goes with it, a click away.');
    } catch (_) {
      picked = null; chosen.hidden = true;
      say('this picture could not be read', true);
    }
    file.value = '';
  });
  form.querySelector('.rm').addEventListener('click', () => {
    picked = null; chosen.hidden = true; pv.innerHTML = ''; say('');
    form.querySelector('.attach').focus();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    const text = ta.value.replace(/\s+$/, '');
    if (!text.trim() && !(thread && picked)) { say(thread ? 'write something, or add an image' : 'a thread begins with words', true); ta.focus(); return; }
    let token = '';
    if (api.turnstile) {
      token = (window.turnstile && tsWidget !== null) ? window.turnstile.getResponse(tsWidget) : '';
      if (!token) { say('one moment: the check is not finished', true); return; }
    }
    busy = true; send.disabled = true; say('sending…');
    try {
      const r = await api.post({ thread, text, image: picked, turnstile: token });
      ta.value = ''; counted(); picked = null; chosen.hidden = true; pv.innerHTML = '';
      say(api.preview ? (api.persisted ? 'kept on this device.' : 'kept for this visit only: this browser will not store it.') : 'posted.');
      if (api.turnstile && window.turnstile && tsWidget !== null) window.turnstile.reset(tsWidget);
      onPosted(r);
    } catch (err) {
      say(err.message || 'the board did not answer', true);
    } finally { busy = false; send.disabled = false; }
  });

  return {
    el: form,
    /* add >>n on a line of its own, where the caret is, and give the text area the keyboard */
    quote(n) {
      const v = ta.value, at = ta.selectionStart ?? v.length;
      const before = v.slice(0, at), after = v.slice(at);
      const ins = (before && !before.endsWith('\n') ? '\n' : '') + '>>' + n + '\n';
      ta.value = before + ins + after; counted();
      ta.focus({ preventScroll: true });
      const c = before.length + ins.length; ta.setSelectionRange(c, c);
    },
    focus() { ta.focus({ preventScroll: true }); },
    get textarea() { return ta; },
  };
}
