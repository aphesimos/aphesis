/* The Pages worker (advanced mode, dist/_worker.js): the link preview's words, live from the dashboard.

   Crawlers (discord, imessage, whatsapp, slack, x) read the served HTML and run no script, so the owner's
   meta.title and meta.description have to be in the page as it leaves Cloudflare. For `/` only (site/public/_routes.json;
   every other path is a static file and never reaches this), the worker asks the content service for the site's texts
   (`GET /v1/texts`, which answers only the keys the owner changed), keeps that answer in the Cache API for five
   minutes, and writes the two keys over the og: tags and the meta description with HTMLRewriter. A key that is not set,
   a service that is down, slow (1.5 s) or answers nonsense: the page goes out exactly as built, with the defaults in
   src/shell.html. A failed answer is kept for a minute, so an outage costs one slow request a minute, not one per visit.

   Written by site/build.py --worker FILE, which fills in the content service's address. */

const API = /*__CONTENTAPI__*/;
const TTL = 300;          // seconds the texts are kept, per Cloudflare location
const TTL_FAILED = 60;    // seconds a failed answer is kept
const WAIT = 1500;        // ms the content service has to answer

/* what _headers gives `/` (and every path), set here as well: a response a worker makes is not bound to take them */
const HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-Frame-Options': 'SAMEORIGIN',
  'Cache-Control': 'public, max-age=0, must-revalidate',
};

/* the owner's words for the preview, {title?, description?}: only keys set to a non-empty line */
function pick(data) {
  const t = (data && typeof data.texts === 'object' && data.texts) || {};
  const out = {};
  for (const [k, name] of [['meta.title', 'title'], ['meta.description', 'description']]) {
    if (typeof t[k] === 'string' && t[k].trim()) out[name] = t[k].trim();
  }
  return out;
}

async function texts(request, ctx) {
  if (!API) return {};
  const cache = caches.default;
  const key = new Request(new URL('/__aph/preview-texts', request.url).toString());
  const hit = await cache.match(key).catch(() => null);
  if (hit) return hit.json().catch(() => ({}));
  let words = {}, ttl = TTL_FAILED;
  try {
    const r = await fetch(API + '/v1/texts', { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(WAIT) });
    if (r.ok) { words = pick(await r.json()); ttl = TTL; }
  } catch (_) { /* down, slow or not json: the built defaults */ }
  const keep = new Response(JSON.stringify(words), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=' + ttl } });
  ctx.waitUntil(cache.put(key, keep).catch(() => {}));
  return words;
}

/* a short, stable tag for the words, so the page's ETag changes with them */
function tagOf(words) {
  const s = (words.title || '') + '\u0000' + (words.description || '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/* the tag written whole, escaped here, so the result does not hang on how the runtime escapes an attribute */
const esc = (v) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function content(attr, name, value) {
  return { element(el) { el.replace(`<meta ${attr}="${name}" content="${esc(value)}">`, { html: true }); } };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname !== '/' || (request.method !== 'GET' && request.method !== 'HEAD')) return env.ASSETS.fetch(request);
    const words = await texts(request, ctx);
    if (!words.title && !words.description) return env.ASSETS.fetch(request);

    /* the page as built, always whole (the If-None-Match below is answered against the rewritten page's own tag) */
    const plain = new Headers(request.headers);
    plain.delete('If-None-Match'); plain.delete('If-Modified-Since');
    const page = await env.ASSETS.fetch(new Request(request.url, { method: request.method, headers: plain }));
    if (page.status !== 200 || !(page.headers.get('Content-Type') || '').includes('text/html')) return page;

    const etag = '"' + (page.headers.get('ETag') || '').replace(/^W\//, '').replace(/"/g, '') + '-m' + tagOf(words) + '"';
    const headers = new Headers(page.headers);
    for (const [k, v] of Object.entries(HEADERS)) headers.set(k, v);
    headers.set('ETag', etag);
    headers.delete('Content-Length');
    const seen = (request.headers.get('If-None-Match') || '').split(',').map((s) => s.trim().replace(/^W\//, ''));
    if (seen.includes(etag)) return new Response(null, { status: 304, headers });
    if (request.method === 'HEAD') return new Response(null, { status: 200, headers });

    let rw = new HTMLRewriter();
    if (words.title) rw = rw.on('meta[property="og:title"]', content('property', 'og:title', words.title));
    if (words.description) {
      rw = rw.on('meta[property="og:description"]', content('property', 'og:description', words.description))
        .on('meta[name="description"]', content('name', 'description', words.description));
    }
    return rw.transform(new Response(page.body, { status: 200, headers }));
  },
};
