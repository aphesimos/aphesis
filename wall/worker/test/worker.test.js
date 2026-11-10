/* the Worker and the Durable Object together, with an in-memory stand-in for Durable Object storage */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { Wall } from '../src/index.js';

function memoryStorage() {
  const m = new Map();
  let alarm = null;
  return {
    async get(k) { return m.get(k); },
    async put(k, v) { m.set(k, structuredClone(v)); },
    async delete(k) { (Array.isArray(k) ? k : [k]).forEach((x) => m.delete(x)); },
    async list({ prefix = '', reverse = false, limit = Infinity } = {}) {
      let keys = [...m.keys()].filter((k) => k.startsWith(prefix)).sort();
      if (reverse) keys.reverse();
      return new Map(keys.slice(0, limit).map((k) => [k, m.get(k)]));
    },
    async getAlarm() { return alarm; },
    async setAlarm(t) { alarm = t; },
    _map: m,
  };
}

function env(extra = {}) {
  const storage = memoryStorage();
  const obj = new Wall({ storage });
  return Object.assign({
    WALL: { idFromName: () => 'wall', get: () => ({ fetch: (u, init) => obj.fetch(new Request(u, init)) }) },
    ALLOWED_ORIGINS: 'https://site.example',
    HASH_SALT: 'salt',
    ADMIN_TOKEN: 'secret-admin',
    ALLOW_NO_TURNSTILE: '1',
    _obj: obj, _storage: storage,
  }, extra);
}

const post = (text, ip = '198.51.100.1', origin = 'https://site.example') => new Request('https://api/messages', {
  method: 'POST', body: JSON.stringify({ text, token: 'x' }),
  headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip, Origin: origin },
});

test('posts, lists newest first, never stores the address', async () => {
  const e = env();
  let r = await worker.fetch(post('first line'), e);
  assert.equal(r.status, 201);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'https://site.example');
  r = await worker.fetch(post('second line', '198.51.100.2'), e);
  assert.equal(r.status, 201);
  r = await worker.fetch(new Request('https://api/messages'), e);
  const { messages } = await r.json();
  assert.deepEqual(messages.map((m) => m.text), ['second line', 'first line']);
  const dump = JSON.stringify([...e._storage._map]);
  assert.ok(!dump.includes('198.51.100'));
});

test('filters, rate limits and refuses without turnstile', async () => {
  const e = env();
  let r = await worker.fetch(post('oh shit'), e);
  assert.equal(r.status, 400);
  assert.deepEqual(await r.json(), { error: 'word' });
  r = await worker.fetch(post('one'), e);
  assert.equal(r.status, 201);
  r = await worker.fetch(post('two'), e);
  assert.equal(r.status, 429);
  assert.equal((await r.json()).error, 'rate');

  const strict = env({ ALLOW_NO_TURNSTILE: undefined });
  r = await worker.fetch(post('three'), strict);
  assert.equal(r.status, 403);
});

test('cors only for the site origin', async () => {
  const e = env();
  const r = await worker.fetch(new Request('https://api/messages', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } }), e);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), null);
});

test('admin removal needs the secret', async () => {
  const e = env();
  const { message } = await (await worker.fetch(post('to be removed'), e)).json();
  const del = (auth) => worker.fetch(new Request(`https://api/messages/${message.id}`, { method: 'DELETE', headers: auth ? { Authorization: auth } : {} }), e);
  assert.equal((await del()).status, 401);
  assert.equal((await del('Bearer wrong')).status, 401);
  assert.equal((await del('Bearer secret-admin')).status, 204);
  assert.equal((await del('Bearer secret-admin')).status, 404);
  const { messages } = await (await worker.fetch(new Request('https://api/messages'), e)).json();
  assert.equal(messages.length, 0);
});

test('expired lines vanish and the alarm sweeps them', async () => {
  const e = env({ TTL_DAYS: '1' });
  await worker.fetch(post('brief'), e);
  const real = Date.now;
  try {
    Date.now = () => real() + 2 * 86_400_000;
    const { messages } = await (await worker.fetch(new Request('https://api/messages'), e)).json();
    assert.equal(messages.length, 0);
    await e._obj.alarm();
    assert.equal([...e._storage._map.keys()].length, 0);
  } finally { Date.now = real; }
});
