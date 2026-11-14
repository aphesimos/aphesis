/* md-editor: the one editor for every prose field on the desk (an archive post's body, a book entry's note). It is
   Obsidian's way of writing in the site's idiom: the markdown stays text, and is styled as it is typed.

   How it is made. A plain <textarea> sits, transparent, over a <pre> that holds the same text in colour: the pre is
   what is seen, the textarea is what is typed in. That keeps everything the browser does for a textarea (undo, redo,
   IME, spellcheck, selection, the caret, the phone's keyboard) and costs only one rule: the two must lay out
   identically, so nothing the pre does may change a glyph's width. Marks are dimmed, *em* is slanted, **strong** is
   struck twice, quotes and lists have their own colour; a size or a weight would move the text and is never used. The pre
   is in the flow and sets the height, the textarea is laid over it, so there is nothing to keep in step by script.

   Every edit goes through edit(): execCommand('insertText') where the browser has it, so a shortcut is one step of
   the native undo, and a value set with its input event where it does not.

   Shortcuts (⌘ on a Mac, ctrl elsewhere): mod+i italic, mod+b strong, mod+e code, mod+k link, mod+shift+. quote,
   mod+shift+8 list, mod+shift+7 numbered list, mod+alt+2 and 3 heading. Enter continues a list or a quote and
   ends it on an empty item; Tab and shift+Tab indent and outdent a list item; Backspace right after a marker
   takes the marker; * _ ` [ ( around a selection wrap it; a pasted address over a selection makes a link.

   Only what the archive's renderer (render.js: small_markdown and inline) understands is ever written. The book's
   note is the same subset without headings, notes and figures (`tools`). */

import { h, act, rule } from './ui.js';

const MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
export const MOD = MAC ? '⌘' : 'ctrl';
let seed = 0;

/* ---------- what the pre shows ---------- */
const W = '\\p{L}\\p{N}_';
const MK = 1, CODE = 2, STRONG = 4, EM = 8, LINK = 16, URL_ = 32, FN = 64;
const CLASSES = [[MK, 'm'], [CODE, 'c'], [STRONG, 's'], [EM, 'e'], [LINK, 'k'], [URL_, 'u'], [FN, 'f']];
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const LIST = /^(\s*[-*]|\s*\d+\.)\s+/;

/* the inline marks of a line, one flag word per character; the same patterns, in the same order, as render.js */
function flagsOf(s, base) {
  const f = new Uint8Array(s.length).fill(base);
  let m = s;
  const hide = (a, b) => { m = m.slice(0, a) + '\x00'.repeat(b - a) + m.slice(b); };
  const run = (re, fn) => { re.lastIndex = 0; let r; const hits = []; while ((r = re.exec(m))) hits.push(r); hits.forEach(fn); };
  run(/`([^`]+)`/g, (r) => { const a = r.index, b = a + r[0].length; f[a] |= MK; f[b - 1] |= MK; for (let i = a + 1; i < b - 1; i++) f[i] |= CODE; hide(a, b); });
  run(new RegExp('\\[\\^([' + W + '-]+)\\]', 'gu'), (r) => { const a = r.index, b = a + r[0].length; for (let i = a; i < b; i++) f[i] |= FN; f[a] |= MK; f[a + 1] |= MK; f[b - 1] |= MK; hide(a, b); });
  run(/\[([^\]]+)\]\(([^)\s]+)\)/g, (r) => {
    const a = r.index, t = r[1].length, u = r[2].length;
    f[a] |= MK; for (let i = a + 1; i < a + 1 + t; i++) f[i] |= LINK;
    const m2 = a + 1 + t; f[m2] |= MK; f[m2 + 1] |= MK;
    for (let i = m2 + 2; i < m2 + 2 + u; i++) f[i] |= URL_;
    f[m2 + 2 + u] |= MK;
    hide(m2, m2 + 3 + u);
  });
  run(/\*\*([^*]+)\*\*/g, (r) => { const a = r.index, b = a + r[0].length; f[a] |= MK; f[a + 1] |= MK; f[b - 1] |= MK; f[b - 2] |= MK; for (let i = a + 2; i < b - 2; i++) f[i] |= STRONG; hide(a, a + 2); hide(b - 2, b); });
  run(new RegExp('(?<![' + W + '*])\\*([^*]+)\\*(?![' + W + '*])', 'gu'), (r) => { const a = r.index, b = a + r[0].length; f[a] |= MK; f[b - 1] |= MK; for (let i = a + 1; i < b - 1; i++) f[i] |= EM; hide(a, a + 1); hide(b - 1, b); });
  run(new RegExp('(?<![' + W + '_])_([^_]+)_(?![' + W + '_])', 'gu'), (r) => { const a = r.index, b = a + r[0].length; f[a] |= MK; f[b - 1] |= MK; for (let i = a + 1; i < b - 1; i++) f[i] |= EM; hide(a, a + 1); hide(b - 1, b); });
  return f;
}

function spans(s, flags) {
  let out = '', i = 0;
  while (i < s.length) {
    let j = i + 1;
    while (j < s.length && flags[j] === flags[i]) j++;
    const f = flags[i], cls = CLASSES.filter(([bit]) => f & bit).map(([, c]) => 'md-' + c).join(' ');
    out += cls ? `<span class="${cls}">${esc(s.slice(i, j))}</span>` : esc(s.slice(i, j));
    i = j;
  }
  return out;
}
const marked = (s) => (s ? `<span class="md-m">${esc(s)}</span>` : '');

/* a line's rest, with its inline marks */
function inlineLine(s) { return s ? spans(s, flagsOf(s, 0)) : ''; }

/* the whole text, line by line: the block rules of small_markdown (headings ##–####, > quotes, - and 1. lists, fences, figures) */
export function highlight(text) {
  let fence = false;
  return text.split('\n').map((ln) => {
    if (ln.startsWith('```')) { fence = !fence; return `<span class="md-fence">${esc(ln)}</span>`; }
    if (fence) return `<span class="md-codeline">${esc(ln)}</span>`;
    let m = ln.match(/^(#{2,4})(\s+)(.*)$/);
    if (m) return `<span class="md-h">${marked(m[1] + m[2])}${inlineLine(m[3])}</span>`;
    if (/^!\[[^\]]*\]\(simulacrum:[\p{L}\p{N}_-]+\)\s*$/u.test(ln)) return `<span class="md-fig">${esc(ln)}</span>`;
    if (/^\[\^[\p{L}\p{N}_-]+\]:/u.test(ln)) return `<span class="md-def">${esc(ln)}</span>`;
    if (ln.startsWith('>')) {
      const q = ln.match(/^>\s?/)[0], rest = ln.slice(q.length), li = rest.match(LIST);
      return `<span class="md-q"><span class="md-qm">${esc(q)}</span>${li ? `<span class="md-li">${esc(li[0])}</span>` + inlineLine(rest.slice(li[0].length)) : inlineLine(rest)}</span>`;
    }
    m = ln.match(LIST);
    if (m) return `<span class="md-li">${esc(m[0])}</span>` + inlineLine(ln.slice(m[0].length));
    return inlineLine(ln);
  }).join('\n');
}

/* ---------- the editor ---------- */
const TOOLS = {
  heading: ['heading', 'a heading, ## then ### · ' + MOD + ' alt 2, 3'],
  italic: ['italic', 'italic · ' + MOD + ' i'],
  bold: ['bold', 'strong · ' + MOD + ' b'],
  quote: ['quote', 'quote · ' + MOD + ' shift .'],
  list: ['list', 'a list · ' + MOD + ' shift 8'],
  numbered: ['numbered', 'a numbered list · ' + MOD + ' shift 7'],
  code: ['code', 'code · ' + MOD + ' e'],
  link: ['link', 'a link · ' + MOD + ' k · or paste an address over the words'],
  note: ['note', 'a note: [^mark] in the text, its words beside'],
  figure: ['figure', 'a figure: a picture, and its line in the text'],
};
export const ALL_TOOLS = ['heading', 'italic', 'bold', 'quote', 'list', 'numbered', 'code', 'link', 'note', 'figure'];

/* mdEditor({value, tools, onNote, onFigure, spell}) -> {el, input, set(v), append(text), focus()}
   `input` is the textarea itself: read .value, listen for 'input'. */
export function mdEditor({ value = '', tools = ALL_TOOLS, onNote, onFigure, spell = true, rows = 14, label = 'the text' } = {}) {
  const ta = h('textarea', { class: 'md-input', autocapitalize: 'none', 'aria-label': label, spellcheck: spell ? 'true' : 'false', autocomplete: 'off' });
  ta.value = value;
  const pre = h('pre', { class: 'md-mirror', 'aria-hidden': 'true' });
  const surface = h('div', { class: 'md-surface', style: `--md-rows:${rows}` }, pre, ta);
  const paint = () => { pre.innerHTML = highlight(ta.value) + '​'; };
  paint();
  ta.addEventListener('input', paint);

  /* every change goes through here, as one step of the native undo where the browser allows it */
  function edit(from, to, text, selA, selB) {
    const v = ta.value, next = v.slice(0, from) + text + v.slice(to);
    ta.focus();
    if (next !== v) {
      let ok = false;
      ta.setSelectionRange(from, to);
      try { ok = text ? document.execCommand('insertText', false, text) : document.execCommand('delete'); } catch (_) { ok = false; }
      if (!ok || ta.value !== next) { ta.value = next; ta.dispatchEvent(new Event('input', { bubbles: true })); }
    }
    const a = selA === undefined ? from + text.length : selA;
    ta.setSelectionRange(a, selB === undefined ? a : selB);
  }

  const lineStart = (v, p) => v.lastIndexOf('\n', p - 1) + 1;
  const lineEnd = (v, p) => { const e = v.indexOf('\n', p); return e < 0 ? v.length : e; };
  function inFence(v, at) { let n = 0; for (const ln of v.slice(0, at).split('\n')) if (ln.startsWith('```')) n++; return n % 2 === 1; }

  /* the lines a selection touches, whole: [from, to, lines] */
  function block() {
    const v = ta.value, s = ta.selectionStart; let e = ta.selectionEnd;
    if (e > s && v[e - 1] === '\n') e--;
    const a = lineStart(v, s), b = lineEnd(v, e);
    return { a, b, lines: v.slice(a, b).split('\n'), s, e: ta.selectionEnd, single: v.slice(a, b).indexOf('\n') < 0 };
  }
  /* rewrite the lines of the selection with fn(line, index, all); the selection follows */
  function mapLines(fn) {
    const { a, b, lines, s, e } = block();
    const next = lines.map((l, i) => fn(l, i, lines));
    const text = next.join('\n');
    if (text === lines.join('\n')) return;
    if (s === e) {
      const delta = text.length - (b - a);
      edit(a, b, text, Math.max(a, s + delta));
    } else edit(a, b, text, a, a + text.length);
  }

  /* inline marks: wrap, or unwrap when they are there already (inside the selection or just outside it) */
  function toggleInline(mark) {
    const v = ta.value, ch = mark[0], k = mark.length;
    let s = ta.selectionStart, e = ta.selectionEnd;
    while (s < e && /\s/.test(v[s])) s++;
    while (e > s && /\s/.test(v[e - 1])) e--;
    if (s === e) {
      /* no words: a pair of marks with the caret between, or the pair taken out when the caret is in an empty one */
      if (v.slice(s - k, s) === mark && v.slice(s, s + k) === mark) return edit(s - k, s + k, '', s - k);
      return edit(s, s, mark + mark, s + k);
    }
    const sel = v.slice(s, e);
    const run = (str, atEnd) => { let n = 0; if (atEnd) while (n < str.length && str[str.length - 1 - n] === ch) n++; else while (n < str.length && str[n] === ch) n++; return n; };
    const lead = run(sel, false), trail = run(sel, true), pre = run(v.slice(0, s), true), post = run(v.slice(e), false);
    const present = (n) => (ch === '*' && k === 1 ? n === 1 || n === 3 : n >= k);
    const inner = lead > 0 && trail > 0 && lead < sel.length ? Math.min(lead, trail) : 0;
    if (inner && present(inner)) return edit(s, e, sel.slice(k, sel.length - k), s, e - 2 * k);
    if (!inner && pre > 0 && post > 0 && present(Math.min(pre, post))) return edit(s - k, e + k, sel, s - k, e - k);
    return edit(s, e, mark + sel + mark, s + k, e + k);
  }

  function link() {
    const v = ta.value;
    let s = ta.selectionStart, e = ta.selectionEnd;
    while (s < e && /\s/.test(v[s])) s++;
    while (e > s && /\s/.test(v[e - 1])) e--;
    const sel = v.slice(s, e), m = sel.match(/^\[([^\]]*)\]\(([^)]*)\)$/);
    if (m) return edit(s, e, m[1], s, s + m[1].length);
    if (/^(https?:\/\/|mailto:)\S+$/i.test(sel)) return edit(s, e, `[](${sel})`, s + 1);
    if (sel) return edit(s, e, `[${sel}]()`, s + sel.length + 3);
    edit(s, e, '[]()', s + 1);
  }

  /* a heading: the button goes round (## then ### then none), the shortcuts set one level or take it off */
  function heading(level) {
    mapLines((l, i) => {
      if (i) return l;
      const m = l.match(/^(#{2,4})\s+/), have = m ? m[1].length : 0, rest = m ? l.slice(m[0].length) : l;
      const want = level ? (have === level ? 0 : level) : have === 0 ? 2 : have === 2 ? 3 : 0;
      return (want ? '#'.repeat(want) + ' ' : '') + rest;
    });
  }
  function quote() {
    const { lines, single } = block();
    const all = lines.some((l) => l.trim()) && lines.every((l) => !l.trim() || l.startsWith('>'));
    mapLines((l) => (all ? l.replace(/^>[ ]?/, '') : l.startsWith('>') ? l : (l.trim() || single ? '> ' + l : '>')));
  }
  function list(numbered) {
    const { lines, single } = block();
    const mine = numbered ? /^(\s*)\d+\.\s+/ : /^(\s*)[-*]\s+/, any = /^(\s*)([-*]|\d+\.)\s+/;
    const all = lines.every((l) => !l.trim() || mine.test(l)) && lines.some((l) => l.trim());
    let n = 0;
    mapLines((l) => {
      if (!l.trim() && !single) return l;
      if (all) return l.replace(mine, '$1');
      const ind = (l.match(any) || l.match(/^(\s*)/))[1];
      return ind + (numbered ? ++n + '. ' : '- ') + l.replace(any, '').replace(/^\s+/, '');
    });
  }
  function note() {
    if (!onNote) return;
    const id = onNote(); if (!id) return;
    const e = ta.selectionEnd;
    edit(e, e, `[^${id}]`);
  }
  function indent(out) {
    const { lines } = block();
    const items = lines.filter((l) => LIST.test(l));
    if (!items.length || (out && !items.some((l) => /^\s/.test(l)))) return false;   /* nothing to move: Tab goes on as Tab does */
    mapLines((l) => (!LIST.test(l) ? l : out ? l.replace(/^(\t| {1,2})/, '') : '  ' + l));
    return true;
  }

  const DO = { heading: () => heading(), italic: () => toggleInline('*'), bold: () => toggleInline('**'), code: () => toggleInline('`'), link, quote, list: () => list(false), numbered: () => list(true), note, figure: () => onFigure && onFigure() };

  /* Enter at the end of a list item or a quote line goes on with the next; on an empty one it ends the list */
  function enter() {
    const v = ta.value, s = ta.selectionStart;
    if (s !== ta.selectionEnd) return false;
    const ls = lineStart(v, s), le = lineEnd(v, s), line = v.slice(ls, le);
    if (inFence(v, ls) || line.startsWith('```')) return false;
    const q = (line.match(/^(?:>[ ]?)+/) || [''])[0], rest = line.slice(q.length), lm = rest.match(/^(\s*)([-*]|\d+\.)(\s+)/);
    if (!q && !lm) return false;
    const head = q.length + (lm ? lm[0].length : 0);
    if (s - ls < head) return false;
    const qp = q && !/ $/.test(q) ? q + ' ' : q;
    if (!line.slice(head).trim() && s === le) {
      if (lm && lm[1]) { const n = lm[1].startsWith('\t') ? 1 : Math.min(2, lm[1].length); edit(ls + q.length, ls + q.length + n, '', s - n); return true; }
      edit(ls, le, lm ? qp.trimEnd() : '', ls + (lm ? qp.trimEnd().length : 0));
      return true;
    }
    const marker = lm ? lm[1] + (/\d/.test(lm[2]) ? (parseInt(lm[2], 10) + 1) + '.' : lm[2]) + lm[3] : '';
    edit(s, s, '\n' + qp + marker);
    return true;
  }

  /* Backspace just after a marker takes the whole marker */
  function backspace() {
    const v = ta.value, s = ta.selectionStart;
    if (s !== ta.selectionEnd) return false;
    const ls = lineStart(v, s), before = v.slice(ls, s);
    if (!before || inFence(v, ls) || !/^(\s*([-*]|\d+\.)\s+|(?:>[ ]?)+)$/.test(before)) return false;
    edit(ls, s, '', ls);
    return true;
  }

  ta.addEventListener('keydown', (e) => {
    if (e.isComposing || e.keyCode === 229) return;
    const mod = MAC ? e.metaKey : e.ctrlKey;
    let did = false;
    if (mod && !e.altKey && !e.shiftKey && !(MAC && e.ctrlKey)) {
      const k = e.key.toLowerCase();
      const t = { i: 'italic', b: 'bold', e: 'code', k: 'link' }[k];
      if (t && tools.includes(t)) { DO[t](); did = true; }
    } else if (mod && e.shiftKey && !e.altKey) {
      const t = { Period: 'quote', Digit8: 'list', Digit7: 'numbered' }[e.code];
      if (t && tools.includes(t)) { DO[t](); did = true; }
    } else if (mod && e.altKey && !e.shiftKey && tools.includes('heading') && (e.code === 'Digit2' || e.code === 'Digit3')) {
      heading(e.code === 'Digit2' ? 2 : 3);
      did = true;
    } else if (!mod && !e.altKey) {
      if (e.key === 'Enter' && !e.shiftKey) did = enter();
      else if (e.key === 'Backspace' && !e.shiftKey) did = backspace();
      else if (e.key === 'Tab') did = indent(e.shiftKey);
      else if (ta.selectionStart !== ta.selectionEnd && !ta.value.slice(ta.selectionStart, ta.selectionEnd).includes('\n') && ['*', '_', '`', '[', '('].includes(e.key)) {
        const s = ta.selectionStart, en = ta.selectionEnd, close = { '[': ']', '(': ')' }[e.key] || e.key;
        edit(s, en, e.key + ta.value.slice(s, en) + close, s + 1, en + 1);
        did = true;
      }
    }
    if (did) e.preventDefault();
  });

  /* an address pasted over words makes them a link */
  ta.addEventListener('paste', (e) => {
    const t = ((e.clipboardData && e.clipboardData.getData('text/plain')) || '').trim();
    const s = ta.selectionStart, en = ta.selectionEnd, sel = ta.value.slice(s, en);
    if (s === en || sel.includes('\n') || !/^(https?:\/\/|mailto:)\S+$/i.test(t)) return;
    e.preventDefault();
    edit(s, en, `[${sel}](${t.replace(/\(/g, '%28').replace(/\)/g, '%29')})`);
  });

  /* the toolbar: words with a brushed underline, quiet, each one in the way it will look */
  const bar = h('div', { class: 'md-bar', role: 'toolbar', 'aria-label': 'writing marks' },
    ...ALL_TOOLS.filter((t) => tools.includes(t) && (t !== 'note' || onNote) && (t !== 'figure' || onFigure)).map((t) => {
      const b = act(TOOLS[t][0], () => { DO[t](); ta.focus(); }, { 'data-tip': TOOLS[t][1], 'data-cursor': '.55', class: 'act aph-label md-t md-t-' + t });
      b.addEventListener('mousedown', (e) => e.preventDefault());   /* the selection stays in the text */
      return b;
    }));

  const el = h('div', { class: 'md-ed' }, bar, surface);
  return {
    el, input: ta,
    set(v) { ta.value = v; paint(); },
    append(text) { const n = ta.value.length; edit(n, n, text); },
    focus() { ta.focus(); },
  };
}

/* a field as ui.field makes it: its label, the editor, the brushed baseline, a hint */
export function mdField(label, ed, hint) {
  const id = 'md' + (seed++);
  ed.input.id = id;
  return h('div', { class: 'field md' },
    h('label', { class: 'aph-label aph-ink', for: id, text: label }), ed.el, rule('base', 1.2),
    hint ? h('span', { class: 'hint aph-meta aph-ink', text: hint }) : null);
}
