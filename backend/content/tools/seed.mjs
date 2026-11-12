#!/usr/bin/env node
// The one-time import: the content that lives today on the section branches, into the content service's D1 and R2,
// so nothing is lost when the sections start reading from the API.
//
//   node backend/content/tools/seed.mjs --remote                         the deployed database and bucket
//   node backend/content/tools/seed.mjs --local --persist-to DIR         a local wrangler dev state (the tests)
//   node backend/content/tools/seed.mjs --out DIR                        only write seed.sql and the pictures
//   options: -c <wrangler config> (default wrangler.toml), --replace (overwrite entries that are already there)
//
// It reads, with git, from:
//   section/archive  archive/content/*.md: front matter, body, [^notes], ![caption](simulacrum:<map>) figures
//   section/book     book/content/*.md: one entry each, in file-name order
//   section/works    works/content/works.json and works/maps/*
//   design-system    system/assets/Simulacra/* (the maps the archive and the book name)
//   me (optional)    me/content/me.json: the two awards, and each work's `line` and `status` (its `tag`)
// and this branch's content/assets/mail-phi.png (the email's φ, at mail/phi.png).
// Each ref falls back to origin/<ref>; ARCHIVE_REF, BOOK_REF, WORKS_REF, DS_REF and ME_REF override them. The `me`
// ref is the only one that may be missing: without it (or without a me/content/me.json on it) nothing of the me page
// is seeded. Its awards are published, in the order written (positions 1 and 2), and added like any entry, so an
// award already in D1 stays as the owner left it; a work's line and status are filled in only where they are empty,
// for the works whose id matches, so what the owner wrote there is never overwritten.
// Pictures go to R2 under a key made from their bytes (m/<sha-256, 24 hex>.<ext>), exactly as the Worker names
// uploads. An entry marked `example: true` (a post or a book entry written to show a section, or a work, should one
// ever be) is never imported: it is skipped and named. A section with no content imports nothing. Every imported
// entry is published. Running it again adds nothing twice: an entry whose slug or id is
// already in D1 is left as it is (the owner's edits stay), a picture lands on the same key; --replace overwrites
// the imported entries instead.
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const content = path.resolve(here, '..');
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const mode = args.includes('--remote') ? 'remote' : args.includes('--local') ? 'local' : opt('--out') ? 'out' : null;
if (!mode) { console.error('say --remote, --local [--persist-to DIR] or --out DIR'); process.exit(2); }
const config = opt('-c') || 'wrangler.toml';
const WRANGLER = (process.env.WRANGLER || 'npx --yes wrangler@4.153.0').split(' ');

function ref(name, env) {
  const want = process.env[env] || name;
  for (const r of [want, `origin/${want}`]) {
    if (spawnSync('git', ['-C', content, 'rev-parse', '--verify', '-q', r]).status === 0) return r;
  }
  console.error(`no ref ${want} (fetch it: git fetch origin ${want}:${want})`); process.exit(1);
}
/* like ref, but null when there is none: the me page's content is optional */
function optionalRef(name, env) {
  const want = process.env[env] || name;
  for (const r of [want, `origin/${want}`]) {
    if (spawnSync('git', ['-C', content, 'rev-parse', '--verify', '-q', r]).status === 0) return r;
  }
  return null;
}
const git = (r, p, binary) => execFileSync('git', ['-C', content, 'show', `${r}:${p}`], binary ? {} : { encoding: 'utf8' });
/* the file names in a folder of a ref; none when the ref has no such folder (a section with no content) */
const ls = (r, p) => {
  const out = spawnSync('git', ['-C', content, 'ls-tree', '--full-tree', '--name-only', `${r}:${p}`], { encoding: 'utf8' });
  return out.status === 0 ? out.stdout.split('\n').filter(Boolean) : [];
};
const skipped = [];
/* examples are never imported: the site is live, and the entries written to show it are gone */
const real = (kind) => (e) => { if (e.example) { skipped.push(`${kind}/${e.slug || e.id}`); return false; } return true; };
const AR = ref('section/archive', 'ARCHIVE_REF'), BR = ref('section/book', 'BOOK_REF'), WR = ref('section/works', 'WORKS_REF'), DS = ref('design-system', 'DS_REF');

// ---------- pictures ----------
function size(b) {
  if (b[0] === 0x89 && b[1] === 0x50) return { kind: 'png', w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let o = 2;
    while (o + 9 < b.length) {
      if (b[o] !== 0xff) { o++; continue; }
      const m = b[o + 1];
      if (m === 0xff) { o++; continue; }
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { o += 2; continue; }
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { kind: 'jpg', h: b.readUInt16BE(o + 5), w: b.readUInt16BE(o + 7) };
      o += 2 + b.readUInt16BE(o + 2);
    }
  }
  throw new Error('not a png or jpeg');
}
const media = new Map();   /* key -> {bytes, type} */
function picture(bytes) {
  const s = size(bytes);
  const key = `m/${createHash('sha256').update(bytes).digest('hex').slice(0, 24)}.${s.kind}`;
  media.set(key, { bytes, type: s.kind === 'png' ? 'image/png' : 'image/jpeg' });
  return { key, w: s.w, h: s.h };
}
const simulacrum = (file) => picture(git(DS, `system/assets/Simulacra/${file}`, true));

// ---------- front matter ----------
function front(text, name) {
  const m = text.replace(/\r\n/g, '\n').match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!m) throw new Error(`${name}: no front matter`);
  const meta = {};
  for (const line of m[1].split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const i = line.indexOf(':'); if (i < 0) continue;
    let v = line.slice(i + 1).trim();
    if (v.length >= 2 && v[0] === v[v.length - 1] && `"'`.includes(v[0])) v = v.slice(1, -1);
    meta[line.slice(0, i).trim()] = v;
  }
  return [meta, m[2]];
}

// ---------- archive: the same map names as archive/build.py's MAP_FILES ----------
const MAP_FILES = { trismegistus: 'trismegistus.png', jerome: 'jerome.jpg', alchemist: 'alchemist.jpg', flammarion: 'flammarion.png',
  cagnacci: 'cagnacci.jpg', magdalen: 'magdalen.jpg', newton: 'newton.jpg', paradiso: 'paradiso.jpg', faust: 'faust.jpg' };
const posts = ls(AR, 'archive/content').filter((f) => f.endsWith('.md')).map((f) => {
  const [meta, raw] = front(git(AR, `archive/content/${f}`), f);
  if ((meta.example || '').toLowerCase() === 'true') return { slug: f.slice(0, -3), example: true };
  const notes = [];
  const body = raw.replace(/^\[\^([\w-]+)\]:\s*(.+(?:\n(?!\n|\[\^).+)*)/gm, (_, id, t) => { notes.push({ id, text: t.trim().replace(/\s*\n\s*/g, ' ') }); return ''; })
    .replace(/\n{3,}/g, '\n\n').trim();
  const figures = [];
  for (const [, name] of body.matchAll(/^!\[[^\]]*\]\(simulacrum:([\w-]+)\)\s*$/gm)) {
    if (!figures.some((x) => x.name === name)) figures.push({ name, ...simulacrum(MAP_FILES[name]) });
  }
  return { slug: f.slice(0, -3), title: meta.title, summary: meta.summary, stage: meta.stage, date: meta.date, body, notes, figures,
    example: false };
}).filter(real('posts'));

// ---------- book ----------
const books = ls(BR, 'book/content').filter((f) => f.endsWith('.md') && !f.startsWith('_')).sort().map((f) => [f, ...front(git(BR, `book/content/${f}`), f)])
  .filter(([f, meta]) => real('books')({ slug: f.replace(/\.md$/, '').replace(/^\d+[-_]/, ''), example: (meta.example || '').toLowerCase() === 'true' }))
  .map(([f, meta, raw], i) => {
    const adjust = {};
    for (const k of ['gain', 'scatter', 'erosion', 'ceiling', 'blur', 'contrast', 'brightness']) if (meta[k] !== undefined) adjust[k] = Number(meta[k]);
    if (meta.crop) adjust.crop = meta.crop.replace(/,/g, ' ').split(/\s+/).filter(Boolean).map(Number);
    const note = raw.trim().split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n\n');
    return { slug: f.replace(/\.md$/, '').replace(/^\d+[-_]/, ''), title: meta.title, author: meta.author, year: meta.year, note,
      quote: meta.quote || '', quote_lang: meta.quote_lang || '', quote_en: meta.quote_en || '', caption: meta.caption,
      picture: simulacrum(meta.map), adjust, position: i + 1, example: false };
  });

// ---------- works ----------
const data = JSON.parse(git(WR, 'works/content/works.json'));
const works = data.works.filter(real('works')).map((w, i) => ({
  ...w, position: i + 1,
  map: { ...picture(git(WR, `works/maps/${w.map.file}`, true)), caption: w.map.caption, settings: w.map.settings || {} },
}));

// ---------- me: awards, and each work's line and status ----------
const ME = optionalRef('me', 'ME_REF');
const meFile = ME && spawnSync('git', ['-C', content, 'show', `${ME}:me/content/me.json`], { encoding: 'utf8' });
const me = meFile && meFile.status === 0 ? JSON.parse(meFile.stdout) : null;
const slugOf = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
const awards = me ? (me.awards?.items || []).map((a, i) => ({ id: a.id || slugOf(a.title), title: a.title, note: a.note || '', line: a.line || '', position: i + 1 })) : [];
const lines = me ? (me.works?.items || []).filter((w) => w.line || w.tag).map((w) => ({ id: w.id, line: w.line || '', status: w.tag || '' })) : [];

// ---------- SQL ----------
const q = (v) => (v === null || v === undefined ? "''" : typeof v === 'number' ? String(v) : typeof v === 'boolean' ? (v ? '1' : '0')
  : "'" + (typeof v === 'string' ? v : JSON.stringify(v)).replace(/'/g, "''") + "'");
const now = Date.now();
const verb = args.includes('--replace') ? 'INSERT OR REPLACE' : 'INSERT OR IGNORE';
const row = (table, o) => `${verb} INTO ${table} (${Object.keys(o).join(', ')}, published, created, updated) VALUES (${Object.values(o).map(q).join(', ')}, 1, ${now}, ${now});`;
const sql = ['SELECT 1;',
  ...posts.map((p) => row('posts', p)),
  ...books.map(({ picture: pic, ...b }) => row('books', { ...b, picture: pic.key, picture_w: pic.w, picture_h: pic.h })),
  ...works.map((w) => row('works', { id: w.id, name: w.name, gloss: w.gloss, gloss_tip: w.gloss_tip, year: w.year, role: w.role,
    description: w.description, links: w.links || [], map: w.map, sources: w.sources || {}, flags: w.flags || {}, position: w.position })),
  ...awards.map((a) => row('awards', a)),
  /* only where the work has none yet: what the owner wrote stays */
  ...lines.map((w) => `UPDATE works SET line = CASE WHEN line = '' THEN ${q(w.line)} ELSE line END, status = CASE WHEN status = '' THEN ${q(w.status)} ELSE status END WHERE id = ${q(w.id)};`),
].join('\n') + '\n';
media.set('mail/phi.png', { bytes: readFileSync(path.join(content, 'assets', 'mail-phi.png')), type: 'image/png' });

const dir = mode === 'out' ? path.resolve(opt('--out')) : mkdtempSync(path.join(tmpdir(), 'aphesis-seed-'));
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, 'seed.sql'), sql);
const files = [];
for (const [key, m] of media) { const f = path.join(dir, key.replace('/', '_')); writeFileSync(f, m.bytes); files.push([key, f, m.type]); }
for (const s of skipped) console.log(`skipped ${s}: marked example`);
console.log(`${posts.length} posts, ${books.length} book entries, ${works.length} works, ${media.size} pictures` +
  (me ? `, ${awards.length} awards, ${lines.length} work lines` : ''));
if (mode === 'out') { console.log(dir); process.exit(0); }

const where = mode === 'remote' ? ['--remote'] : ['--local', ...(opt('--persist-to') ? ['--persist-to', opt('--persist-to')] : [])];
function wrangler(a) {
  const r = spawnSync(WRANGLER[0], [...WRANGLER.slice(1), ...a, '-c', config], { cwd: content, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
  if (r.status !== 0) { console.error(r.stdout + r.stderr); process.exit(1); }
}
wrangler(['d1', 'execute', 'aphesis-content', '--file', path.join(dir, 'seed.sql'), '--yes', ...where]);
for (const [key, f, type] of files) wrangler(['r2', 'object', 'put', `aphesis-content/${key}`, '--file', f, '--content-type', type, ...where]);
rmSync(dir, { recursive: true, force: true });
console.log(`seeded (${mode})`);
