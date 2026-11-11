/* refusal: why a post did not go, as a code the page acts on and words that say it.

   The Worker answers every refusal with {error, code, limit?, retryAfter?}: the words as before, a code that never
   changes, the limit that was passed (bytes, characters, lines or pixels) and, for the rate limit, the seconds to
   wait (in the body: a page on another origin cannot read Retry-After). The page makes the same refusals itself
   before sending what it can already judge (the words, the image), and for what only happens on the way (no
   network, a check that never finished). explain() turns any of them into one line in the form's own voice.

   LIMITS: what the board takes, as its pages say (`limits` on GET /api/board); these are the current backend's,
   kept for a Worker that says nothing. */

export const LIMITS = {
  request: 6 * 1024 * 1024,
  original: { bytes: 4 * 1024 * 1024, pixels: 40e6 },
  density: { long: 960, bytes: 900 * 1024 },
  text: { chars: 2000, lines: 60 },
};

/* a board's own limits over the defaults, each read only when it is a sensible number */
export function boardLimits(l) {
  const n = (v, min, d) => (Number.isFinite(+v) && +v >= min ? +v : d);
  const o = (l && l.original) || {}, d = (l && l.density) || {}, t = (l && l.text) || {};
  return {
    request: n(l && l.request, 1024 * 1024, LIMITS.request),
    original: { bytes: n(o.bytes, 256 * 1024, LIMITS.original.bytes), pixels: n(o.pixels, 1e6, LIMITS.original.pixels) },
    density: { long: Math.min(n(d.long, 480, LIMITS.density.long), 2048), bytes: n(d.bytes, 100 * 1024, LIMITS.density.bytes) },
    text: { chars: n(t.chars, 1, LIMITS.text.chars), lines: n(t.lines, 1, LIMITS.text.lines) },
  };
}

/* an Error that carries its code (and whatever else explains it: limit, retryAfter, status, kind, n) */
export function refusal(code, more = {}, words = '') {
  return Object.assign(new Error(words || code), { code }, more);
}

/* a refusal from the Worker's answer; an answer from before the codes is read by its status and words */
export function fromAnswer(status, body) {
  const b = body && typeof body === 'object' ? body : {};
  let code = typeof b.code === 'string' ? b.code : '';
  let retryAfter = Number.isFinite(+b.retryAfter) ? +b.retryAfter : null;
  if (!code) {
    const w = String(b.error || '');
    if (status === 429) { code = 'rate'; const m = w.match(/(\d+)\s*s\b/); if (m) retryAfter = +m[1]; }
    else if (status === 413) code = 'too_large';
    else if (status === 403 && /check/.test(w)) code = 'turnstile';
    else if (status === 404) code = 'thread_gone';
    else if (status === 409 && /full/.test(w)) code = 'thread_full';
    else if (status >= 500) code = 'stumbled';
    else if (/up to \d+ mb/.test(w)) code = 'image_too_large';
    else if (/only jpeg/.test(w)) code = 'image_type';
    else if (/could not be read/.test(w)) code = 'image_unreadable';
    else if (/needs words/.test(w)) code = 'text_required';
    else if (/characters/.test(w)) code = 'text_long';
    else if (/lines/.test(w)) code = 'text_lines';
    else code = 'refused';
  }
  return refusal(code, { status, limit: Number.isFinite(+b.limit) ? +b.limit : undefined, retryAfter }, String(b.error || code));
}

/* 4194304 -> "4 mb", 921600 -> "900 kb" */
export function size(bytes) {
  if (bytes >= 1024 * 1024) { const m = bytes / (1024 * 1024); return (m >= 10 || Number.isInteger(m) ? Math.round(m) : m.toFixed(1)) + ' mb'; }
  return Math.max(1, Math.round(bytes / 1024)) + ' kb';
}
const mp = (px) => Math.round(px / 1e6) + ' megapixels';

/* the words, and what the form offers with them: retry (send again as it is) or nothing */
export function explain(err, limits = LIMITS, { thread = null } = {}) {
  const e = err || {}, L = limits, code = e.code || (e.name === 'TypeError' ? 'network' : 'refused');
  const lim = (d) => (Number.isFinite(e.limit) ? e.limit : d);
  switch (code) {
    case 'too_large':
      return { text: 'too large to send: the board takes ' + size(lim(L.request)) + ' at most for a post, the image and its fog together.' };
    case 'image_too_large':
      return { text: 'this image is over ' + size(lim(L.original.bytes)) + ', the most the board takes, and it could not be made smaller here. try a smaller one.' };
    case 'image_pixels':
      return { text: 'this image is over ' + mp(lim(L.original.pixels)) + ', the most the board takes, and it could not be made smaller here. try a smaller one.' };
    case 'image_type':
      return { text: (e.kind ? e.kind + ' images cannot be opened here' : 'this kind of image cannot be opened here') + '. the board takes jpeg, png, webp or gif.' };
    case 'image_unreadable':
      return { text: 'this image could not be read. it may be damaged, or only partly downloaded. try another.' };
    case 'map_missing': case 'map_too_large': case 'map_type': case 'map_unreadable': case 'map_size': case 'map_orphan':
      return { text: 'the fog for this image could not be made to fit' + (code === 'map_too_large' ? ' (' + size(lim(L.density.bytes)) + ' at most)' : '') + '. remove the image and add it again, or try another.' };
    case 'text_required':
      return { text: thread ? 'write something, or add an image.' : 'a thread begins with words.' };
    case 'text_long':
      return { text: 'too long: ' + lim(L.text.chars) + ' characters at most' + (e.n ? ', and this has ' + e.n : '') + '.' };
    case 'text_lines':
      return { text: 'too long: ' + lim(L.text.lines) + ' lines at most' + (e.n ? ', and this has ' + e.n : '') + '.' };
    case 'turnstile':
      return { text: 'the check that keeps robots out did not pass, or it ran out of time.', retry: true };
    case 'turnstile_load':
      return { text: 'the check that keeps robots out did not load, so nothing was sent.', retry: true };
    case 'rate': {
      const s = Math.max(1, Math.ceil(e.retryAfter || 30));
      return { text: 'too fast: the board takes a few posts at a time. try again in ' + s + ' s.', wait: s };
    }
    case 'word':
      return { text: 'the board will not carry that word.' };
    case 'thread_full':
      return { text: 'this thread is full at ' + lim(500) + ' posts. start a new one from the board.' };
    case 'thread_gone':
      return { text: 'this thread is gone.' };
    case 'not_open':
      return { text: 'the board is not open yet. try again later.' };
    case 'origin':
      return { text: 'the board does not answer this page. open aphes.ist and post from there.' };
    case 'network':
      return { text: 'the board could not be reached, so nothing was sent. check the connection, then try again.', retry: true };
    case 'stumbled':
      return { text: 'the board stumbled on its side, and the post did not go. try again in a moment.', retry: true };
    default:
      return { text: (e.status >= 500 ? 'the board stumbled on its side, and the post did not go. try again in a moment.' : String(e.message || 'the post did not go.').toLowerCase()), retry: e.status >= 500 };
  }
}
