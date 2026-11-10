/* content: where the posts come from when the content service answers. The build writes the API's base URL here
   (build.py --content-api URL, or APHESIS_CONTENT_API); without one, the page keeps the posts it was built with. */

export const CONTENT_API = /*__CONTENT_API__*/'';

/* the published posts, or null when the service is not set, does not answer in time, or answers with nothing */
export async function fetchPosts(timeout = 6000) {
  if (!CONTENT_API) return null;
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const t = setTimeout(() => ctl && ctl.abort(), timeout);
  try {
    const r = await fetch(CONTENT_API.replace(/\/+$/, '') + '/v1/posts', { signal: ctl && ctl.signal, credentials: 'omit' });
    if (!r.ok) return null;
    const data = await r.json();
    return Array.isArray(data.posts) && data.posts.length ? data.posts : null;
  } catch (_) {
    return null;
  } finally {
    clearTimeout(t);
  }
}
