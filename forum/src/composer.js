/* composer: the quiet form. A text area whose only line is a brush stroke beneath it, an optional picture (made into
   a density map here, before it is sent, and shown as it will look; made smaller first when the board would not take
   it as it is), Turnstile when the server asks for it, and one word to send. Ctrl or Cmd + Enter sends too.

   Whatever stops a post is said in words under the form, in the accent, never in a box: in one live region, with
   `try again` beside it when sending again as it is may work (the check, the network, the board's own stumble).
   What was written and the picture chosen stay until a post goes. The image limits are said under `add an image`
   before anyone picks one, from the board's own pages. */

import { prepareUpload } from './density.js';
import { explain, refusal, size, LIMITS } from './refusal.js';
import { image, stillSimulacrum } from './thumb.js';
import { esc } from './text.js';
import { stillOptions } from './legible.js';

const A = window.Aphesis;
/* the site's texts: the owner's version of a line where the site has one (the shell's Aphesis.text), else this one */
export const T = (key, own) => (A.text ? A.text(key, own) : own);
export const MAX_TEXT = 2000;
let formN = 0;

/* Turnstile: its script is loaded only when a site key is configured (and asked for again after a failed load) */
let tsLoad = null;
function turnstileReady() {
  if (!tsLoad) {
    tsLoad = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true; s.onload = () => resolve(window.turnstile);
      s.onerror = () => { tsLoad = null; s.remove(); reject(new Error('turnstile')); };
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

/* the words as the Worker will count them: line ends normalized, four or more blank lines kept to three, the end
   trimmed */
function normalized(t) {
  return String(t).replace(/\r\n?/g, '\n').replace(/\n{4,}/g, '\n\n\n').replace(/\s+$/, '');
}

/* "jpeg, png, webp or gif, up to 4 mb and 40 megapixels; a larger one is made smaller here before it goes" */
function imageHint(L) {
  return 'images: jpeg, png, webp or gif, up to ' + size(L.original.bytes) + ' and ' + Math.round(L.original.pixels / 1e6) +
    ' megapixels. a larger one, or a heic this browser opens, is made smaller here before it goes.';
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
    '<textarea id="' + id + 't" name="text" rows="4" maxlength="' + MAX_TEXT + '" aria-describedby="' + id + 's" placeholder="' +
      esc(thread ? T('forum.placeholder.reply', 'say it plainly. >>n quotes a post') : T('forum.placeholder.thread', 'begin with a first line worth reading')) + '"></textarea>' +
    baseline(thread ? 811 : 523) +
    '<div class="chosen" hidden><span class="pv"></span><button type="button" class="act rm" data-cursor=".55">remove the image</button></div>' +
    '<div class="ts" hidden></div>' +
    '<div class="crow">' +
      '<input class="file" id="' + id + 'f" type="file" accept="image/*" aria-describedby="' + id + 'h">' +
      '<label class="act attach" for="' + id + 'f" data-cursor=".55">add an image</label>' +
      '<span class="grow"></span>' +
      '<span class="count aph-meta" aria-hidden="true">0 / ' + MAX_TEXT + '</span>' +
      '<button type="submit" class="act send" data-cursor=".55">' + (thread ? 'reply' : 'post') + '</button>' +
    '</div>' +
    '<p class="hint aph-meta" id="' + id + 'h">' + esc(imageHint(LIMITS)) + '</p>' +
    '<p class="status aph-meta"><span class="say" id="' + id + 's" role="status" aria-live="polite"></span>' +
      '<button type="button" class="act retry" data-cursor=".55" hidden>try again</button></p>';
  const ta = form.querySelector('textarea'), file = form.querySelector('.file'), chosen = form.querySelector('.chosen');
  const pv = form.querySelector('.pv'), count = form.querySelector('.count'), status = form.querySelector('.status');
  const line = form.querySelector('.say'), retry = form.querySelector('.retry'), hint = form.querySelector('.hint');
  const send = form.querySelector('.send'), tsBox = form.querySelector('.ts');
  let picked = null, preparing = null, busy = false, tsWidget = null;
  let limits = LIMITS;
  if (api.limits) api.limits().then((l) => { limits = l; hint.textContent = imageHint(l); }).catch(() => {});

  if (api.preview) {
    send.dataset.tip = 'this preview keeps your posts on this device only';
    send.setAttribute('aria-describedby', id + 'n');
    form.insertAdjacentHTML('beforeend', '<span class="sr" id="' + id + 'n">this preview keeps your posts on this device only</span>');
  }

  /* one line under the form: what is happening, or why the post did not go (in the accent), with `try again` when
     sending again as it is may work */
  const say = (t, err, again) => {
    line.textContent = t;
    status.classList.toggle('err', !!err);
    retry.hidden = !again;
  };
  const refuse = (e) => { const x = explain(e, limits, { thread }); say(x.text, true, !!x.retry); return x; };
  retry.addEventListener('click', () => { retry.hidden = true; form.requestSubmit(); });

  /* the area grows with its words (no resize grip: it would be the one solid mark on the form) */
  const counted = () => {
    count.textContent = ta.value.length + ' / ' + MAX_TEXT;
    ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px';
  };
  ta.addEventListener('input', counted);
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); form.requestSubmit(); } });

  /* ---------- Turnstile ----------
     The widget is drawn into the form's box. It can vanish under the form: Turnstile forgets a widget whose box leaves
     the page, which happens whenever the site puts the section aside and brings it back, and asking a forgotten
     widget for its answer throws. So the widget is checked, and drawn again when it is gone, before every send and
     whenever the words are touched; and its answer, good for one post, is renewed after every try. */
  const tsAlive = () => {
    if (tsWidget === null || !window.turnstile) return false;
    try { window.turnstile.getResponse(tsWidget); return tsBox.isConnected; } catch (_) { return false; }
  };
  async function tsDraw() {
    const ts = await turnstileReady();
    if (tsAlive()) return;
    if (tsWidget !== null) { try { ts.remove(tsWidget); } catch (_) { /* already forgotten */ } }
    tsWidget = null; tsBox.replaceChildren();
    if (!tsBox.isConnected) return;   /* drawn once the form is on the page (its words touched, or a send) */
    tsWidget = ts.render(tsBox, { sitekey: api.turnstile, appearance: 'interaction-only' });
  }
  /* the answer, waiting up to 25 s for the check to finish (it asks for a click only when it must) */
  async function tsToken() {
    try { await tsDraw(); } catch (_) { throw refusal('turnstile_load'); }
    /* never ask without a widget of this form's own: Turnstile would answer with another form's */
    if (tsWidget === null) throw refusal('turnstile_load');
    for (let i = 0; i < 100; i++) {
      let t = '';
      try { t = window.turnstile.getResponse(tsWidget) || ''; } catch (_) {
        try { await tsDraw(); } catch (e) { throw refusal('turnstile_load'); }
        if (tsWidget === null) throw refusal('turnstile_load');
      }
      if (t) return t;
      await new Promise((r) => setTimeout(r, 250));
    }
    throw refusal('turnstile');
  }
  const tsRenew = () => { try { if (tsWidget !== null) window.turnstile.reset(tsWidget); } catch (_) { tsWidget = null; } };
  if (api.turnstile) {
    tsBox.hidden = false;
    /* drawn as soon as the form is on the page, so the answer is usually ready before the words are */
    requestAnimationFrame(() => tsDraw().catch(() => {}));
    ta.addEventListener('focus', () => { if (!tsAlive()) tsDraw().catch(() => {}); });
  }

  /* ---------- the image ---------- */
  file.addEventListener('change', () => {
    const f = file.files && file.files[0];
    file.value = '';
    if (!f) return;
    say('turning the picture into fog…');
    const mine = preparing = (async () => {
      try {
        const up = await prepareUpload(f, limits);
        if (preparing !== mine) return;
        picked = { original: up.original, density: up.density };
        const im = await image(up.density.url);
        pv.innerHTML = stillSimulacrum(im, [160, 160], Object.assign(stillOptions(), { seed: 5 })).svg;
        chosen.hidden = false;
        const copy = 'a jpeg copy of ' + size(up.original.size) + ' goes in its place.';
        say('this is how it will appear. the original goes with it, a click away' + (!up.resized ? '.'
          : up.why === 'kind' ? ': the board does not keep ' + (up.kind || 'this kind of image') + ', so ' + copy
          : up.why === 'bytes' ? ': at ' + size(up.from) + ' it is more than the board takes (' + size(limits.original.bytes) + '), so ' + copy
          : ': it has more than ' + Math.round(limits.original.pixels / 1e6) + ' megapixels, so ' + copy));
      } catch (e) {
        if (preparing !== mine) return;
        /* a picture chosen before stays chosen; the words say why this one could not be */
        refuse(e && e.code ? e : refusal('image_unreadable'));
      } finally { if (preparing === mine) preparing = null; }
    })();
  });
  form.querySelector('.rm').addEventListener('click', () => {
    picked = null; preparing = null; chosen.hidden = true; pv.innerHTML = ''; say('');
    form.querySelector('.attach').focus();
  });

  /* ---------- sending ---------- */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    busy = true; send.disabled = true; retry.hidden = true;
    try {
      if (preparing) { say('one moment: the picture is still turning into fog…'); await preparing; }
      const words = normalized(ta.value);
      const n = Array.from(words).length, lines = words ? words.split('\n').length : 0;
      if (!words.trim() && !(thread && picked)) throw refusal('text_required');
      if (n > limits.text.chars) throw refusal('text_long', { n, limit: limits.text.chars });
      if (lines > limits.text.lines) throw refusal('text_lines', { n: lines, limit: limits.text.lines });
      let token = '';
      if (api.turnstile) { say('a quick check that keeps robots out…'); token = await tsToken(); }
      say('sending…');
      const r = await api.post({ thread, text: ta.value.replace(/\s+$/, ''), image: picked, turnstile: token });
      ta.value = ''; counted(); picked = null; chosen.hidden = true; pv.innerHTML = '';
      say(api.preview ? (api.persisted ? 'kept on this device.' : 'kept for this visit only: this browser will not store it.') : 'posted.');
      onPosted(r);
    } catch (err) {
      /* the words and the picture stay where they are */
      refuse(err);
      if (err && /^text_/.test(err.code)) ta.focus();
    } finally {
      busy = false; send.disabled = false;
      if (api.turnstile) tsRenew();
    }
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
