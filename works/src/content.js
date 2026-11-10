/* content: where the works come from when the content service answers. The build writes the API's base URL here
   (build.py --content-api URL, or APHESIS_CONTENT_API); without one, the page keeps the works it was built with.
   A work from the API has the fields of content/works.json; its map is loaded here into a canvas, the form the
   simulacrum takes reliably on every GPU, from the API's own picture URL. */

export const CONTENT_API = /*__CONTENT_API__*/'';

function load(url) {
  return new Promise((resolve) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';   /* the content API serves its pictures with CORS */
    im.onload = () => { const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0); resolve(c); };
    im.onerror = () => resolve(null);
    im.src = url;
  });
}

/* {works, maps} or null when the service is not set, slow or empty (the page waits at most `timeout` ms) */
export async function fetchWorks(timeout = 3000) {
  if (!CONTENT_API) return null;
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const t = setTimeout(() => ctl && ctl.abort(), timeout);
  try {
    const r = await fetch(CONTENT_API.replace(/\/+$/, '') + '/v1/works', { signal: ctl && ctl.signal, credentials: 'omit' });
    if (!r.ok) return null;
    const data = await r.json();
    if (!Array.isArray(data.works) || !data.works.length) return null;
    const works = data.works.map((w) => ({ id: w.id, name: w.name, gloss: w.gloss, gloss_tip: w.gloss_tip, year: w.year, role: w.role,
      description: w.description, links: w.links || [], map: { file: w.map.url, caption: w.map.caption, settings: w.map.settings || {} } }));
    const canvases = await Promise.all(works.map((w) => load(w.map.file)));
    const maps = {};
    works.forEach((w, i) => { if (canvases[i]) maps[w.id] = canvases[i]; });
    return { works, maps };
  } catch (_) {
    return null;
  } finally {
    clearTimeout(t);
  }
}
