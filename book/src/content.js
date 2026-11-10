/* content: where the entries come from when the content service answers. The build writes the API's base URL here
   (build.py --content-api URL, or APHESIS_CONTENT_API); without one, the page keeps the entries it was built with.
   An entry from the API is shaped as the build shapes content/*.md, its map a URL instead of a file name. */

export const CONTENT_API = /*__CONTENT_API__*/'';

/* the published entries in their order, or null when the service is not set, slow or empty (the book waits for
   it at most `timeout` ms before it opens on its own entries) */
export async function fetchEntries(timeout = 3000) {
  if (!CONTENT_API) return null;
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const t = setTimeout(() => ctl && ctl.abort(), timeout);
  try {
    const r = await fetch(CONTENT_API.replace(/\/+$/, '') + '/v1/books', { signal: ctl && ctl.signal, credentials: 'omit' });
    if (!r.ok) return null;
    const { books } = await r.json();
    if (!Array.isArray(books) || !books.length) return null;
    return books.map((b) => {
      const e = { slug: b.slug, title: b.title, author: b.author, year: b.year, map: b.picture.url, caption: b.caption,
        note: b.note, example: !!b.example };
      if (b.quote) Object.assign(e, { quote: b.quote, quote_lang: b.quote_lang, quote_en: b.quote_en });
      Object.assign(e, b.adjust || {});
      return e;
    });
  } catch (_) {
    return null;
  } finally {
    clearTimeout(t);
  }
}
