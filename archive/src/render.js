/* render: the archive's markup from a post's data, in the browser. A port, line for line, of build.py's converter
   (small_markdown, inline, convert) and of its list and post markup, so a post that comes from the content API,
   or the dashboard's live preview, is the same markup the build writes. tools/render-parity.mjs proves it on every
   post in content/.

   A post is {slug, title, summary, stage, date, body, notes: [{id, text}], figures: [{name, url}]}:
   the body without its notes, the notes apart (as the content service keeps them), and the URL of each figure's
   density map. A figure the post does not list falls back to the build's own maps (data-map only). */

export const STAGES = ['nigredo', 'albedo', 'citrinitas', 'rubedo'];
export const STAGE_TIPS = {
  nigredo: 'nigredo · the black: barely begun',
  albedo: 'albedo · the white: taking shape',
  citrinitas: 'citrinitas · the yellow: nearly there',
  rubedo: 'rubedo · the red: finished',
};
export const LEDE = 'writing about anything, from draft to finished.';
export const EMPTY = 'the scraped tablet: nothing on it, everything possible.';
/* the site's texts: the owner's version of a line where the site has one (the shell's Aphesis.text), else this one.
   The markup also names its key (data-text, data-text-tip), as build.py writes it. */
const T = (key, own) => { const A = typeof window !== 'undefined' && window.Aphesis; return A && A.text ? A.text(key, own) : own; };
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/* html.escape(s, quote=True) */
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
/* html.unescape, for the entities a note can hold */
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…', middot: '·' };
const unesc = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
  return NAMED[e.toLowerCase()] !== undefined ? NAMED[e.toLowerCase()] : m;
});

/* Python's \w, for the patterns that use it */
const W = '\\p{L}\\p{N}_';

/* markdown inline: code, links, strong, em, footnote markers. Text is escaped first. */
function inline(s, notes) {
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push('<code>' + esc(c) + '</code>'); return '\x00' + (codes.length - 1) + '\x00'; });
  s = esc(s);
  s = s.replace(new RegExp('\\[\\^([' + W + '-]+)\\]', 'gu'), (_, k) => notes(k));
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, h) => '<a href="' + h + '">' + t + '</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(new RegExp('(?<![' + W + '*])\\*([^*]+)\\*(?![' + W + '*])', 'gu'), '<em>$1</em>');
  s = s.replace(new RegExp('(?<![' + W + '_])_([^_]+)_(?![' + W + '_])', 'gu'), '<em>$1</em>');
  return s.replace(/\x00(\d+)\x00/g, (_, i) => codes[+i]);
}

const LIST = /^(\s*[-*]|\s*\d+\.)\s+/;
const PARA_STOP = /^(```|#{2,4}\s|>|\x01|\s*[-*]\s|\s*\d+\.\s)/;
const pyStrip = (s) => s.replace(/^\s+|\s+$/g, '');

/* the subset the posts use: ## and ### headings, paragraphs, > quotes, fenced code, - and 1. lists */
function smallMarkdown(src, notes) {
  const out = [], lines = src.split('\n');
  let i = 0;
  while (i < lines.length) {
    const ln = lines[i];
    if (!pyStrip(ln)) { i++; continue; }
    if (ln.startsWith('```')) {
      let j = i + 1;
      while (j < lines.length && !lines[j].startsWith('```')) j++;
      out.push('<pre><code>' + esc(lines.slice(i + 1, j).join('\n')) + '</code></pre>');
      i = j + 1; continue;
    }
    const m = ln.match(/^(#{2,4})\s+(.*)$/);
    if (m) { const n = m[1].length; out.push(`<h${n}>${inline(m[2], notes)}</h${n}>`); i++; continue; }
    if (ln.startsWith('\x01')) { out.push(ln); i++; continue; }
    if (ln.startsWith('>')) {
      const block = [];
      while (i < lines.length && lines[i].startsWith('>')) { block.push(lines[i].replace(/^>\s?/, '')); i++; }
      out.push('<blockquote>' + smallMarkdown(block.join('\n'), notes) + '</blockquote>');
      continue;
    }
    if (LIST.test(ln)) {
      const tag = /^\s*\d+\./.test(ln) ? 'ol' : 'ul';
      const items = [];
      while (i < lines.length && LIST.test(lines[i])) { items.push('<li>' + inline(lines[i].replace(LIST, ''), notes) + '</li>'); i++; }
      out.push(`<${tag}>` + items.join('') + `</${tag}>`);
      continue;
    }
    const para = [];
    while (i < lines.length && pyStrip(lines[i]) && !PARA_STOP.test(lines[i])) { para.push(pyStrip(lines[i])); i++; }
    out.push('<p>' + inline(para.join(' '), notes) + '</p>');
  }
  return out.join('\n');
}

/* a post's body and notes -> {html, notes, maps, errors}. Errors are what the build would stop on (a marker with
   no note, a figure with no map); here the marker shows as typed, so a preview still renders while it is written. */
export function convert(slug, body, noteList = [], figureList = [], known = null) {
  const defs = {};
  (noteList || []).forEach((n) => { defs[n.id] = String(n.text).trim(); });
  /* definitions written into the body (as in content/*.md) count too, and leave the body as the build leaves it */
  body = String(body || '').replace(new RegExp('^\\[\\^([' + W + '-]+)\\]:\\s*(.+(?:\\n(?!\\n|\\[\\^).+)*)', 'gmu'), (_, k, t) => { defs[k] = pyStrip(t); return ''; });
  const order = [], maps = [], figures = [], errors = [];
  const urls = {};
  (figureList || []).forEach((f) => { if (f && f.name) urls[f.name] = f.url || ''; });
  body = body.replace(new RegExp('^!\\[([^\\]]*)\\]\\(simulacrum:([' + W + '-]+)\\)\\s*$', 'gmu'), (_, cap, name) => {
    if (!(name in urls) && known && !known.includes(name)) errors.push(`unknown simulacrum map ${name}`);
    if (!maps.includes(name)) maps.push(name);
    const src = urls[name] ? ` data-src="${esc(urls[name])}"` : '';
    figures.push(`<figure class="sim" data-map="${name}"${src}><div class="sim-box"></div>` +
      `<figcaption class="aph-meta aph-on-fog">${esc(cap)}</figcaption></figure>`);
    return '\x01FIG' + (figures.length - 1) + '\x01';
  });
  const notePlain = (text) => inline(text, () => '').replace(/<[^>]+>/g, '');
  const marker = (key) => {
    if (!(key in defs)) { errors.push(`footnote [^${key}] has no text`); return esc('[^' + key + ']'); }
    if (!order.includes(key)) order.push(key);
    const n = order.indexOf(key) + 1;
    return `<sup class="fn"><button type="button" class="fn-mark" id="fnref-${slug}-${n}" ` +
      `aria-describedby="fn-${slug}-${n}" aria-label="note ${n}" data-cursor=".55" ` +
      `data-note="${esc(unesc(notePlain(defs[key])))}">${n}</button></sup>`;
  };
  let out = smallMarkdown(pyStrip(body), marker);
  out = out.replace(/\x01FIG(\d+)\x01/g, (_, i) => figures[+i]);
  out = out.replace(/<p>(—|&mdash;)\s*/g, '<p class="cite">— ');
  let notes = '';
  if (order.length) {
    const items = order.map((k, i) => {
      const n = i + 1;
      return `<li id="fn-${slug}-${n}">${inline(defs[k], () => '')} ` +
        `<a class="fn-back" href="#fnref-${slug}-${n}" data-fnref="fnref-${slug}-${n}" aria-label="back to the text">↑</a></li>`;
    }).join('');
    notes = `<section class="notes" aria-label="notes"><ol>${items}</ol></section>`;
  }
  return { html: out, notes, maps, errors };
}

export function dateText(d) {
  const [y, m, day] = String(d).split('-').map(Number);
  return `${day} ${MONTHS[m - 1]} ${y}`;
}

/* ---------- markup ---------- */
function stageIconSpan(stage, cls = '') {
  return `<span class="stage-icon ${cls}" data-stage="${stage}" data-tip="${esc(T('archive.stage.' + stage, STAGE_TIPS[stage]))}" ` +
    `data-text-tip="archive.stage.${stage}" aria-hidden="true"></span>`;
}
function metaLine(p) {
  return `<time datetime="${p.date}">${dateText(p.date)}</time>`;
}

export function listHtml(posts) {
  const items = posts.map((p) =>
    `<li class="entry" data-stage="${p.stage}">` +
    `<a class="entry-link" href="#${p.slug}" data-slug="${p.slug}">` +
    stageIconSpan(p.stage) +
    `<span class="entry-main"><span class="entry-title"><span class="entry-name">${esc(p.title)}</span><span class="uline" aria-hidden="true"></span></span>` +
    `<span class="entry-summary">${esc(p.summary)}</span></span>` +
    `<span class="entry-meta"><span class="aph-gloss entry-stage" lang="la">${p.stage}</span>` +
    `<span class="aph-meta">${metaLine(p)}</span></span>` +
    '</a></li>');
  const legend = STAGES.map((s) => `<li>${stageIconSpan(s, 'small')}<span class="aph-gloss" lang="la">${s}</span></li>`).join('');
  /* with no posts the codex is a scraped tablet: the nigredo's sediment and one gloss, no legend, no empty list */
  const stages = items.length ? `<ol class="stages" aria-label="from draft to finished: nigredo, albedo, citrinitas, rubedo">${legend}</ol>` : '';
  const entries = items.length ? `<ol class="entries">${items.join('')}</ol>` :
    `<p class="blank">${stageIconSpan('nigredo')}<span class="aph-gloss" lang="la">tabula rasa</span>` +
    `<span class="aph-meta" data-text="archive.empty">${esc(T('archive.empty', EMPTY))}</span></p>`;
  return '<section class="view list" data-view="list" aria-labelledby="codex-title">' +
    '<div class="col">' +
    '<header class="head">' +
    '<p class="gloss-title aph-gloss" lang="la">codex</p>' +
    '<h1 id="codex-title" class="title aph-display" tabindex="-1">archive</h1>' +
    `<p class="lede" data-text="archive.lede">${esc(T('archive.lede', LEDE))}</p>` +
    stages +
    '</header>' +
    entries +
    '<footer class="foot"><span class="rule" aria-hidden="true"></span>' +
    '<a class="feed aph-label" href="feed.xml" type="application/atom+xml">feed</a>' +
    '<span class="aph-meta">atom · every post, from nigredo to rubedo</span></footer>' +
    '</div></section>';
}

function backLink(where) {
  return `<a class="back ${where}" href="#archive" aria-label="back to the archive" ` +
    'data-tip="back to the archive · esc"><span class="back-mark" aria-hidden="true"></span>' +
    '<span class="aph-label" aria-hidden="true">archive</span></a>';
}

/* one post as the build writes it; rendered is convert()'s result */
export function postHtml(p, rendered) {
  const r = rendered || convert(p.slug, p.body, p.notes, p.figures);
  return `<article class="view post" data-view="post" data-slug="${p.slug}" aria-labelledby="t-${p.slug}" hidden>` +
    '<div class="col">' +
    `<nav class="back-row" aria-label="archive">${backLink('top')}</nav>` +
    '<header class="post-head">' +
    `<p class="post-stage">${stageIconSpan(p.stage)}<span class="aph-gloss" lang="la">${p.stage}</span>` +
    `<span class="aph-meta">${metaLine(p)}</span></p>` +
    `<h1 id="t-${p.slug}" class="post-title aph-display" tabindex="-1">${esc(p.title)}</h1>` +
    `<p class="lede">${esc(p.summary)}</p>` +
    '</header>' +
    `<div class="prose">${r.html}</div>` +
    `${r.notes}` +
    `<footer class="post-foot">${backLink('bottom')}</footer>` +
    '</div></article>';
}

/* the posts in the build's order: newest first, then by slug */
export function sortPosts(posts) {
  return posts.slice().sort((a, b) => (a.date === b.date ? (a.slug < b.slug ? 1 : a.slug > b.slug ? -1 : 0) : a.date < b.date ? 1 : -1));
}
