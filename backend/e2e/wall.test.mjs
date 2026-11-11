// The wall's Rust Worker end to end, under wrangler dev: what the JavaScript Worker's tests covered, over real HTTP,
// with the real Durable Object (SQLite-backed) and its alarm.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, dump, query, sleep } from './dev.mjs';

const SITE = 'https://site.example';
const base = { ALLOWED_ORIGINS: SITE, HASH_SALT: 'salt', ADMIN_TOKEN: 'secret-admin' };
let w;
before(async () => { w = await start('wall', { ...base, ALLOW_NO_TURNSTILE: '1' }); });
after(async () => { await w?.stop(); });

const post = (url, text, ip = '198.51.100.1', more = {}) => fetch(url + '/messages', {
  method: 'POST',
  body: typeof text === 'string' ? JSON.stringify({ text, token: 'x', ...more }) : text,
  headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip, Origin: SITE },
});
const list = async (url) => (await (await fetch(url + '/messages')).json()).messages;

test('posts, lists newest first, never stores the address', async () => {
  let r = await post(w.url, 'first line', '198.51.100.1');
  assert.equal(r.status, 201);
  assert.equal(r.headers.get('access-control-allow-origin'), SITE);
  assert.equal(r.headers.get('content-type'), 'application/json; charset=utf-8');
  const { message } = await r.json();
  assert.match(message.id, /^[0-9a-f]{16}$/);
  assert.equal(message.text, 'first line');
  assert.equal(typeof message.at, 'number');
  r = await post(w.url, '  second\n line  ', '198.51.100.2');
  assert.equal(r.status, 201);
  assert.equal((await r.json()).message.text, 'second line');
  r = await fetch(w.url + '/messages');
  assert.equal(r.headers.get('cache-control'), 'public, max-age=15');
  const { messages } = await r.json();
  assert.deepEqual(messages.slice(0, 2).map((m) => m.text), ['second line', 'first line']);
  assert.deepEqual(Object.keys(messages[0]), ['id', 'text', 'at', 'owner']);
  assert.equal(messages[0].owner, false);
  assert.ok(!dump(w.state).includes('198.51.100'), 'no address anywhere in storage');
});

test('the owner: marked only with the admin token, never by a flag; the filter still applies', async (t) => {
  /* a wall that refuses every visitor (no Turnstile secret: a first deploy) */
  const shut = await start('wall', base);
  t.after(() => shut.stop());
  const asOwner = (text, key = 'secret-admin') => fetch(shut.url + '/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, body: JSON.stringify({ text }) });
  let r = await post(shut.url, 'a visitor', '198.51.100.30', { owner: true });
  assert.equal(r.status, 403, 'a visitor still needs the check');
  r = await asOwner('from the owner');
  assert.equal(r.status, 201);
  assert.equal((await r.json()).message.owner, true);
  r = await asOwner('and again, at once');
  assert.equal(r.status, 201, 'no rate limit for the owner');
  r = await asOwner('see https://x.example');
  assert.deepEqual([r.status, await r.json()], [400, { error: 'link' }], 'the filter is the same for the owner');
  r = await asOwner('a guess', 'secret-admim');
  assert.deepEqual([r.status, await r.json()], [401, { error: 'unauthorized' }]);
  const lines = await list(shut.url);
  assert.deepEqual(lines.map((m) => [m.text, m.owner]), [['and again, at once', true], ['from the owner', true]]);
  /* forged flags on the open wall */
  r = await post(w.url, 'i am the owner', '198.51.100.31', { owner: true });
  assert.equal(r.status, 201);
  assert.equal((await r.json()).message.owner, false);
  assert.equal((await list(w.url)).find((m) => m.text === 'i am the owner').owner, false);
});

test('filter refusals, with the same error words', async () => {
  const cases = [['oh shit', 'word'], ['see https://x.example', 'link'], ['   ', 'empty'], ['x'.repeat(141), 'long']];
  for (const [text, error] of cases) {
    const r = await post(w.url, text, '198.51.100.10');
    assert.equal(r.status, 400, text);
    assert.deepEqual(await r.json(), { error });
  }
  for (const body of ['not json', JSON.stringify({ text: 5 }), JSON.stringify(null), JSON.stringify({})]) {
    const r = await post(w.url, Buffer.from(body), '198.51.100.11');
    assert.equal(r.status, 400, body);
    assert.deepEqual(await r.json(), { error: 'bad' });
  }
});

test('rate limit: 20 s between two lines, a Retry-After', async () => {
  let r = await post(w.url, 'one', '198.51.100.20');
  assert.equal(r.status, 201);
  r = await post(w.url, 'two', '198.51.100.20');
  assert.equal(r.status, 429);
  const body = await r.json();
  assert.equal(body.error, 'rate');
  assert.ok(body.retryAfter >= 19 && body.retryAfter <= 20, String(body.retryAfter));
  assert.equal(r.headers.get('retry-after'), String(body.retryAfter));
  /* someone else is not held back */
  assert.equal((await post(w.url, 'three', '198.51.100.21')).status, 201);
});

test('CORS only for the site origin', async () => {
  let r = await fetch(w.url + '/messages', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } });
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('access-control-allow-origin'), null);
  assert.equal(r.headers.get('vary'), 'Origin');
  r = await fetch(w.url + '/messages', { method: 'OPTIONS', headers: { Origin: SITE, 'Access-Control-Request-Method': 'POST' } });
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('access-control-allow-origin'), SITE);
  assert.equal(r.headers.get('access-control-allow-methods'), 'GET, POST, DELETE, OPTIONS');
  assert.equal(r.headers.get('access-control-allow-headers'), 'Content-Type, Authorization');
  assert.equal(r.headers.get('access-control-max-age'), '86400');
  r = await fetch(w.url + '/messages', { headers: { Origin: 'https://evil.example' } });
  assert.equal(r.headers.get('access-control-allow-origin'), null);
  r = await fetch(w.url + '/nothing');
  assert.equal(r.status, 404);
  assert.deepEqual(await r.json(), { error: 'not found' });
});

test('admin removal needs the secret', async () => {
  const { message } = await (await post(w.url, 'to be removed', '198.51.100.30')).json();
  const del = (auth) => fetch(`${w.url}/messages/${message.id}`, { method: 'DELETE', headers: auth ? { Authorization: auth } : {} });
  assert.equal((await del()).status, 401);
  assert.deepEqual(await (await del('Bearer wrong')).json(), { error: 'unauthorized' });
  assert.equal((await del('bearer secret-admin')).status, 401);
  const ok = await del('Bearer secret-admin');
  assert.equal(ok.status, 204);
  assert.equal(await ok.text(), '');
  assert.equal((await del('Bearer secret-admin')).status, 404);
  assert.ok(!(await list(w.url)).some((m) => m.id === message.id));
  /* an id outside the pattern is not a route */
  assert.equal((await fetch(`${w.url}/messages/SHORT`, { method: 'DELETE', headers: { Authorization: 'Bearer secret-admin' } })).status, 404);
});

test('turnstile: refused without a secret, refused with a failing one', async (t) => {
  /* the state of a first deploy without TURNSTILE_SECRET: every post is refused */
  const none = await start('wall', base);
  /* Cloudflare's test secret that always fails */
  const failing = await start('wall', { ...base, TURNSTILE_SECRET: '2x0000000000000000000000000000000AA' });
  try {
    let r = await post(none.url, 'hello', '198.51.100.40');
    assert.equal(r.status, 403);
    assert.deepEqual(await r.json(), { error: 'turnstile' });
    r = await post(failing.url, 'hello', '198.51.100.41', { token: 'XXXX.DUMMY.TOKEN.XXXX' });
    assert.equal(r.status, 403);
    r = await post(failing.url, 'hello', '198.51.100.42', { token: '' });
    assert.equal(r.status, 403);
    assert.equal((await list(none.url)).length + (await list(failing.url)).length, 0);
  } finally { await none.stop(); await failing.stop(); }
});

test('turnstile: passes with Cloudflare\'s always-pass test secret', async (t) => {
  const passing = await start('wall', { ...base, TURNSTILE_SECRET: '1x0000000000000000000000000000000AA' });
  try {
    const r = await post(passing.url, 'checked', '198.51.100.50', { token: 'XXXX.DUMMY.TOKEN.XXXX' });
    if (r.status === 403) { t.skip('siteverify unreachable from workerd here'); return; }
    assert.equal(r.status, 201);
  } finally { await passing.stop(); }
});

test('expired lines vanish and the alarm sweeps them', async () => {
  const brief = await start('wall', { ...base, ALLOW_NO_TURNSTILE: '1', TTL_SECONDS: '2' });
  try {
    assert.equal((await post(brief.url, 'brief', '198.51.100.60')).status, 201);
    assert.equal((await list(brief.url)).length, 1);
    assert.equal((await query(brief.state, 'SELECT count(*) AS n FROM lines'))[0].n, 1);
    await sleep(2500);
    assert.equal((await list(brief.url)).length, 0, 'hidden once expired, before any sweep');
    /* the alarm fires at the expiry; give it a moment, then the row is gone from SQLite */
    let n = 1;
    for (let i = 0; i < 20 && n; i++) { await sleep(500); n = (await query(brief.state, 'SELECT count(*) AS n FROM lines'))[0].n; }
    assert.equal(n, 0, 'the alarm deleted the line');
  } finally { await brief.stop(); }
});
