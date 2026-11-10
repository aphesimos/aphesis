/* text: a post's words as safe markup. Everything is escaped; the only markup made is
   - >>n, a reference to post n in the same thread (a link that previews the post and leads to it);
   - a line starting with a single >, a quoted line, set in ink-soft.
   Nothing else is interpreted: no links, no formatting. */

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

export const REF = />>(\d{1,6})/g;

/* the post numbers a text refers to, in order, without repeats */
export function refs(text) {
  const out = [];
  for (const m of String(text).matchAll(REF)) { const n = +m[1]; if (!out.includes(n)) out.push(n); }
  return out;
}

export function render(text, thread) {
  return String(text).split('\n').map((line) => {
    const quoted = /^>(?!>\d)/.test(line);
    const html = esc(line).replace(/&gt;&gt;(\d{1,6})/g, (_, n) =>
      '<a class="ref" href="#forum/' + esc(thread) + '/' + n + '" data-ref="' + n + '">&gt;&gt;' + n + '</a>');
    return quoted ? '<span class="q">' + html + '</span>' : html;
  }).join('<br>');
}

/* the first line worth showing in a list: no bare references, at most max characters */
export function firstLine(text, max = 96) {
  const lines = String(text).split('\n').map((l) => l.replace(REF, '').trim()).filter(Boolean);
  const l = lines[0] || '';
  return l.length > max ? l.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : l;
}

/* how long ago, in words: just now, 4 min, 3 h, 2 days, 5 weeks, 1 year */
export function age(ts, now = Date.now()) {
  const s = Math.max(0, (now - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min';
  if (s < 86400) return Math.floor(s / 3600) + ' h';
  const d = Math.floor(s / 86400);
  if (d < 14) return d + (d === 1 ? ' day' : ' days');
  if (d < 365) return Math.floor(d / 7) + ' weeks';
  const y = Math.floor(d / 365);
  return y + (y === 1 ? ' year' : ' years');
}
