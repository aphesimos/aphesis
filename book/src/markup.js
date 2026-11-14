/* markup: a note's markdown, in the browser. The same small subset the archive writes its posts in, and the same
   converter: inline (code, links, strong, em) and small_markdown (paragraphs, > quotes, - and 1. lists) are archive's
   render.js, line for line, without what a note has no use for (headings, fenced code, footnotes, figures: a heading
   or a fence typed here shows as the words it is). The desk edits a note with the same editor as an archive post and
   previews it with this module, so what the owner sees is what the book sets. A note with no markup in it comes out
   as its paragraphs, as before. tools/markup-parity.mjs proves it against the archive's render.js.

   A note is the book's `note`: an array of paragraphs (a blank line between them in the text). Inside one paragraph a
   line break stays, so a list or a quote can be written; a paragraph's lines are joined with a space, as the archive
   joins them. */

/* html.escape(s, quote=True) */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

/* Python's \w, for the patterns that use it */
const W = '\\p{L}\\p{N}_';

/* a link goes only where a page can safely follow it: a web or mail address, a #place, or a relative path */
const safeHref = (h) => /^(https?:\/\/|mailto:|#|\/|\.\.?\/)/i.test(h) || !/^[a-z][a-z0-9+.-]*:/i.test(h);

function inline(s) {
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push('<code>' + esc(c) + '</code>'); return '\x00' + (codes.length - 1) + '\x00'; });
  s = esc(s);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, h) => (safeHref(h) ? '<a href="' + h + '">' + t + '</a>' : m));
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(new RegExp('(?<![' + W + '*])\\*([^*]+)\\*(?![' + W + '*])', 'gu'), '<em>$1</em>');
  s = s.replace(new RegExp('(?<![' + W + '_])_([^_]+)_(?![' + W + '_])', 'gu'), '<em>$1</em>');
  return s.replace(/\x00(\d+)\x00/g, (_, i) => codes[+i]);
}

const LIST = /^(\s*[-*]|\s*\d+\.)\s+/;
const PARA_STOP = /^(>|\s*[-*]\s|\s*\d+\.\s)/;
const pyStrip = (s) => s.replace(/^\s+|\s+$/g, '');

function blocks(src) {
  const out = [], lines = src.split('\n');
  let i = 0;
  while (i < lines.length) {
    const ln = lines[i];
    if (!pyStrip(ln)) { i++; continue; }
    if (ln.startsWith('>')) {
      const block = [];
      while (i < lines.length && lines[i].startsWith('>')) { block.push(lines[i].replace(/^>\s?/, '')); i++; }
      out.push('<blockquote>' + blocks(block.join('\n')) + '</blockquote>');
      continue;
    }
    if (LIST.test(ln)) {
      const tag = /^\s*\d+\./.test(ln) ? 'ol' : 'ul';
      const items = [];
      while (i < lines.length && LIST.test(lines[i])) { items.push('<li>' + inline(lines[i].replace(LIST, '')) + '</li>'); i++; }
      out.push(`<${tag}>` + items.join('') + `</${tag}>`);
      continue;
    }
    const para = [];
    while (i < lines.length && pyStrip(lines[i]) && !PARA_STOP.test(lines[i])) { para.push(pyStrip(lines[i])); i++; }
    out.push('<p>' + inline(para.join(' ')) + '</p>');
  }
  return out.join('\n');
}

/* a note (an array of paragraphs, or the text) -> markup */
export function noteHtml(note) {
  const text = Array.isArray(note) ? note.join('\n\n') : String(note || '');
  return blocks(text);
}
