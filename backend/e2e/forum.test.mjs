// The forum's Rust Worker end to end, under wrangler dev: what the JavaScript Worker's tests covered, over real
// HTTP, with the real Durable Objects (SQLite-backed) and a local R2 bucket.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { start, dump, query } from './dev.mjs';

const SITE = 'https://aphes.ist';
const base = { ALLOWED_ORIGINS: SITE, IP_SALT: 's1', POSTER_SALT: 's2', ADMIN_SECRET: 'open-sesame', RATE_POSTS: '3', RATE_THREADS: '2', RATE_WINDOW_SECONDS: '120' };
let f;
before(async () => { f = await start('forum', { ...base, ALLOW_NO_TURNSTILE: '1' }); });
after(async () => { await f?.stop(); });

const H = (ip, more = {}) => ({ 'CF-Connecting-IP': ip, Origin: SITE, ...more });
function form(fields) { const fd = new FormData(); for (const [k, v] of Object.entries(fields)) fd.append(k, v); return fd; }
const req = (w, p, init = {}) => fetch(w.url + p, init);
const postForm = (w, p, ip, fields) => req(w, p, { method: 'POST', headers: H(ip), body: form(fields) });
function jpeg(w, h) {
  const b = new Uint8Array(200); b.set([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, w >> 8, w & 255, 1]);
  return new Blob([b], { type: 'image/jpeg' });
}
/* the objects in the local R2 bucket (Miniflare keeps one blob file per object) */
function blobs(w) {
  const dir = path.join(w.state, 'v3', 'r2', 'aphesis-forum-images', 'blobs');
  return existsSync(dir) ? readdirSync(dir).length : 0;
}
const admin = { Authorization: 'Bearer open-sesame' };

test('a thread, replies, sigils per thread, the board', async () => {
  let r = await postForm(f, '/api/threads', '1.1.1.1', { text: 'first line\nsecond' });
  assert.equal(r.status, 201);
  assert.equal(r.headers.get('access-control-allow-origin'), SITE);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  const { thread, n } = await r.json();
  assert.match(thread, /^[a-z2-9]{10}$/);
  assert.equal(n, 1);
  r = await postForm(f, `/api/threads/${thread}/posts`, '2.2.2.2', { text: '>>1 yes' });
  assert.deepEqual(await r.json(), { thread, n: 2 });
  r = await postForm(f, `/api/threads/${thread}/posts`, '1.1.1.1', { text: 'me again' });
  assert.equal(r.status, 201);
  const t = await (await req(f, `/api/threads/${thread}`)).json();
  assert.deepEqual(Object.keys(t), ['id', 'created', 'posts']);
  assert.equal(t.posts.length, 3);
  assert.deepEqual(Object.keys(t.posts[0]), ['n', 'poster', 'text', 'created']);
  assert.match(t.posts[0].poster, /^[0-9a-f]{16}$/);
  assert.equal(t.posts[0].poster, t.posts[2].poster, 'same person, same token in a thread');
  assert.notEqual(t.posts[0].poster, t.posts[1].poster);
  assert.ok(!JSON.stringify(t).includes('1.1.1.1'), 'no address in what is served');
  /* the same person in another thread gets another token */
  r = await postForm(f, '/api/threads', '1.1.1.1', { text: 'another' });
  const other = (await r.json()).thread;
  const t2 = await (await req(f, `/api/threads/${other}`)).json();
  assert.notEqual(t2.posts[0].poster, t.posts[0].poster);
  r = await req(f, '/api/board');
  assert.equal(r.headers.get('cache-control'), 'public, max-age=5');
  const b = await r.json();
  assert.deepEqual(Object.keys(b), ['threads', 'next']);
  assert.equal(b.next, null, 'one page so far');
  assert.equal(b.threads[0].id, other);
  assert.equal(b.threads[1].id, thread);
  assert.equal(b.threads[1].replies, 2);
  assert.equal(b.threads[1].first, 'first line\nsecond');
  assert.deepEqual(Object.keys(b.threads[1]), ['id', 'first', 'replies', 'created', 'bumped', 'image']);
  assert.equal(b.threads[1].image, null);
  assert.ok(!dump(f.state).includes('1.1.1.1'), 'no address anywhere in storage');
});

test('the poster token is SHA-256(POSTER_SALT|poster|thread|ipHash), 16 hex', async () => {
  const { createHash } = await import('node:crypto');
  const sha = (s) => createHash('sha256').update(s).digest('hex');
  const { thread } = await (await postForm(f, '/api/threads', '7.7.7.70', { text: 'token' })).json();
  const t = await (await req(f, `/api/threads/${thread}`)).json();
  const ipH = sha('s1|ip|7.7.7.70').slice(0, 32);
  assert.equal(t.posts[0].poster, sha(`s2|poster|${thread}|${ipH}`).slice(0, 16));
});

test('rate limits per IP hash, with Retry-After', async () => {
  const { thread } = await (await postForm(f, '/api/threads', '3.3.3.3', { text: 'x' })).json();
  const codes = [];
  let last;
  for (let i = 0; i < 4; i++) { last = await postForm(f, `/api/threads/${thread}/posts`, '4.4.4.4', { text: 'r' + i }); codes.push(last.status); }
  assert.deepEqual(codes, [201, 201, 201, 429]);
  assert.equal(last.headers.get('retry-after'), '40');
  assert.deepEqual(await last.json(), { error: 'slowly: try again in 40 s' });
  assert.equal((await postForm(f, `/api/threads/${thread}/posts`, '5.5.5.5', { text: 'someone else' })).status, 201);
  /* two new threads per window */
  assert.equal((await postForm(f, '/api/threads', '3.3.3.3', { text: 'y' })).status, 201);
  assert.equal((await postForm(f, '/api/threads', '3.3.3.3', { text: 'z' })).status, 429);
});

test('uploads: checked, stored, served; bad ones refused', async () => {
  const before = blobs(f);
  let r = await postForm(f, '/api/threads', '6.6.6.6', { text: 'pic', image: jpeg(1600, 1200), density: jpeg(560, 420) });
  assert.equal(r.status, 201);
  const { thread } = await r.json();
  const t = await (await req(f, `/api/threads/${thread}`)).json();
  const im = t.posts[0].image;
  assert.match(im.density, /^\/api\/images\/t\/[a-z2-9]{10}\/[a-z2-9]{12}\.density\.jpg$/);
  assert.match(im.original, /^\/api\/images\/t\/[a-z2-9]{10}\/[a-z2-9]{12}\.jpg$/);
  assert.deepEqual([im.w, im.h, im.caption], [560, 420, 'a picture, posted here']);
  assert.equal(blobs(f), before + 2);
  const g = await req(f, im.original, { headers: { Origin: SITE } });
  assert.equal(g.status, 200);
  assert.equal(g.headers.get('content-type'), 'image/jpeg');
  assert.equal(g.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(g.headers.get('content-security-policy'), "default-src 'none'; sandbox");
  assert.equal(g.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  assert.equal(g.headers.get('cross-origin-resource-policy'), 'cross-origin');
  assert.equal(g.headers.get('access-control-allow-origin'), SITE);
  assert.equal((await g.arrayBuffer()).byteLength, 200);
  const board = await (await req(f, '/api/board')).json();
  assert.deepEqual(board.threads.find((x) => x.id === thread).image, im);
  /* a reply may be a picture alone */
  r = await postForm(f, `/api/threads/${thread}/posts`, '6.6.6.7', { image: jpeg(800, 600), density: jpeg(400, 300) });
  assert.equal(r.status, 201);
  /* an html file labelled as an image */
  r = await postForm(f, `/api/threads/${thread}/posts`, '7.7.7.7', { text: 'x', image: new Blob(['<html><script>1</script></html>'.padEnd(64)], { type: 'image/png' }), density: jpeg(560, 420) });
  assert.equal(r.status, 400);
  assert.deepEqual(await r.json(), { error: 'only jpeg, png, webp or gif' });
  /* a density map that is too large, and one without its original */
  r = await postForm(f, `/api/threads/${thread}/posts`, '8.8.8.8', { text: 'x', image: jpeg(800, 600), density: jpeg(1200, 900) });
  assert.deepEqual([r.status, await r.json()], [400, { error: 'the density map has the wrong size' }]);
  r = await postForm(f, `/api/threads/${thread}/posts`, '8.8.8.9', { text: 'x', density: jpeg(560, 420) });
  assert.deepEqual([r.status, await r.json()], [400, { error: 'a density map needs its original' }]);
  assert.equal(blobs(f), before + 4, 'nothing stored for refused uploads');
  /* text checks */
  r = await postForm(f, '/api/threads', '8.8.8.10', { text: '  \n ' });
  assert.deepEqual([r.status, await r.json()], [400, { error: 'a post needs words' }]);
  r = await postForm(f, '/api/threads', '8.8.8.11', { text: 'x'.repeat(2001) });
  assert.deepEqual([r.status, await r.json()], [400, { error: 'at most 2000 characters' }]);
  /* pictures that do not exist, or names outside the pattern */
  assert.equal((await req(f, `/api/images/t/${thread}/abcdefghjkmn.jpg`)).status, 404);
  assert.equal((await req(f, `/api/images/t/${thread}/x.svg`)).status, 404);
});

test('over 5 MB is refused before anything is read', async () => {
  const big = new Uint8Array(5 * 1024 * 1024 + 1);
  const r = await req(f, '/api/threads', { method: 'POST', headers: H('8.8.8.20', { 'content-type': 'application/octet-stream' }), body: big });
  assert.equal(r.status, 413);
  assert.deepEqual(await r.json(), { error: 'too large' });
});

test('reports and admin removal', async () => {
  const before = blobs(f);
  const { thread } = await (await postForm(f, '/api/threads', '9.9.9.9', { text: 'op', image: jpeg(900, 600), density: jpeg(560, 373) })).json();
  await postForm(f, `/api/threads/${thread}/posts`, '9.9.9.8', { text: 'bad words' });
  let r = await req(f, `/api/threads/${thread}/posts/2/report`, { method: 'POST', headers: H('9.9.9.7') });
  assert.deepEqual([r.status, await r.json()], [200, { ok: true }]);
  await req(f, `/api/threads/${thread}/posts/2/report`, { method: 'POST', headers: H('9.9.9.6') });
  r = await req(f, `/api/threads/${thread}/posts/9/report`, { method: 'POST', headers: H('9.9.9.6') });
  assert.deepEqual([r.status, await r.json()], [404, { error: 'no such post' }]);
  r = await req(f, '/api/admin/reports');
  assert.deepEqual([r.status, await r.json()], [403, { error: 'not allowed' }]);
  r = await req(f, '/api/admin/reports', { headers: admin });
  const { reports } = await r.json();
  assert.deepEqual(Object.keys(reports[0]), ['thread', 'n', 'count', 'at']);
  assert.deepEqual([reports[0].thread, reports[0].n, reports[0].count], [thread, 2, 2]);
  r = await req(f, `/api/threads/${thread}/posts/2`, { method: 'DELETE', headers: { Authorization: 'Bearer wrong' } });
  assert.equal(r.status, 403);
  r = await req(f, `/api/threads/${thread}/posts/2`, { method: 'DELETE', headers: admin });
  assert.deepEqual([r.status, await r.json()], [200, { ok: true, thread: 'kept' }]);
  const t = await (await req(f, `/api/threads/${thread}`)).json();
  assert.deepEqual(t.posts[1], { n: 2, created: t.posts[1].created, removed: true });
  assert.ok(!(await (await req(f, '/api/admin/reports', { headers: admin })).json()).reports.some((x) => x.thread === thread));
  /* removing the opening post removes the thread, its pictures and its place on the board */
  assert.equal(blobs(f), before + 2);
  r = await req(f, `/api/threads/${thread}/posts/1`, { method: 'DELETE', headers: admin });
  assert.equal((await r.json()).thread, 'removed');
  r = await req(f, `/api/threads/${thread}`);
  assert.deepEqual([r.status, await r.json()], [404, { error: 'this thread is gone' }]);
  assert.equal(blobs(f), before, 'its pictures are gone from R2');
  assert.ok(!(await (await req(f, '/api/board')).json()).threads.some((x) => x.id === thread));
  r = await req(f, `/api/threads/${thread}/posts/1`, { method: 'DELETE', headers: admin });
  assert.equal(r.status, 404);
  /* replies to a thread that is gone */
  r = await postForm(f, `/api/threads/${thread}/posts`, '9.9.9.5', { text: 'late' });
  assert.deepEqual([r.status, await r.json()], [404, { error: 'this thread is gone' }]);
});

test('CORS: the site origin only; preflight answered', async () => {
  let r = await req(f, '/api/board', { method: 'OPTIONS', headers: { Origin: SITE, 'Access-Control-Request-Method': 'POST' } });
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('access-control-allow-origin'), SITE);
  assert.equal(r.headers.get('access-control-allow-methods'), 'GET, POST, DELETE, OPTIONS');
  r = await req(f, '/api/board', { headers: { Origin: 'https://elsewhere.example' } });
  assert.equal(r.headers.get('access-control-allow-origin'), null);
  assert.equal(r.headers.get('vary'), 'Origin');
  r = await req(f, '/api/threads', { method: 'POST', headers: { Origin: 'https://elsewhere.example', 'CF-Connecting-IP': '1.2.3.4' }, body: form({ text: 'x' }) });
  assert.deepEqual([r.status, await r.json()], [403, { error: 'not from this site' }]);
  for (const p of ['/', '/api', '/api/nothing', '/api/threads/NOT-AN-ID', '/api/threads/abcdefghjk']) {
    r = await req(f, p);
    assert.equal(r.status, 404, p);
  }
});

test('turnstile: required when configured, refused without a secret', async (t) => {
  const failing = await start('forum', { ...base, TURNSTILE_SECRET: '2x0000000000000000000000000000000AA' });
  const none = await start('forum', base);
  const passing = await start('forum', { ...base, TURNSTILE_SECRET: '1x0000000000000000000000000000000AA' });
  try {
    let r = await postForm(failing, '/api/threads', '1.0.0.1', { text: 'x' });
    assert.deepEqual([r.status, await r.json()], [403, { error: 'the check did not pass' }]);
    r = await postForm(failing, '/api/threads', '1.0.0.2', { text: 'x', turnstile: 'XXXX.DUMMY.TOKEN.XXXX' });
    assert.equal(r.status, 403);
    /* a first deploy without TURNSTILE_SECRET (and without ALLOW_NO_TURNSTILE) refuses every post */
    r = await postForm(none, '/api/threads', '1.0.0.3', { text: 'x', turnstile: 'anything' });
    assert.equal(r.status, 403);
    r = await postForm(passing, '/api/threads', '1.0.0.4', { text: 'x', turnstile: 'XXXX.DUMMY.TOKEN.XXXX' });
    if (r.status === 403) t.diagnostic('siteverify unreachable from workerd here; the passing case was not checked');
    else assert.equal(r.status, 201);
  } finally { await failing.stop(); await none.stop(); await passing.stop(); }
});

test('without its salts the board takes no posts (and stores no hash of an address)', async () => {
  const { IP_SALT, POSTER_SALT, ...rest } = base;
  const bare = await start('forum', { ...rest, ALLOW_NO_TURNSTILE: '1' });
  try {
    let r = await postForm(bare, '/api/threads', '1.0.0.9', { text: 'x' });
    assert.deepEqual([r.status, await r.json()], [503, { error: 'the board is not open yet' }]);
    r = await req(bare, '/api/threads/abcdefghjk/posts/1/report', { method: 'POST', headers: H('1.0.0.9') });
    assert.equal(r.status, 503);
    assert.equal((await (await req(bare, '/api/board')).json()).threads.length, 0);
  } finally { await bare.stop(); }
});

/* every page of the board, from the top, following `next` */
async function allPages(w, limit) {
  const seen = [];
  let next = null, pages = 0;
  do {
    const q = new URLSearchParams();
    if (next) q.set('cursor', next);
    if (limit) q.set('limit', String(limit));
    const r = await req(w, '/api/board' + (q.size ? '?' + q : ''));
    assert.equal(r.status, 200);
    const b = await r.json();
    assert.deepEqual(Object.keys(b), ['threads', 'next']);
    assert.ok(b.next === null || typeof b.next === 'string');
    if (b.next !== null) assert.equal(b.threads.length, Math.min(limit || 40, 100), 'full pages until the last');
    seen.push(...b.threads);
    next = b.next;
    pages++;
    assert.ok(pages < 100, 'the pages end');
  } while (next);
  return { seen, pages };
}

test('the board is permanent: hundreds of threads, none lost, read page by page', async () => {
  const N = 260;
  const big = await start('forum', { ...base, ALLOW_NO_TURNSTILE: '1', RATE_THREADS: '1000', RATE_POSTS: '1000' });
  try {
    /* 260 threads, every 20th with a picture, ten at a time */
    const made = [];
    for (let i = 0; i < N; i += 10) {
      const batch = await Promise.all(Array.from({ length: Math.min(10, N - i) }, async (_, k) => {
        const j = i + k;
        const fields = { text: `thread ${j}` };
        if (j % 20 === 0) Object.assign(fields, { image: jpeg(900, 600), density: jpeg(560, 373) });
        const r = await postForm(big, '/api/threads', `3.0.${j >> 8}.${j & 255}`, fields);
        assert.equal(r.status, 201);
        return (await r.json()).thread;
      }));
      made.push(...batch);
    }
    assert.equal(new Set(made).size, N);
    const pictures = Math.ceil(N / 20) * 2;
    assert.equal(blobs(big), pictures);

    /* the first page alone, as the page before pages reads it: 40 threads, the newest first, and a cursor */
    const first = await (await req(big, '/api/board')).json();
    assert.equal(first.threads.length, 40);
    assert.match(first.next, /^\d+-\d+$/);
    assert.deepEqual(Object.keys(first.threads[0]), ['id', 'first', 'replies', 'created', 'bumped', 'image']);

    /* every page, at the default size, at 100, and at 1000 (kept to 100): every thread once, in board order */
    const sorted = (xs) => [...xs].sort();
    for (const limit of [undefined, 100, 1000, 7]) {
      const { seen, pages } = await allPages(big, limit);
      const ids = seen.map((t) => t.id);
      assert.equal(ids.length, N, `limit ${limit}: no thread lost`);
      assert.equal(new Set(ids).size, N, `limit ${limit}: no thread twice`);
      assert.deepEqual(sorted(ids), sorted(made));
      assert.equal(pages, Math.ceil(N / Math.min(limit || 40, 100)));
      for (let k = 1; k < seen.length; k++) assert.ok(seen[k - 1].bumped >= seen[k].bumped, 'newest activity first');
    }

    /* a reply moves the oldest thread to the top; a visitor already paging does not see it twice */
    const p1 = await (await req(big, '/api/board')).json();
    const oldest = made[0];
    assert.equal((await postForm(big, `/api/threads/${oldest}/posts`, '3.1.0.1', { text: 'still here' })).status, 201);
    const rest = [];
    for (let next = p1.next; next;) {
      const b = await (await req(big, '/api/board?cursor=' + next)).json();
      rest.push(...b.threads.map((t) => t.id));
      next = b.next;
    }
    const after = p1.threads.map((t) => t.id).concat(rest);
    assert.equal(new Set(after).size, after.length, 'no thread twice while paging');
    assert.equal(after.length, N - 1, 'the bumped thread left the pages below for the top');
    const top = await (await req(big, '/api/board?limit=1')).json();
    assert.equal(top.threads[0].id, oldest);
    assert.equal(top.threads[0].replies, 1);

    /* old threads and their pictures are still served */
    const t0 = await (await req(big, `/api/threads/${made[0]}`)).json();
    assert.equal(t0.posts[0].text, 'thread 0');
    for (const u of [t0.posts[0].image.original, t0.posts[0].image.density]) {
      const g = await req(big, u);
      assert.equal(g.status, 200, u);
      assert.equal(g.headers.get('cache-control'), 'public, max-age=31536000, immutable');
      assert.equal((await g.arrayBuffer()).byteLength, 200);
    }
    assert.equal((await req(big, `/api/threads/${made[1]}`)).status, 200);
    assert.equal(blobs(big), pictures, 'no picture deleted');

    /* reports only count: the reported post and its picture stay */
    const pic = made[20];
    for (const ip of ['3.2.0.1', '3.2.0.2', '3.2.0.3']) {
      assert.equal((await req(big, `/api/threads/${pic}/posts/1/report`, { method: 'POST', headers: H(ip) })).status, 200);
    }
    const reported = await (await req(big, `/api/threads/${pic}`)).json();
    assert.equal(reported.posts[0].text, 'thread 20');
    assert.ok(reported.posts[0].image);
    assert.equal(blobs(big), pictures);
    const { reports } = await (await req(big, '/api/admin/reports', { headers: admin })).json();
    assert.deepEqual([reports[0].thread, reports[0].count], [pic, 3]);

    /* the admin's removal is the one way out: the thread, its pictures, its place on the board */
    let r = await req(big, `/api/threads/${pic}/posts/1`, { method: 'DELETE', headers: admin });
    assert.deepEqual(await r.json(), { ok: true, thread: 'removed' });
    assert.equal((await req(big, `/api/threads/${pic}`)).status, 404);
    assert.equal((await req(big, reported.posts[0].image.original)).status, 404);
    assert.equal(blobs(big), pictures - 2);
    const left = (await allPages(big)).seen.map((t) => t.id);
    assert.equal(left.length, N - 1);
    assert.ok(!left.includes(pic));

    /* refusals */
    r = await req(big, '/api/board?cursor=abc');
    assert.deepEqual([r.status, await r.json()], [400, { error: 'bad cursor' }]);
    const end = await (await req(big, '/api/board?cursor=0-0')).json();
    assert.deepEqual(end, { threads: [], next: null }, 'below the first thread there is nothing');

    /* the v2 migration ran, and the page scan walks its index */
    assert.deepEqual((await query(big.state, 'SELECT version FROM schema_version')).map((x) => x.version), [2]);
    const idx = (await query(big.state, "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'threads'")).map((x) => x.name);
    assert.ok(idx.includes('threads_bumped_seq'), idx.join());
    assert.ok(idx.includes('threads_seq'), 'v1 index kept, for MAX(seq)');
    const plan = (await query(big.state, 'EXPLAIN QUERY PLAN SELECT id, first, replies, created, bumped, image, seq FROM threads WHERE (bumped, seq) < (1e15, 100) ORDER BY bumped DESC, seq DESC LIMIT 41'))
      .map((x) => x.detail).join(' | ');
    assert.match(plan, /USING INDEX threads_bumped_seq \(\(bumped,seq\)<\(\?,\?\)\)/, plan);
    assert.doesNotMatch(plan, /TEMP B-TREE/, plan);
  } finally { await big.stop(); }
});
