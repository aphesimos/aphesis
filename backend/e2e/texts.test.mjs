// The site's texts end to end, under wrangler dev with a local D1: the public answer (only what the owner set, its
// version, CORS, a short cache and 304 by ETag), and the dashboard's list, edit, conflict and reset, behind the
// session and CSRF like every other write.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pbkdf2Sync } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { start, wrangler, sleep } from './dev.mjs';

const SITE = 'http://localhost:8000';
const PASSWORD = 'salt sulphur mercury and a long walk';
const salt = Buffer.from('00112233445566778899aabbccddeeff', 'hex');
const HASH = `pbkdf2-sha256$25000$${salt.toString('base64')}$${pbkdf2Sync(PASSWORD, salt, 25000, 32, 'sha256').toString('base64')}`;

let c;
before(async () => {
  c = await start('content', { ALLOWED_ORIGINS: SITE, OWNER_PASSWORD_HASH: HASH, OWNER_EMAIL: 'owner@example.com', EMAIL_FROM: 'clavis@aphes.ist', AUTH_SALT: 'test-salt' },
    { prepare: (state) => wrangler('content', ['d1', 'migrations', 'apply', 'aphesis-content', '--local', '--persist-to', state]), logLevel: 'info' });
});
after(async () => { if (process.env.E2E_LOG) console.error(c?.log()); await c?.stop(); });

const send = (p, { method = 'GET', body, cookie, origin = SITE, headers = {} } = {}) => fetch(c.url + p, {
  method, headers: { 'CF-Connecting-IP': '10.1.0.1', ...(origin ? { Origin: origin } : {}), ...(cookie ? { Cookie: cookie } : {}),
    ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
  body: body ? JSON.stringify(body) : undefined,
});
const cookieOf = (r) => r.headers.getSetCookie().map((sc) => sc.split(';')[0]).filter((kv) => kv.split('=')[1]).join('; ');
function mails() {
  return [...c.log().matchAll(/Email: (\S+\.eml)/g)].map((m) => m[1]).filter(existsSync).map((f) => readFileSync(f, 'utf8'));
}
async function login() {
  const n = mails().length;
  let r = await send('/v1/auth/password', { method: 'POST', body: { password: PASSWORD } });
  assert.equal(r.status, 200, await r.clone().text());
  const pending = cookieOf(r);
  let raw;
  for (let i = 0; i < 50 && !raw; i++) { const m = mails(); if (m.length > n) raw = m[m.length - 1]; else await sleep(100); }
  assert.ok(raw, 'the mail came');
  const at = raw.slice(raw.indexOf('Content-Type: text/plain'));
  const words = Buffer.from(at.slice(at.indexOf('\r\n\r\n') + 4, at.indexOf('\r\n--')).replace(/\s+/g, ''), 'base64').toString('utf8').trim().split('\r\n').pop();
  r = await send('/v1/auth/code', { method: 'POST', body: { code: words }, cookie: pending });
  assert.equal(r.status, 200);
  return { cookie: cookieOf(r), csrf: (await r.json()).csrf };
}

test('the public texts: only what the owner set, with CORS, a short cache and a version', async () => {
  const r = await send('/v1/texts');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('access-control-allow-origin'), SITE);
  assert.match(r.headers.get('cache-control'), /^public, max-age=\d{1,2}$/);
  assert.deepEqual(await r.json(), { texts: {}, version: 0 });
  assert.equal(r.headers.get('etag'), '"t0"');
  const again = await send('/v1/texts', { headers: { 'If-None-Match': '"t0"' } });
  assert.equal(again.status, 304);
  assert.equal(again.headers.get('access-control-allow-origin'), SITE);
  const other = await send('/v1/texts', { origin: 'https://evil.example' });
  assert.equal(other.status, 200);
  assert.equal(other.headers.get('access-control-allow-origin'), null);
});

test('the dashboard: every key with its default, edit, conflict, reset; the page sees each change', async () => {
  assert.equal((await send('/v1/admin/texts')).status, 401, 'no session, no list');
  const { cookie, csrf } = await login();
  let r = await send('/v1/admin/texts', { cookie });
  assert.equal(r.status, 200);
  const all = await r.json();
  assert.ok(all.screens.includes('home') && all.screens.includes('music'));
  const lede = all.texts.find((t) => t.key === 'music.lede');
  assert.equal(lede.screen, 'music');
  assert.equal(lede.value, lede.default);
  assert.equal(lede.overridden, false);
  assert.equal(lede.version, 0);
  for (const s of ['book', 'descent', 'archive', 'laboratory', 'works', 'wall', 'forum', 'music']) {
    assert.ok(all.texts.some((t) => t.key === `home.sections.${s}.description`), s);
  }

  const w = { 'X-CSRF-Token': csrf };
  assert.equal((await send('/v1/admin/texts/music.lede', { method: 'PUT', cookie, body: { value: 'x' } })).status, 403, 'no CSRF token');
  assert.equal((await send('/v1/admin/texts/music.lede', { method: 'PUT', cookie, body: { value: 'x' }, origin: 'https://evil.example', headers: w })).status, 403, 'wrong origin');
  assert.equal((await send('/v1/admin/texts/no.such.key', { method: 'PUT', cookie, body: { value: 'x' }, headers: w })).status, 404);
  assert.equal((await send('/v1/admin/texts/no.such.key', { cookie })).status, 404);
  for (const value of ['   ', 'two\nlines', 'x'.repeat(401), 7]) {
    r = await send('/v1/admin/texts/music.lede', { method: 'PUT', cookie, body: { value }, headers: w });
    assert.equal(r.status, 400, JSON.stringify(value));
    assert.ok((await r.json()).error);
  }

  r = await send('/v1/admin/texts/music.lede', { method: 'PUT', cookie, body: { value: '  my folder, as it is.  ', version: 0 }, headers: w });
  assert.equal(r.status, 200);
  let { text } = await r.json();
  assert.equal(text.value, 'my folder, as it is.');
  assert.equal(text.overridden, true);
  assert.equal(text.version, 1);

  r = await send('/v1/texts');
  assert.deepEqual(await r.json(), { texts: { 'music.lede': 'my folder, as it is.' }, version: 1 });
  assert.equal(r.headers.get('etag'), '"t1"');
  assert.equal((await send('/v1/texts', { headers: { 'If-None-Match': '"t0"' } })).status, 200, 'an old version gets the new texts');

  r = await send('/v1/admin/texts/music.lede', { method: 'PUT', cookie, body: { value: 'a stale edit', version: 0 }, headers: w });
  assert.equal(r.status, 409);
  const conflict = await r.json();
  assert.equal(conflict.text.value, 'my folder, as it is.');
  assert.equal(conflict.text.version, 1);

  r = await send('/v1/admin/texts/wall.sent', { method: 'PUT', cookie, body: { value: 'up.' }, headers: w });
  assert.equal(r.status, 200, 'a save without a version is taken as it is');
  assert.equal((await r.json()).text.version, 1);

  assert.equal((await send('/v1/admin/texts/music.lede/reset', { method: 'POST', cookie })).status, 403, 'a reset is a write');
  r = await send('/v1/admin/texts/music.lede/reset', { method: 'POST', cookie, headers: w });
  assert.equal(r.status, 200);
  ({ text } = await r.json());
  assert.equal(text.value, text.default);
  assert.equal(text.overridden, false);
  assert.equal(text.version, 2);

  r = await send('/v1/texts');
  const after = await r.json();
  assert.deepEqual(after.texts, { 'wall.sent': 'up.' });
  assert.equal(after.version, 3, 'the version grew with the reset, so a page holding the old set does not keep it');
  r = await send('/v1/admin/texts/music.lede', { cookie });
  assert.equal((await r.json()).text.version, 2);
});
