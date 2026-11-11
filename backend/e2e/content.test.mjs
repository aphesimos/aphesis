// The content service end to end, under wrangler dev with a local D1 and R2: the seed, the public API, the gate
// (password, the email captured by a local stand-in for Resend's API, the code, the session, CSRF, lockout), the
// dashboard's writes for each kind of entry, uploads, and moderation against local wall and forum Workers.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pbkdf2Sync } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { start, wrangler, root, sleep, fixtureCommit } from './dev.mjs';

const SITE = 'http://localhost:8000';
const PASSWORD = 'salt sulphur mercury and a long walk';
const salt = Buffer.from('00112233445566778899aabbccddeeff', 'hex');
const HASH = `pbkdf2-sha256$25000$${salt.toString('base64')}$${pbkdf2Sync(PASSWORD, salt, 25000, 32, 'sha256').toString('base64')}`;
const vars = { ALLOWED_ORIGINS: SITE, OWNER_PASSWORD_HASH: HASH, OWNER_EMAIL: 'owner@example.com', EMAIL_FROM: 'clavis@aphes.ist', AUTH_SALT: 'test-salt' };

/* the content the seed imports: the tests bring their own (the section branches may carry none), with one entry of
   each kind marked example, which the seed must skip */
const ARCHIVE = fixtureCommit({
  'archive/content/on-mercury.md': '---\ntitle: on mercury\ndate: 2026-02-01\nstage: rubedo\nsummary: a post the tests bring.\n---\n' +
    'the quick metal.[^quick]\n\n![saint jerome writing · Caravaggio, 1605–06](simulacrum:jerome)\n\n[^quick]: quicksilver, the living metal.\n',
  'archive/content/on-lead.md': '---\ntitle: on lead\ndate: 2026-01-15\nstage: nigredo\nsummary: an older one.\n---\nheavy.\n',
  'archive/content/a-shown-post.md': '---\ntitle: a shown post\ndate: 2026-03-01\nstage: albedo\nsummary: written to show.\nexample: true\n---\nshown.\n',
});
const BOOK = fixtureCommit({
  'book/content/01-the-tablet.md': '---\ntitle: the tablet\nauthor: Hermes Trismegistus\nyear: c. 800\nmap: trismegistus.png\n' +
    'caption: hermes trismegistus · Siena Cathedral pavement, 1488\ncrop: 10 10 400 400\n---\none.\n\ntwo.\n',
  'book/content/02-the-stone.md': '---\ntitle: the stone\nauthor: Goethe\nyear: 1808\nmap: faust.jpg\ncaption: faust · Rembrandt, c. 1652\n' +
    'quote: Verweile doch! du bist so schön!\nquote_lang: de\nquote_en: stay a while! you are so beautiful!\n---\na note.\n',
  'book/content/03-a-shown-entry.md': '---\ntitle: a shown entry\nauthor: nobody\nyear: 2026\nmap: jerome.jpg\ncaption: a caption\nexample: true\n---\nshown.\n',
});

let c, wall, forum, gh, resend, seeded = '';
/* a stand-in for Resend's `POST /emails`: keeps every request, answers as `mode` says (ok, fail, hang) */
function fakeResend() {
  const sent = [];
  const state = { mode: 'ok' };
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      let json = null;
      try { json = JSON.parse(body); } catch (_) { /* kept as null */ }
      sent.push({ method: req.method, url: req.url, auth: req.headers.authorization, type: req.headers['content-type'], ua: req.headers['user-agent'], json, ...json });
      if (state.mode === 'hang') return; /* never answers: the Worker must give up on its own */
      if (state.mode === 'fail') { res.writeHead(500, { 'content-type': 'application/json' }); return res.end('{"name":"internal_server_error","message":"resend is down"}'); }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: `m-${sent.length}` }));
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${server.address().port}`, sent, state,
    close: () => { server.closeAllConnections(); server.close(); } })));
}
/* a stand-in for GitHub's git data API: refs, trees and commits in memory, as the export uses them */
function fakeGitHub() {
  const refs = {}, trees = {}, commits = {}, calls = [];
  const sha = (o) => createHash('sha1').update(JSON.stringify(o)).digest('hex');
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      calls.push({ method: req.method, url: req.url, auth: req.headers.authorization, ua: req.headers['user-agent'] });
      const j = body ? JSON.parse(body) : null;
      const send = (st, o) => { res.writeHead(st, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
      let m;
      if (req.headers.authorization !== 'Bearer gh-token') return send(401, { message: 'Bad credentials' });
      if (req.method === 'GET' && (m = req.url.match(/^\/repos\/o\/r\/git\/ref\/heads\/(.+)$/))) return refs[m[1]] ? send(200, { object: { sha: refs[m[1]] } }) : send(404, {});
      if (req.method === 'GET' && (m = req.url.match(/^\/repos\/o\/r\/git\/commits\/(\w+)$/))) return send(200, { tree: { sha: commits[m[1]].tree } });
      if (req.method === 'POST' && req.url === '/repos/o/r/git/trees') { const s = sha(j.tree); trees[s] = j.tree; return send(201, { sha: s }); }
      if (req.method === 'POST' && req.url === '/repos/o/r/git/commits') { const s = sha(j); commits[s] = j; return send(201, { sha: s }); }
      if (req.method === 'POST' && req.url === '/repos/o/r/git/refs') { refs[j.ref.replace('refs/heads/', '')] = j.sha; return send(201, {}); }
      if (req.method === 'PATCH' && (m = req.url.match(/^\/repos\/o\/r\/git\/refs\/heads\/(.+)$/))) { refs[m[1]] = j.sha; return send(200, {}); }
      send(404, {});
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${server.address().port}`, refs, trees, commits, calls, close: () => server.close() })));
}
function migrateAndSeed(state) {
  wrangler('content', ['d1', 'migrations', 'apply', 'aphesis-content', '--local', '--persist-to', state]);
  const r = spawnSync(process.execPath, [path.join(root, 'content', 'tools', 'seed.mjs'), '--local', '--persist-to', state, '-c', 'wrangler.e2e.toml'],
    { encoding: 'utf8', env: { ...process.env, ARCHIVE_REF: ARCHIVE, BOOK_REF: BOOK } });
  if (r.status !== 0) throw new Error(r.stdout + r.stderr);
  seeded = r.stdout;
}
before(async () => {
  [gh, resend] = await Promise.all([fakeGitHub(), fakeResend()]);
  [wall, forum] = await Promise.all([
    start('wall', { ALLOW_NO_TURNSTILE: '1', HASH_SALT: 'w', ADMIN_TOKEN: 'wall-admin', ALLOWED_ORIGINS: SITE }),
    start('forum', { ALLOW_NO_TURNSTILE: '1', IP_SALT: 'a', POSTER_SALT: 'b', ADMIN_SECRET: 'forum-admin', ALLOWED_ORIGINS: SITE }),
  ]);
  c = await start('content', { ...vars, WALL_API: wall.url, FORUM_API: forum.url, WALL_ADMIN_TOKEN: 'wall-admin', FORUM_ADMIN_SECRET: 'forum-admin',
    GITHUB_API: gh.url, EXPORT_GITHUB_TOKEN: 'gh-token', EXPORT_REPO: 'o/r', EXPORT_BRANCH: 'content',
    MAIL_API: resend.url, RESEND_API_KEY: 're_test_key' },
    { prepare: migrateAndSeed, logLevel: 'info' });
});
after(async () => { if (process.env.E2E_LOG) console.error(c?.log()); await Promise.all([c?.stop(), wall?.stop(), forum?.stop()]); gh?.close(); resend?.close(); });

/* a small cookie jar: the browser's part, done by hand */
function jar() {
  const kept = new Map();
  return {
    take(r) { for (const sc of r.headers.getSetCookie()) { const [kv, ...attrs] = sc.split(';'); const [k, v] = kv.split('='); if (v) kept.set(k.trim(), { v, attrs: attrs.map((a) => a.trim()) }); else kept.delete(k.trim()); } },
    header() { return [...kept].map(([k, { v }]) => `${k}=${v}`).join('; '); },
    get(k) { return kept.get(k); },
  };
}
const send = (p, { method = 'GET', body, j, ip = '10.0.0.1', origin = SITE, headers = {} } = {}) => fetch(c.url + p, {
  method, headers: { 'CF-Connecting-IP': ip, ...(origin ? { Origin: origin } : {}), ...(j ? { Cookie: j.header() } : {}),
    ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...headers },
  body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
});

/* the mails the Worker posted to the stand-in for Resend, newest last: {auth, json, from, to, subject, html, text} */
function mails() {
  return resend.sent;
}
async function nextMail(before) {
  for (let i = 0; i < 50; i++) { const m = mails(); if (m.length > before) return m[m.length - 1]; await sleep(100); }
  throw new Error('no mail:\n' + c.log());
}
async function login(ip = '10.0.0.9') {
  const j = jar();
  const n = mails().length;
  let r = await send('/v1/auth/password', { method: 'POST', body: { password: PASSWORD }, ip });
  assert.equal(r.status, 200, await r.clone().text());
  j.take(r);
  const mail = await nextMail(n);
  const words = mail.text.trim().split('\r\n').pop();
  r = await send('/v1/auth/code', { method: 'POST', body: { code: words }, j, ip });
  assert.equal(r.status, 200);
  j.take(r);
  const { csrf } = await r.json();
  return { j, csrf, mail, words };
}

test('the seed: everything on the section branches but examples, published, with its pictures', async () => {
  let r = await send('/v1/posts');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('access-control-allow-origin'), SITE);
  assert.match(r.headers.get('cache-control'), /public/);
  const { posts } = await r.json();
  assert.deepEqual(posts.map((p) => p.slug), ['on-mercury', 'on-lead'], 'newest first, and the example is not there');
  const mercury = posts[0];
  assert.equal(mercury.stage, 'rubedo');
  assert.equal(mercury.notes[0].id, 'quick');
  assert.ok(!mercury.body.includes('[^quick]:'), 'notes are kept apart from the body');
  assert.match(mercury.figures[0].url, /\/media\/m\/[0-9a-f]{24}\.(png|jpg)$/);
  const { books } = await (await send('/v1/books')).json();
  assert.deepEqual(books.map((b) => b.slug), ['the-tablet', 'the-stone']);
  assert.ok(books[0].adjust.crop.length === 4);
  assert.match(seeded, /skipped posts\/a-shown-post: marked example/);
  assert.match(seeded, /skipped books\/a-shown-entry: marked example/);
  assert.equal((await send('/v1/posts/a-shown-post')).status, 404);
  const w = await (await send('/v1/works')).json();
  assert.deepEqual(w.works.map((x) => x.id), ['heild', 'aphesis']);
  assert.equal(w.section.gloss, 'opera');
  assert.equal(w.works[0].sources, undefined, 'sources stay out of the public answer');
  r = await fetch(w.works[0].map.url);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'image/png');
  assert.match(r.headers.get('cache-control'), /max-age=31536000, immutable/);
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
  r = await send('/v1/books/the-stone');
  assert.equal((await r.json()).book.quote_lang, 'de');
  assert.equal((await send('/v1/books/nothing')).status, 404);
  assert.equal((await send('/media/../secret')).status, 404);
  r = await send('/v1/posts', { origin: 'https://evil.example' });
  assert.equal(r.headers.get('access-control-allow-origin'), null);
});

test('the gate: password, the mail, three words, a session; wrong answers all look alike', async () => {
  let r = await send('/v1/auth/password', { method: 'POST', body: { password: 'wrong' }, ip: '10.1.0.1' });
  assert.equal(r.status, 401);
  const wrongPw = await r.text();
  assert.equal(wrongPw, '{"error":"no"}');
  assert.equal((await send('/v1/auth/password', { method: 'POST', body: { password: PASSWORD }, origin: 'https://evil.example', ip: '10.1.0.1' })).status, 403);

  const j = jar();
  const n = mails().length;
  r = await send('/v1/auth/password', { method: 'POST', body: { password: PASSWORD }, ip: '10.1.0.1' });
  assert.equal(r.status, 200);
  j.take(r);
  const pending = j.get('aph_pending');
  for (const a of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/v1/auth', 'Max-Age=600']) assert.ok(pending.attrs.includes(a), a);

  const mail = await nextMail(n);
  assert.equal(mail.method, 'POST');
  assert.equal(mail.url, '/emails');
  assert.equal(mail.auth, 'Bearer re_test_key');
  assert.match(mail.type, /^application\/json/);
  assert.ok(mail.ua, 'a User-Agent');
  assert.deepEqual(Object.keys(mail.json), ['from', 'to', 'subject', 'html', 'text']);
  assert.equal(mail.subject, 'clavis');
  assert.equal(mail.from, 'clavis@aphes.ist');
  assert.equal(mail.to, 'owner@example.com');
  const { html, text } = mail;
  assert.match(html, /background:#050404/);
  assert.match(html, /<img src="http:\/\/127\.0\.0\.1:\d+\/media\/mail\/phi\.png"/);
  assert.match(html, /font-family:'Special Elite', 'Courier New', Courier, 'Lucida Console', monospace/);
  for (const said of ['verification', 'code', 'request', 'ignore', "didn't"]) assert.ok(!(html + text).toLowerCase().includes(said), said);
  const words = text.trim().split('\r\n').pop();
  assert.match(words, /^[a-z]{3,8} · [a-z]{3,8} · [a-z]{3,8}$/);
  const phi = await fetch(html.match(/<img src="([^"]+)"/)[1]);
  assert.equal(phi.status, 200);
  assert.equal(phi.headers.get('content-type'), 'image/png');

  r = await send('/v1/auth/code', { method: 'POST', body: { code: 'aqua terra ignis' }, j, ip: '10.1.0.1' });
  assert.equal(r.status, 401);
  assert.equal(await r.text(), wrongPw, 'a wrong code reads exactly as a wrong password');
  r = await send('/v1/auth/code', { method: 'POST', body: { code: words.toUpperCase().replace(/ · /g, '-') }, j, ip: '10.1.0.1' });
  assert.equal(r.status, 200);
  j.take(r);
  const { csrf, expires } = await r.json();
  assert.match(csrf, /^[0-9a-f]{48}$/);
  assert.ok(expires > Date.now() + 7000 * 1000);
  const session = j.get('aph_session');
  for (const a of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/', 'Max-Age=7200']) assert.ok(session.attrs.includes(a), a);
  assert.equal(j.get('aph_pending'), undefined, 'the pending cookie is cleared');

  r = await send('/v1/auth/session', { j });
  assert.deepEqual([(await r.json()).open, csrf.length], [true, 48]);
  r = await send('/v1/auth/session', { j });
  assert.equal((await r.json()).csrf, csrf);
  /* single use: the same words again, with the old pending cookie, are refused */
  r = await send('/v1/auth/code', { method: 'POST', body: { code: words }, ip: '10.1.0.1', headers: { Cookie: `aph_pending=${pending.v}` } });
  assert.equal(r.status, 401);
  r = await send('/v1/auth/logout', { method: 'POST', j, headers: { 'X-CSRF-Token': csrf } });
  assert.equal(r.status, 200);
  j.take(r);
  r = await send('/v1/auth/session', { j });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { open: false });
});

test('a code is good for ten minutes, and a new password step replaces it', async () => {
  const j = jar();
  let n = mails().length;
  let r = await send('/v1/auth/password', { method: 'POST', body: { password: PASSWORD }, ip: '10.2.0.1' });
  j.take(r);
  const first = (await nextMail(n)).text.trim().split('\r\n').pop();
  /* age the challenge past its ten minutes, in the local D1 file */
  const { DatabaseSync } = await import('node:sqlite');
  const dir = path.join(c.state, 'v3', 'd1', 'miniflare-D1DatabaseObject');
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.sqlite'))) {
    const db = new DatabaseSync(path.join(dir, f));
    try { db.prepare('UPDATE challenges SET expires = 1').run(); } catch (_) { /* another database */ } finally { db.close(); }
  }
  r = await send('/v1/auth/code', { method: 'POST', body: { code: first }, j, ip: '10.2.0.1' });
  assert.equal(r.status, 401, 'expired');
  n = mails().length;
  const j2 = jar();
  r = await send('/v1/auth/password', { method: 'POST', body: { password: PASSWORD }, ip: '10.2.0.1' });
  j2.take(r);
  const second = (await nextMail(n)).text.trim().split('\r\n').pop();
  n = mails().length;
  r = await send('/v1/auth/password', { method: 'POST', body: { password: PASSWORD }, ip: '10.2.0.1' });
  const j3 = jar(); j3.take(r);
  const third = (await nextMail(n)).text.trim().split('\r\n').pop();
  assert.equal((await send('/v1/auth/code', { method: 'POST', body: { code: second }, j: j2, ip: '10.2.0.1' })).status, 401, 'replaced');
  assert.equal((await send('/v1/auth/code', { method: 'POST', body: { code: third }, j: j3, ip: '10.2.0.1' })).status, 200);
});

test('when Resend fails or does not answer, the gate says only "unavailable", and the words it tried are void', async () => {
  for (const [mode, ip] of [['fail', '10.5.0.1'], ['hang', '10.5.0.2']]) {
    resend.state.mode = mode;
    try {
      const n = mails().length;
      const t = Date.now();
      const r = await send('/v1/auth/password', { method: 'POST', body: { password: PASSWORD }, ip });
      assert.equal(r.status, 503, mode);
      assert.equal(await r.text(), '{"error":"unavailable"}', 'nothing about the mail API reaches the visitor');
      assert.deepEqual(r.headers.getSetCookie(), [], 'no pending cookie');
      if (mode === 'hang') assert.ok(Date.now() - t < 20_000, 'given up on its own');
      const words = (await nextMail(n)).text.trim().split('\r\n').pop();
      resend.state.mode = 'ok';
      const j = jar();
      j.take(await send('/v1/auth/password', { method: 'POST', body: { password: PASSWORD }, ip }));
      /* the failed attempt's words never open the gate, even with a fresh pending cookie */
      assert.equal((await send('/v1/auth/code', { method: 'POST', body: { code: words }, j, ip })).status, 401, mode);
    } finally { resend.state.mode = 'ok'; }
  }
  assert.match(c.log(), /the mail did not go: 500 from the mail API/);
});

test('lockout: after a few failures even the right password is refused, the same way', async () => {
  const ip = '10.3.0.1';
  for (let i = 0; i < 5; i++) assert.equal((await send('/v1/auth/password', { method: 'POST', body: { password: 'nope' + i }, ip })).status, 401);
  const n = mails().length;
  const r = await send('/v1/auth/password', { method: 'POST', body: { password: PASSWORD }, ip });
  assert.equal(r.status, 401);
  assert.equal(await r.text(), '{"error":"no"}');
  await sleep(300);
  assert.equal(mails().length, n, 'no mail while locked');
  /* another visitor is not locked out */
  await login('10.3.0.2');
});

test('the code step counts toward the lockout too, and a challenge takes five tries at most', async () => {
  const ip = '10.4.0.1';
  const j = jar();
  const n = mails().length;
  let r = await send('/v1/auth/password', { method: 'POST', body: { password: PASSWORD }, ip });
  j.take(r);
  const words = (await nextMail(n)).text.trim().split('\r\n').pop();
  for (let i = 0; i < 5; i++) assert.equal((await send('/v1/auth/code', { method: 'POST', body: { code: 'lux nox dies' }, j, ip })).status, 401);
  r = await send('/v1/auth/code', { method: 'POST', body: { code: words }, j, ip });
  assert.equal(r.status, 401, 'locked, and the challenge is spent');
});

test('the dashboard needs the session, and writes need the origin and the CSRF token', async () => {
  const { j, csrf } = await login();
  assert.equal((await send('/v1/admin/posts')).status, 401);
  assert.equal((await send('/v1/admin/posts', { j })).status, 200);
  const post = { slug: 'on-salt', title: 'on salt', summary: 'a line.', stage: 'nigredo', date: '2026-12-01', body: 'salt.', notes: [], figures: [] };
  assert.equal((await send('/v1/admin/posts/on-salt', { method: 'PUT', body: post, j })).status, 403, 'no token');
  assert.equal((await send('/v1/admin/posts/on-salt', { method: 'PUT', body: post, j, headers: { 'X-CSRF-Token': 'x' + csrf.slice(1) } })).status, 403, 'wrong token');
  assert.equal((await send('/v1/admin/posts/on-salt', { method: 'PUT', body: post, j, origin: 'https://evil.example', headers: { 'X-CSRF-Token': csrf } })).status, 403, 'wrong origin');
  assert.equal((await send('/v1/admin/posts/on-salt', { method: 'PUT', body: post, j, origin: null, headers: { 'X-CSRF-Token': csrf } })).status, 403, 'no origin');
  const r = await send('/v1/admin/posts/on-salt', { method: 'OPTIONS', headers: { 'Access-Control-Request-Method': 'PUT' } });
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('access-control-allow-credentials'), 'true');
  assert.match(r.headers.get('access-control-allow-headers'), /X-CSRF-Token/);
  assert.match(r.headers.get('access-control-allow-methods'), /PUT/);
});

function png(w, h) {
  const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = c >>> 1 ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (t, d) => { const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length); b.write(t, 4); d.copy(b, 8); b.writeUInt32BE(crc(b.subarray(4, 8 + d.length)), 8 + d.length); return b; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 0;
  const raw = Buffer.alloc((w + 1) * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw[y * (w + 1) + 1 + x] = (x * y) & 255;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

test('posts, book entries and works: create, edit, preview, publish, rename, delete; uploads', async () => {
  const { j, csrf } = await login();
  const W = (p, method, body) => send(p, { method, body, j, headers: { 'X-CSRF-Token': csrf } });
  /* an upload: the density map the browser made */
  let fd = new FormData(); fd.append('file', new Blob([png(480, 320)], { type: 'image/png' }), 'map.png');
  let r = await W('/v1/admin/media', 'POST', fd);
  assert.equal(r.status, 201);
  const pic = await r.json();
  assert.match(pic.key, /^m\/[0-9a-f]{24}\.png$/);
  assert.deepEqual([pic.w, pic.h], [480, 320]);
  assert.equal((await fetch(pic.url)).status, 200);
  fd = new FormData(); fd.append('file', new Blob([png(700, 320)], { type: 'image/png' }), 'big.png');
  assert.equal((await W('/v1/admin/media', 'POST', fd)).status, 400);
  fd = new FormData(); fd.append('file', new Blob(['GIF89a' + 'x'.repeat(40)], { type: 'image/png' }), 'x.png');
  assert.equal((await W('/v1/admin/media', 'POST', fd)).status, 400);

  /* a post: a draft first, invisible to the public API, then published */
  const post = { slug: 'on-salt', title: 'on salt', summary: 'a line.', stage: 'nigredo', date: '2026-12-01',
    body: 'salt.[^s]\n\n![salt · a test](simulacrum:salt)', notes: [{ id: 's', text: 'a note.' }], figures: [{ name: 'salt', key: pic.key, w: 480, h: 320 }] };
  r = await W('/v1/admin/posts/on-salt', 'PUT', post);
  assert.equal(r.status, 201);
  assert.equal((await r.json()).post.published, false);
  assert.equal((await send('/v1/posts/on-salt')).status, 404);
  r = await send('/v1/admin/posts/on-salt', { j });
  assert.equal((await r.json()).post.figures[0].url, pic.url, 'the preview answers as the public API will');
  r = await W('/v1/admin/posts/on-salt', 'PUT', { ...post, stage: 'albedo', title: 'on salt, again' });
  assert.equal(r.status, 200);
  assert.equal((await W('/v1/admin/posts/on-salt', 'PUT', { ...post, stage: 'viriditas' })).status, 400);
  assert.equal((await W('/v1/admin/posts/on-salt/publish', 'POST')).status, 200);
  r = await send('/v1/posts/on-salt');
  assert.equal((await r.json()).post.title, 'on salt, again');
  r = await W('/v1/admin/posts/on-salt', 'PUT', { ...post, slug: 'on-mercury' });
  assert.equal(r.status, 409);
  r = await W('/v1/admin/posts/on-salt', 'PUT', { ...post, slug: 'on-salt-and-sulphur' });
  assert.equal(r.status, 200);
  assert.equal((await send('/v1/posts/on-salt-and-sulphur')).status, 200, 'renamed, still published');
  assert.equal((await W('/v1/admin/posts/on-salt-and-sulphur/unpublish', 'POST')).status, 200);
  assert.equal((await send('/v1/posts/on-salt-and-sulphur')).status, 404);
  assert.equal((await W('/v1/admin/posts/on-salt-and-sulphur', 'DELETE')).status, 200);
  assert.equal((await send('/v1/admin/posts/on-salt-and-sulphur', { j })).status, 404);

  /* a book entry */
  const book = { slug: 'the-alchemist', title: 'the alchemist', author: 'Joseph Wright of Derby', year: '1771', note: 'one.\n\ntwo.',
    quote: 'Solve et coagula', quote_lang: 'la', quote_en: 'dissolve and coagulate.', caption: 'the alchemist · Wright of Derby, 1771',
    picture: { key: pic.key, w: 480, h: 320 }, adjust: { gain: 1.1, crop: [0, 0, 400, 300] }, position: 7 };
  assert.equal((await W('/v1/admin/books/the-alchemist', 'PUT', book)).status, 201);
  assert.equal((await W('/v1/admin/books/the-alchemist/publish', 'POST')).status, 200);
  let { books } = await (await send('/v1/books')).json();
  assert.equal(books[books.length - 1].slug, 'the-alchemist');
  assert.deepEqual(books[books.length - 1].note, ['one.', 'two.']);
  assert.equal((await W('/v1/admin/books/the-alchemist', 'PUT', { ...book, position: 0 })).status, 200);
  ({ books } = await (await send('/v1/books')).json());
  assert.equal(books[0].slug, 'the-alchemist', 'order follows position');
  assert.equal((await W('/v1/admin/books/the-alchemist', 'DELETE')).status, 200);

  /* a work */
  const work = { id: 'salt', name: 'salt', gloss: 'sal', gloss_tip: 'sal · salt', year: '2026', role: 'author', description: 'a test.',
    links: [{ label: 'the site', href: 'https://example.com' }], map: { key: pic.key, w: 480, h: 320, caption: 'a map', settings: { scatter: 0.6 } } };
  assert.equal((await W('/v1/admin/works/salt', 'PUT', work)).status, 201);
  assert.equal((await W('/v1/admin/works/salt', 'PUT', { ...work, links: [{ label: 'x', href: 'javascript:alert(1)' }] })).status, 400);
  assert.equal((await W('/v1/admin/works/salt/publish', 'POST')).status, 200);
  const w = await (await send('/v1/works')).json();
  assert.ok(w.works.some((x) => x.id === 'salt' && x.map.url === pic.url));
  assert.equal((await W('/v1/admin/works/salt', 'DELETE')).status, 200);
  assert.equal((await W('/v1/admin/works/salt', 'DELETE')).status, 404);
});

test('moderation through the content service: the wall and the forum, server to server', async () => {
  const { j, csrf } = await login();
  const W = (p, method) => send(p, { method, j, headers: { 'X-CSRF-Token': csrf } });
  /* a line on the wall, then gone */
  let r = await fetch(wall.url + '/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: SITE, 'CF-Connecting-IP': '9.9.9.9' }, body: JSON.stringify({ text: 'a line to remove' }) });
  assert.equal(r.status, 201);
  const { message } = await r.json();
  r = await send('/v1/admin/wall', { j });
  assert.ok((await r.json()).messages.some((m) => m.id === message.id));
  assert.equal((await W(`/v1/admin/wall/${message.id}`, 'DELETE')).status, 200);
  assert.ok(!(await (await send('/v1/admin/wall', { j })).json()).messages.some((m) => m.id === message.id));
  assert.equal((await send(`/v1/admin/wall/${message.id}`, { method: 'DELETE', j })).status, 403, 'no token, no removal');

  /* a forum thread with a reply, reported, then the reply removed, then the thread */
  const post = async (p, text) => { const fd = new FormData(); fd.append('text', text); return fetch(forum.url + p, { method: 'POST', headers: { Origin: SITE, 'CF-Connecting-IP': '8.8.8.8' }, body: fd }); };
  r = await post('/api/threads', 'a thread');
  const { thread } = await r.json();
  await post(`/api/threads/${thread}/posts`, 'a reply to report');
  r = await fetch(`${forum.url}/api/threads/${thread}/posts/2/report`, { method: 'POST', headers: { Origin: SITE, 'CF-Connecting-IP': '7.7.7.7' } });
  assert.equal(r.status, 200);
  r = await send('/v1/admin/forum/reports', { j });
  assert.ok((await r.json()).reports.some((x) => x.thread === thread && x.n === 2));
  r = await send('/v1/admin/forum/board', { j });
  const board = await r.json();
  assert.ok(board.threads.some((t) => t.id === thread));
  assert.ok('next' in board, 'the board comes a page at a time');
  r = await send('/v1/admin/forum/board?cursor=99999999999999-1', { j });
  assert.equal(r.status, 200, 'a cursor passes through');
  assert.equal((await send('/v1/admin/forum/board?cursor=x%26limit%3D1', { j })).status, 400, 'anything else is refused');
  r = await send(`/v1/admin/forum/threads/${thread}`, { j });
  assert.equal((await r.json()).posts.length, 2);
  r = await W(`/v1/admin/forum/threads/${thread}/posts/2`, 'DELETE');
  assert.deepEqual(await r.json(), { ok: true, thread: 'kept' });
  r = await W(`/v1/admin/forum/threads/${thread}/posts/1`, 'DELETE');
  assert.deepEqual(await r.json(), { ok: true, thread: 'removed' });
  assert.equal((await send('/v1/admin/forum/reports')).status, 401, 'no session, no moderation');
});

test('the nightly export: every entry as the section files, committed as the owner, only when it changed', async () => {
  const { j, csrf } = await login();
  const W = (p, method, body) => send(p, { method, body, j, headers: { 'X-CSRF-Token': csrf } });
  /* a draft goes out too */
  const post = { slug: 'a-draft', title: 'a draft', summary: 'not yet.', stage: 'nigredo', date: '2026-12-02', body: 'soon.[^n]', notes: [{ id: 'n', text: 'a note.' }], figures: [] };
  assert.equal((await W('/v1/admin/posts/a-draft', 'PUT', post)).status, 201);
  let r = await W('/v1/admin/export', 'POST');
  assert.equal(r.status, 200);
  let out = await r.json();
  assert.equal(out.committed, true);
  const commit = gh.commits[gh.refs.content];
  assert.deepEqual([commit.author.name, commit.author.email], ['aphesimos', '126630868+aphesimos@users.noreply.github.com']);
  assert.deepEqual(commit.committer.name, 'aphesimos');
  assert.ok(!/co-authored|claude|session/i.test(commit.message));
  assert.deepEqual(commit.parents, []);
  const files = Object.fromEntries(gh.trees[commit.tree].map((e) => [e.path, e.content]));
  assert.ok(files['archive/content/on-mercury.md'].includes('[^quick]: quicksilver'));
  assert.match(files['archive/content/a-draft.md'], /^---\ntitle: a draft\n[\s\S]*published: false\n---\nsoon\.\[\^n\]\n\n\[\^n\]: a note\.\n$/);
  assert.ok(files['book/content/02-the-stone.md'].includes('quote_lang: de'));
  assert.equal(JSON.parse(files['works/content/works.json']).works.length, 2);
  assert.ok(gh.calls.every((x) => x.ua === 'aphes.ist-content'));
  /* nothing changed: no new commit */
  r = await W('/v1/admin/export', 'POST');
  out = await r.json();
  assert.equal(out.committed, false);
  /* a change: a second commit on top of the first */
  assert.equal((await W('/v1/admin/posts/a-draft', 'DELETE')).status, 200);
  const first = gh.refs.content;
  /* the cron itself, through wrangler's scheduled endpoint */
  r = await fetch(c.url + '/cdn-cgi/handler/scheduled?cron=17+3+*+*+*');
  if (r.status === 404) r = await fetch(c.url + '/cdn-cgi/local/explorer/api/local/scheduled?worker=aphesis-content&cron=17+3+*+*+*', { method: 'POST' });
  for (let i = 0; i < 50 && gh.refs.content === first; i++) await sleep(100);
  assert.notEqual(gh.refs.content, first, 'the scheduled run committed');
  assert.deepEqual(gh.commits[gh.refs.content].parents, [first]);
  assert.ok(!gh.trees[gh.commits[gh.refs.content].tree].some((e) => e.path === 'archive/content/a-draft.md'));
});
