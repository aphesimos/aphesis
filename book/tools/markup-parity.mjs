#!/usr/bin/env node
// Proves src/markup.js writes what the archive's render.js writes, for the subset a note uses (paragraphs, > quotes,
// - and 1. lists, `code`, links, **strong**, *em*, _em_), and that a note with no markup comes out as its paragraphs.
// The archive's render.js is read from section/archive with git (ARCHIVE_REF, else origin/section/archive).
//
//   node book/tools/markup-parity.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { noteHtml } from '../src/markup.js';

const D = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ref = process.env.ARCHIVE_REF || 'origin/section/archive';
const tmp = mkdtempSync(path.join(tmpdir(), 'markup-parity-'));
writeFileSync(path.join(tmp, 'render.mjs'), execFileSync('git', ['-C', D, 'show', `${ref}:archive/src/render.js`], { encoding: 'utf8' }));
const { convert } = await import(pathToFileURL(path.join(tmp, 'render.mjs')).href);

let bad = 0;
const same = (name, got, want) => { if (got !== want) { bad++; console.error(`${name}\n  book:    ${JSON.stringify(got)}\n  expected ${JSON.stringify(want)}`); } };
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

/* a note with no markup: its paragraphs, as the leaf set them before (one <p> each, text escaped) */
for (const paras of [['one plain paragraph.'], ['first, with “quotes” & <angle> brackets.', 'second — and a third thing: 2 < 3.'],
  ['a hard-wrapped\nparagraph that the\nrenderer joins'], ['snake_case_name and 3*4*5 and a_b stay as they are']]) {
  same('plain ' + JSON.stringify(paras[0]).slice(0, 30), noteHtml(paras).replace(/\n/g, ''), paras.map((p) => '<p>' + esc(p.split('\n').map((l) => l.trim()).join(' ')) + '</p>').join(''));
}

/* the subset, against the archive's converter */
const cases = [
  'plain *italic* and **strong** and _also italic_ and `code`.',
  'a [link](https://example.com/x) in the line, and [another](#book/x).',
  'before\n\n> a quote\n> on two lines\n\nafter',
  '- one\n- two\n- three',
  '1. first\n2. second\n3. third',
  'a paragraph\n- then a list\n- of two\n\nand a closing line',
  '> a quote with *em* and\n> - a list in it\n\nand then text',
  '**strong *and em* inside**, then `code with *stars*`',
  'combos: ***both***, *a* b *c*, in_the_middle, _x_.',
  'tom & jerry <b>not markup</b> "quoted" \'single\'',
];
for (const c of cases) same(JSON.stringify(c).slice(0, 48), noteHtml(c.split(/\n\s*\n/)), convert('x', c).html);

/* what the book keeps to itself: no headings, no fences, a link that is not a web address stays the words it is */
same('heading is words', noteHtml(['## not a heading']), '<p>## not a heading</p>');
same('script link refused', noteHtml(['[x](javascript:alert(1))']), '<p>[x](javascript:alert(1))</p>');
same('mail link kept', noteHtml(['[me](mailto:a@b.c)']), '<p><a href="mailto:a@b.c">me</a></p>');

console.log(bad ? `${bad} differ` : 'markup.js agrees with the archive\'s converter');
process.exit(bad ? 1 : 0);
