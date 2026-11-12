// The one-shot removal of the seeded examples (content/tools/prune-examples.mjs), end to end against a local D1 and
// R2: the database as the first seed left it (the archive's four example posts, the book's six example entries, the
// two works of the tests' own works fixture, their pictures), plus what the owner might have added (a post at one of
// the examples' slugs, not marked example; a book entry that shares an example's picture; a post of their own). A dry run changes nothing, the run
// removes exactly the example rows and the pictures nothing else names, and a second run finds nothing to do. Then
// the Worker answers with what is left.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { start, wrangler, root, fixtureCommit, worksFixture, simulacraFixture } from './dev.mjs';

const SITE = 'http://localhost:8000';
const EXAMPLE_POSTS = ['a-note-on-hermes-trismegistus', 'how-a-simulacrum-is-made', 'how-the-fog-is-made', 'the-phi-drawn-by-hand'];
const EXAMPLE_BOOKS = ['emerald-tablet', 'paradiso', 'newton', 'faust', 'jerome', 'flammarion'];
const key = (i) => `m/${String(i).padStart(24, '0')}.jpg`;   /* the examples' pictures; key(0) is shared with the owner, key(2) named by nothing */
const SHARED = key(0);

let c;
const runs = {};
function prune(state, ...extra) {
  const r = spawnSync(process.execPath, [path.join(root, 'content', 'tools', 'prune-examples.mjs'), '--local', '--persist-to', state, '-c', 'wrangler.e2e.toml', ...extra], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stdout + r.stderr);
  return r.stdout;
}
const q = (v) => `'${String(v).replace(/'/g, "''")}'`;

before(async () => {
  c = await start('content', { ALLOWED_ORIGINS: SITE }, {
    async prepare(state, dir) {
      wrangler('content', ['d1', 'migrations', 'apply', 'aphesis-content', '--local', '--persist-to', state]);
      /* the works, through the seed, from the tests' own works and empty archive and book branches */
      const empty = fixtureCommit({ 'README.md': 'nothing here\n' });
      const s = spawnSync(process.execPath, [path.join(root, 'content', 'tools', 'seed.mjs'), '--local', '--persist-to', state, '-c', 'wrangler.e2e.toml'],
        { encoding: 'utf8', env: { ...process.env, ARCHIVE_REF: empty, BOOK_REF: empty, WORKS_REF: worksFixture(), DS_REF: simulacraFixture() } });
      if (s.status !== 0) throw new Error(s.stdout + s.stderr);
      runs.seed = s.stdout;
      /* the rows the first seed wrote, marked example, and what the owner added since */
      const now = Date.now();
      const post = (slug, example, figures) => `INSERT INTO posts (slug, title, summary, stage, date, body, notes, figures, example, published, created, updated) VALUES (${q(slug)}, ${q(slug.replace(/-/g, ' '))}, 'a line.', 'albedo', '2026-01-01', 'text.', '[]', ${q(JSON.stringify(figures))}, ${example}, 1, ${now}, ${now});`;
      const book = (slug, example, pic, pos) => `INSERT INTO books (slug, title, author, year, note, caption, picture, picture_w, picture_h, position, example, published, created, updated) VALUES (${q(slug)}, ${q(slug)}, 'someone', '1500', 'a note.', 'a caption', ${q(pic)}, 480, 480, ${pos}, ${example}, 1, ${now}, ${now});`;
      const rows = [
        ...EXAMPLE_POSTS.filter((s) => s !== 'how-the-fog-is-made').map((slug, i) => post(slug, 1, i === 0 ? [{ name: 'a', key: key(1), w: 480, h: 480 }] : [])),
        post('how-the-fog-is-made', 0, []),          /* the owner's own post at an example's slug */
        post('on-salt', 0, []),                      /* the owner's own post */
        ...EXAMPLE_BOOKS.map((slug, i) => book(slug, 1, i === 0 ? SHARED : key(i + 2), i + 1)),
        book('the-owners-entry', 0, SHARED, 7),      /* the owner's entry, on the same picture as an example's */
      ];
      const file = path.join(state, 'old-seed.sql');
      writeFileSync(file, rows.join('\n') + '\n');
      wrangler('content', ['d1', 'execute', 'aphesis-content', '--local', '--persist-to', state, '--file', file, '--yes']);
      const pic = path.join(state, 'pic.jpg');
      writeFileSync(pic, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
      for (let i = 0; i <= EXAMPLE_BOOKS.length + 1; i++) {
        wrangler('content', ['r2', 'object', 'put', `aphesis-content/${key(i)}`, '--file', pic, '--content-type', 'image/jpeg', '--local', '--persist-to', state]);
      }
      runs.dry = prune(state, '--dry-run');
      runs.first = prune(state);
      runs.second = prune(state);
    },
  });
});
after(async () => { await c?.stop(); });

const get = async (p) => (await fetch(c.url + p, { headers: { Origin: SITE } })).json();

test('a dry run says what would go and changes nothing', () => {
  assert.match(runs.dry, /would remove posts\/a-note-on-hermes-trismegistus/);
  assert.match(runs.dry, /dry run: 9 rows and 6 pictures would go; nothing changed/);
  assert.match(runs.first, /removing posts\/a-note-on-hermes-trismegistus/, 'the rows were still there after the dry run');
});

test('the run removes exactly the example rows and the pictures nothing else names, and says so', async () => {
  for (const slug of EXAMPLE_POSTS.filter((s) => s !== 'how-the-fog-is-made')) assert.match(runs.first, new RegExp(`removing posts/${slug} `));
  for (const slug of EXAMPLE_BOOKS) assert.match(runs.first, new RegExp(`removing books/${slug} `));
  assert.match(runs.first, /kept posts\/how-the-fog-is-made .*not marked example/);
  assert.match(runs.first, new RegExp(`kept picture ${SHARED.replace('.', '\\.')}: another entry still uses it`));
  assert.match(runs.first, /removed 9 example rows \(3 posts, 6 book entries\) and 6 pictures; works untouched/);

  const { posts } = await get('/v1/posts');
  assert.deepEqual(posts.map((p) => p.slug).sort(), ['how-the-fog-is-made', 'on-salt']);
  const { books } = await get('/v1/books');
  assert.deepEqual(books.map((b) => b.slug), ['the-owners-entry']);
  const w = await get('/v1/works');
  assert.deepEqual(w.works.map((x) => x.id), ['heild', 'aphesis'], 'works untouched');
  assert.equal((await fetch(w.works[0].map.url)).status, 200, "a work's picture stays");
  assert.equal((await fetch(`${c.url}/media/${SHARED}`)).status, 200, 'a picture the owner still uses stays');
  for (const i of [1, 3, 4, 5, 6, 7]) assert.equal((await fetch(`${c.url}/media/${key(i)}`)).status, 404, `${key(i)} is gone`);
  assert.equal((await fetch(`${c.url}/media/${key(2)}`)).status, 200, 'a picture no example named is not touched');
  assert.equal((await fetch(`${c.url}/media/mail/phi.png`)).status, 200, "the email's φ stays");
});

test('a second run finds nothing and changes nothing', () => {
  assert.match(runs.second, /nothing to remove: no example rows are left in posts or books; works untouched/);
  assert.doesNotMatch(runs.second, /removing/);
});

test('the seed imports nothing from branches with no content, and works as they are', () => {
  assert.match(runs.seed, /^0 posts, 0 book entries, 2 works, 3 pictures$/m);
});
