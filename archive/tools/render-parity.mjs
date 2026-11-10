#!/usr/bin/env node
// Proves src/render.js writes the markup build.py writes: for every post in content/, the list and the post, both
// with the notes written in the body (as content/*.md has them) and with the notes kept apart (as the content
// service keeps them). build.py runs with its own small converter (python-markdown hidden), the one render.js ports.
//
//   node archive/tools/render-parity.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { convert, listHtml, postHtml, sortPosts } from '../src/render.js';

const D = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const py = `
import sys, json, importlib.util
sys.modules['markdown'] = None
spec = importlib.util.spec_from_file_location('build', ${JSON.stringify(path.join(D, 'build.py'))})
b = importlib.util.module_from_spec(spec); spec.loader.exec_module(b)
posts = b.load_posts()
print(json.dumps({'list': b.list_html(posts), 'posts': {p['slug']: b.post_html(p) for p in posts}}))
`;
const want = JSON.parse(execFileSync('python3', ['-c', py], { encoding: 'utf8', maxBuffer: 64 << 20 }));

function read(f) {
  const text = readFileSync(path.join(D, 'content', f), 'utf8');
  const m = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  const meta = {};
  m[1].split('\n').forEach((l) => { const i = l.indexOf(':'); if (i > 0) meta[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, ''); });
  return { slug: f.slice(0, -3), title: meta.title, summary: meta.summary, stage: meta.stage, date: meta.date,
    example: (meta.example || '').toLowerCase() === 'true', body: m[2] };
}
const posts = sortPosts(readdirSync(path.join(D, 'content')).filter((f) => f.endsWith('.md')).map(read));
let bad = 0;
const check = (name, got, exp) => { if (got !== exp) { bad++; let i = 0; while (got[i] === exp[i]) i++; console.error(`${name} differs at ${i}:\n  js: ${got.slice(i - 60, i + 80)}\n  py: ${exp.slice(i - 60, i + 80)}`); } };
check('list', listHtml(posts), want.list);
for (const p of posts) {
  check(p.slug, postHtml(p, convert(p.slug, p.body)), want.posts[p.slug]);
  /* the notes apart, as the content service keeps them */
  const notes = [];
  const body = p.body.replace(/^\[\^([\w-]+)\]:\s*(.+(?:\n(?!\n|\[\^).+)*)/gm, (_, id, t) => { notes.push({ id, text: t.trim().replace(/\s*\n\s*/g, ' ') }); return ''; });
  check(p.slug + ' (notes apart)', postHtml(p, convert(p.slug, body, notes)), want.posts[p.slug]);
}
console.log(bad ? `${bad} differences` : `the same markup for the list and ${posts.length} posts, both ways`);
process.exit(bad ? 1 : 0);
