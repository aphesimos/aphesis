/* The Pages worker (advanced mode, dist/_worker.js): one public address, and the link preview's words, live from the
   dashboard.

   One address. The site answers only at https://aphes.ist. Every other host the project is reachable at (www.aphes.ist,
   aphesist.pages.dev, the preview and branch aliases <hash>.aphesist.pages.dev) gets a 301 to https://aphes.ist with
   the same path and query, before anything else; the fragment never leaves the browser and stays on its own. So the
   worker runs on every path (site/public/_routes.json includes /*): a route list cannot depend on the host, and a path
   left out would keep answering at every alias. On aphes.ist every path but `/` is a static file, handed to
   env.ASSETS.fetch and sent on with the headers of site/public/_headers set again here, so the lab kit keeps its CORS
   whichever way Pages treats _headers behind a worker. The redirect carries Access-Control-Allow-Origin: * as well:
   a cross-origin fetch checks CORS on the redirect itself before following it. localhost and 127.0.0.1 are served as
   aphes.ist, so `wrangler pages dev` shows the page; Cloudflare never routes those names to the project.

   The link preview. Crawlers (discord, imessage, whatsapp, slack, x) read the served HTML and run no script, so the
   owner's meta.title and meta.description have to be in the page as it leaves Cloudflare. For `/` only, the worker
   asks the content service for the site's texts (`GET /v1/texts`, which answers only the keys the owner changed),
   keeps that answer in the Cache API for five minutes, and writes the two keys over the og: tags and the meta
   description with HTMLRewriter. A key that is not set, a service that is down, slow (1.5 s) or answers nonsense: the
   page goes out exactly as built, with the defaults in src/shell.html. A failed answer is kept for a minute, so an
   outage costs one slow request a minute, not one per visit.

   Written by site/build.py --worker FILE, which fills in the content service's address. */

const API = /*__CONTENTAPI__*/;
const TTL = 300;          // seconds the texts are kept, per Cloudflare location
const TTL_FAILED = 60;    // seconds a failed answer is kept
const WAIT = 1500;        // ms the content service has to answer

const HOST = 'aphes.ist';                              // the one public address
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);  // wrangler pages dev, served as HOST

/* what site/public/_headers gives every path, `/` and the lab kit, set here as well: a response a worker makes is not
   bound to take them */
const SECURITY = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-Frame-Options': 'SAMEORIGIN',
};
const HEADERS = { ...SECURITY, 'Cache-Control': 'public, max-age=0, must-revalidate' };   // `/`
const LAB_KIT = {   // research viewers on other origins link it, and its fonts load only with CORS
  'Access-Control-Allow-Origin': '*',
  'Cross-Origin-Resource-Policy': 'cross-origin',
  'Cache-Control': 'public, max-age=3600',
};

/* any other host: the same path and query at https://aphes.ist, for good */
function away(url) {
  return new Response(null, {
    status: 301,
    headers: {
      Location: 'https://' + HOST + url.pathname + url.search,
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      ...SECURITY,
    },
  });
}

/* a static file as Pages serves it, with _headers' rules for its path set on it */
function dress(res, path) {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(SECURITY)) headers.set(k, v);
  if (path === '/') headers.set('Cache-Control', HEADERS['Cache-Control']);
  if (path.startsWith('/lab-kit/')) for (const [k, v] of Object.entries(LAB_KIT)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

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

/* `/` with the owner's words over the built defaults, or null when there are none to write */
async function preview(request, env, ctx) {
  const words = await texts(request, ctx);
  if (!words.title && !words.description) return null;

  /* the page as built, always whole (the If-None-Match below is answered against the rewritten page's own tag) */
  const plain = new Headers(request.headers);
  plain.delete('If-None-Match'); plain.delete('If-Modified-Since');
  const page = await env.ASSETS.fetch(new Request(request.url, { method: request.method, headers: plain }));
  if (page.status !== 200 || !(page.headers.get('Content-Type') || '').includes('text/html')) return dress(page, '/');

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
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.hostname !== HOST && !LOOPBACK.has(url.hostname)) return away(url);
    if (url.pathname === '/' && (request.method === 'GET' || request.method === 'HEAD')) {
      const page = await preview(request, env, ctx);
      if (page) return page;
    }
    return dress(await env.ASSETS.fetch(request), url.pathname);
  },
};
