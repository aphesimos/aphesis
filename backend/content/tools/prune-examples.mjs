#!/usr/bin/env node
// The one-shot removal of the example entries the first seed imported, now that the site is live: the archive's four
// example posts and the book's six example entries, and their pictures in R2. Works are real and never touched.
//
//   node backend/content/tools/prune-examples.mjs --remote                    the deployed database and bucket
//   node backend/content/tools/prune-examples.mjs --local --persist-to DIR    a local wrangler dev state (the tests)
//   options: -c <wrangler config> (default wrangler.toml), --dry-run (say what would go, remove nothing)
//
// A row goes only when both hold: its slug is one of the examples' (EXAMPLES below, the file names they had on
// section/archive and section/book) and it is still marked example. Anything the owner wrote, a post or an entry at
// one of those slugs that is not marked example, and every work, stays. A picture goes only when no row left in posts,
// books or works names its key. The pictures go first and the rows after, so a run cut short is finished by the next;
// a run with nothing left to remove says so and changes nothing. Every removal is printed.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EXAMPLES = {
  posts: ['a-note-on-hermes-trismegistus', 'how-a-simulacrum-is-made', 'how-the-fog-is-made', 'the-phi-drawn-by-hand'],
  books: ['emerald-tablet', 'paradiso', 'newton', 'faust', 'jerome', 'flammarion'],
};

const here = path.dirname(fileURLToPath(import.meta.url));
const content = path.resolve(here, '..');
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const mode = args.includes('--remote') ? 'remote' : args.includes('--local') ? 'local' : null;
if (!mode) { console.error('say --remote, or --local [--persist-to DIR]'); process.exit(2); }
const dry = args.includes('--dry-run');
const config = opt('-c') || 'wrangler.toml';
const WRANGLER = (process.env.WRANGLER || 'npx --yes wrangler@4.153.0').split(' ');
const where = mode === 'remote' ? ['--remote'] : ['--local', ...(opt('--persist-to') ? ['--persist-to', opt('--persist-to')] : [])];

function wrangler(a) {
  const r = spawnSync(WRANGLER[0], [...WRANGLER.slice(1), ...a, '-c', config], { cwd: content, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
  if (r.status !== 0) { console.error(`wrangler ${a.slice(0, 3).join(' ')} failed:\n${r.stdout}${r.stderr}`); process.exit(1); }
  return r.stdout;
}
/* one statement through `d1 execute --json`: its rows */
function sql(command) {
  const out = wrangler(['d1', 'execute', 'aphesis-content', '--json', '--yes', '--command', command, ...where]);
  const at = out.search(/^\[/m);   /* the JSON, past anything printed before it */
  if (at < 0) { console.error(`no JSON from wrangler:\n${out}`); process.exit(1); }
  const parsed = JSON.parse(out.slice(at));
  return parsed.flatMap((r) => r.results || []);
}
const list = (xs) => xs.map((x) => `'${x.replace(/'/g, "''")}'`).join(', ');
const keyOf = /m\/[0-9a-f]{24}\.(?:png|jpg)/g;

/* the example rows still there, and the rows at an example slug that are not examples (kept) */
const doomed = [], kept = [];
for (const [table, slugs] of Object.entries(EXAMPLES)) {
  const cols = table === 'posts' ? 'slug, title, example, figures AS pics' : 'slug, title, example, picture AS pics';
  for (const r of sql(`SELECT ${cols} FROM ${table} WHERE slug IN (${list(slugs)}) ORDER BY slug`)) {
    (Number(r.example) === 1 ? doomed : kept).push({ table, slug: r.slug, title: r.title, keys: [...new Set(String(r.pics).match(keyOf) || [])] });
  }
}
for (const k of kept) console.log(`kept ${k.table}/${k.slug} (“${k.title}”): not marked example, so it is the owner's`);

if (!doomed.length) {
  console.log('nothing to remove: no example rows are left in posts or books; works untouched');
  process.exit(0);
}

/* a picture stays while anything that remains names it */
const doomedIds = new Set(doomed.map((d) => `${d.table}/${d.slug}`));
const named = new Set();
for (const r of sql('SELECT \'posts\' AS t, slug AS id, figures || \' \' || body AS refs FROM posts UNION ALL ' +
  'SELECT \'books\', slug, picture FROM books UNION ALL SELECT \'works\', id, map FROM works')) {
  if (doomedIds.has(`${r.t}/${r.id}`)) continue;
  for (const k of String(r.refs).match(keyOf) || []) named.add(k);
}
const pictures = [...new Set(doomed.flatMap((d) => d.keys))].sort();
const freed = pictures.filter((k) => !named.has(k));
for (const k of pictures.filter((k) => named.has(k))) console.log(`kept picture ${k}: another entry still uses it`);

for (const d of doomed) console.log(`${dry ? 'would remove' : 'removing'} ${d.table}/${d.slug} (“${d.title}”)`);
for (const k of freed) console.log(`${dry ? 'would remove' : 'removing'} picture ${k}`);
if (dry) { console.log(`dry run: ${doomed.length} rows and ${freed.length} pictures would go; nothing changed`); process.exit(0); }

for (const k of freed) wrangler(['r2', 'object', 'delete', `aphesis-content/${k}`, ...where]);
for (const [table, slugs] of Object.entries(EXAMPLES)) {
  const mine = doomed.filter((d) => d.table === table).map((d) => d.slug).filter((s) => slugs.includes(s));
  if (mine.length) sql(`DELETE FROM ${table} WHERE example = 1 AND slug IN (${list(mine)})`);
}
const left = Object.entries(EXAMPLES).flatMap(([table, slugs]) => sql(`SELECT slug FROM ${table} WHERE example = 1 AND slug IN (${list(slugs)})`));
if (left.length) { console.error(`still there: ${left.map((r) => r.slug).join(', ')}`); process.exit(1); }
console.log(`removed ${doomed.length} example rows (${doomed.filter((d) => d.table === 'posts').length} posts, ` +
  `${doomed.filter((d) => d.table === 'books').length} book entries) and ${freed.length} pictures; works untouched`);
