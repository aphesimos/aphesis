/* the Worker end to end, with Durable Objects and R2 replaced by small in-memory fakes */
import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { Thread, Board } from '../src/index.js';

function storage() {
  const m = new Map(); let alarm = null;
  const clone = (v) => (v === undefined ? v : structuredClone(v));
  return {
    async get(k) { return clone(m.get(k)); },
    async put(k, v) { if (typeof k === 'object') for (const [a, b] of Object.entries(k)) m.set(a, clone(b)); else m.set(k, clone(v)); },
    async list({ prefix = '' } = {}) { return new Map([...m.keys()].filter((k) => k.startsWith(prefix)).sort().map((k) => [k, clone(m.get(k))])); },
    async delete(k) { (Array.isArray(k) ? k : [k]).forEach((x) => m.delete(x)); },
    async deleteAll() { m.clear(); },
    async getAlarm() { return alarm; }, async setAlarm(t) { alarm = t; },
  };
}
function namespace(Cls, env) {
  const objs = new Map();
  return {
    idFromName: (n) => n,
    get(id) {
      if (!objs.has(id)) objs.set(id, new Cls({ storage: storage() }, env));
      const o = objs.get(id);
      return { fetch: (url, init) => o.fetch(new Request(url, init)) };
    },
  };
}
function r2() {
  const m = new Map();
  return {
    m,
    async put(k, v, o) { m.set(k, { body: v, httpMetadata: o.httpMetadata }); },
    async get(k) { const v = m.get(k); return v ? { body: v.body, httpMetadata: v.httpMetadata } : null; },
    async delete(k) { (Array.isArray(k) ? k : [k]).forEach((x) => m.delete(x)); },
  };
}
function makeEnv(extra = {}) {
  const env = Object.assign({ ALLOWED_ORIGINS: 'https://aphes.is', IP_SALT: 's1', POSTER_SALT: 's2', ADMIN_SECRET: 'open-sesame', RATE_POSTS: '3', RATE_THREADS: '2', RATE_WINDOW_SECONDS: '120' }, extra);
  env.THREADS = namespace(Thread, env); env.BOARD = namespace(Board, env); env.IMAGES = r2();
  return env;
}
const H = (ip, more = {}) => Object.assign({ 'CF-Connecting-IP': ip, Origin: 'https://aphes.is' }, more);
function form(fields) { const f = new FormData(); for (const [k, v] of Object.entries(fields)) f.append(k, v); return f; }
const req = (env, path, init = {}) => worker.fetch(new Request('https://forum.test' + path, init), env);
function jpeg(w, h) {
  const b = new Uint8Array(200); b.set([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, w >> 8, w & 255, 1]);
  return new Blob([b], { type: 'image/jpeg' });
}

test('a thread, replies, sigils per thread, the board', async () => {
  const env = makeEnv();
  let r = await req(env, '/api/threads', { method: 'POST', headers: H('1.1.1.1'), body: form({ text: 'first line\nsecond' }) });
  assert.equal(r.status, 201);
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://aphes.is');
  const { thread } = await r.json();
  r = await req(env, '/api/threads/' + thread + '/posts', { method: 'POST', headers: H('2.2.2.2'), body: form({ text: '>>1 yes' }) });
  assert.deepEqual(await r.json(), { thread, n: 2 });
  r = await req(env, '/api/threads/' + thread + '/posts', { method: 'POST', headers: H('1.1.1.1'), body: form({ text: 'me again' }) });
  const t = await (await req(env, '/api/threads/' + thread)).json();
  assert.equal(t.posts.length, 3);
  assert.equal(t.posts[0].poster, t.posts[2].poster, 'same person, same token in a thread');
  assert.notEqual(t.posts[0].poster, t.posts[1].poster);
  assert.ok(!JSON.stringify(t).includes('1.1.1.1'), 'no address in what is stored or served');
  /* the same person in another thread gets another token */
  r = await req(env, '/api/threads', { method: 'POST', headers: H('1.1.1.1'), body: form({ text: 'another' }) });
  const other = (await r.json()).thread;
  const t2 = await (await req(env, '/api/threads/' + other)).json();
  assert.notEqual(t2.posts[0].poster, t.posts[0].poster);
  const b = await (await req(env, '/api/board')).json();
  assert.equal(b.threads[0].id, other);
  assert.equal(b.threads[1].replies, 2);
  assert.equal(b.threads[1].first, 'first line\nsecond');
});

test('rate limits per IP hash', async () => {
  const env = makeEnv();
  const { thread } = await (await req(env, '/api/threads', { method: 'POST', headers: H('3.3.3.3'), body: form({ text: 'x' }) })).json();
  const codes = [];
  for (let i = 0; i < 4; i++) codes.push((await req(env, '/api/threads/' + thread + '/posts', { method: 'POST', headers: H('4.4.4.4'), body: form({ text: 'r' + i }) })).status);
  assert.deepEqual(codes, [201, 201, 201, 429]);
  const r = await req(env, '/api/threads/' + thread + '/posts', { method: 'POST', headers: H('5.5.5.5'), body: form({ text: 'someone else' }) });
  assert.equal(r.status, 201);
});

test('uploads: checked, stored, served; bad ones refused', async () => {
  const env = makeEnv();
  let r = await req(env, '/api/threads', { method: 'POST', headers: H('6.6.6.6'), body: form({ text: 'pic', image: jpeg(1600, 1200), density: jpeg(560, 420) }) });
  assert.equal(r.status, 201);
  const { thread } = await r.json();
  const t = await (await req(env, '/api/threads/' + thread)).json();
  const im = t.posts[0].image;
  assert.match(im.density, /^\/api\/images\/t\/[a-z2-9]{10}\/[a-z2-9]{12}\.density\.jpg$/);
  assert.equal(env.IMAGES.m.size, 2);
  const g = await req(env, im.original, { headers: { Origin: 'https://aphes.is' } });
  assert.equal(g.status, 200);
  assert.equal(g.headers.get('content-type'), 'image/jpeg');
  assert.equal(g.headers.get('x-content-type-options'), 'nosniff');
  /* an html file labelled as an image */
  r = await req(env, '/api/threads/' + thread + '/posts', { method: 'POST', headers: H('7.7.7.7'), body: form({ text: 'x', image: new Blob(['<html><script>1</script></html>'.padEnd(64)], { type: 'image/png' }), density: jpeg(560, 420) }) });
  assert.equal(r.status, 400);
  /* a density map that is too large */
  r = await req(env, '/api/threads/' + thread + '/posts', { method: 'POST', headers: H('8.8.8.8'), body: form({ text: 'x', image: jpeg(800, 600), density: jpeg(1200, 900) }) });
  assert.equal(r.status, 400);
  assert.equal(env.IMAGES.m.size, 2, 'nothing stored for refused uploads');
});

test('reports and admin removal', async () => {
  const env = makeEnv();
  const { thread } = await (await req(env, '/api/threads', { method: 'POST', headers: H('9.9.9.9'), body: form({ text: 'op', image: jpeg(900, 600), density: jpeg(560, 373) }) })).json();
  await req(env, '/api/threads/' + thread + '/posts', { method: 'POST', headers: H('9.9.9.8'), body: form({ text: 'bad words' }) });
  let r = await req(env, '/api/threads/' + thread + '/posts/2/report', { method: 'POST', headers: H('9.9.9.7') });
  assert.equal(r.status, 200);
  r = await req(env, '/api/admin/reports');
  assert.equal(r.status, 403);
  r = await req(env, '/api/admin/reports', { headers: { Authorization: 'Bearer open-sesame' } });
  assert.equal((await r.json()).reports[0].n, 2);
  r = await req(env, '/api/threads/' + thread + '/posts/2', { method: 'DELETE', headers: { Authorization: 'Bearer wrong' } });
  assert.equal(r.status, 403);
  r = await req(env, '/api/threads/' + thread + '/posts/2', { method: 'DELETE', headers: { Authorization: 'Bearer open-sesame' } });
  assert.equal(r.status, 200);
  const t = await (await req(env, '/api/threads/' + thread)).json();
  assert.deepEqual(Object.keys(t.posts[1]).sort(), ['created', 'n', 'removed']);
  /* removing the opening post removes the thread, its pictures and its place on the board */
  r = await req(env, '/api/threads/' + thread + '/posts/1', { method: 'DELETE', headers: { Authorization: 'Bearer open-sesame' } });
  assert.equal((await r.json()).thread, 'removed');
  assert.equal((await req(env, '/api/threads/' + thread)).status, 404);
  assert.equal(env.IMAGES.m.size, 0);
  assert.equal((await (await req(env, '/api/board')).json()).threads.length, 0);
});

test('CORS: the site origin only; preflight answered', async () => {
  const env = makeEnv();
  let r = await req(env, '/api/board', { method: 'OPTIONS', headers: { Origin: 'https://aphes.is', 'Access-Control-Request-Method': 'POST' } });
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://aphes.is');
  r = await req(env, '/api/board', { headers: { Origin: 'https://elsewhere.example' } });
  assert.equal(r.headers.get('access-control-allow-origin'), null);
  r = await req(env, '/api/threads', { method: 'POST', headers: { Origin: 'https://elsewhere.example', 'CF-Connecting-IP': '1.2.3.4' }, body: form({ text: 'x' }) });
  assert.equal(r.status, 403);
});

test('turnstile, when configured, is required', async () => {
  const env = makeEnv({ TURNSTILE_SECRET: 'secret' });
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => new Response(JSON.stringify({ success: init.body.get('response') === 'good' }));
  try {
    let r = await req(env, '/api/threads', { method: 'POST', headers: H('1.0.0.1'), body: form({ text: 'x' }) });
    assert.equal(r.status, 403);
    r = await req(env, '/api/threads', { method: 'POST', headers: H('1.0.0.2'), body: form({ text: 'x', turnstile: 'good' }) });
    assert.equal(r.status, 201);
  } finally { globalThis.fetch = real; }
});
