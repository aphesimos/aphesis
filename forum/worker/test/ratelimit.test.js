import test from 'node:test';
import assert from 'node:assert/strict';
import { take, isFull } from '../src/ratelimit.js';

const opts = { limit: 4, windowMs: 120000 };

test('a burst up to the limit passes, then it waits', () => {
  let b, now = 1e12;
  for (let i = 0; i < 4; i++) { const r = take(b, now, opts); assert.equal(r.allowed, true); b = r.bucket; }
  const r = take(b, now, opts);
  assert.equal(r.allowed, false);
  assert.equal(r.retryAfter, 30);   /* one token every 120 / 4 seconds */
});

test('tokens come back with time, never above the limit', () => {
  let b, now = 1e12;
  for (let i = 0; i < 4; i++) b = take(b, now, opts).bucket;
  assert.equal(take(b, now + 29000, opts).allowed, false);
  assert.equal(take(b, now + 30000, opts).allowed, true);
  const later = take(b, now + 10 * 120000, opts);
  assert.ok(later.bucket.tokens <= opts.limit - 1 + 1e-9);
});

test('a waiting client does not earn tokens by retrying', () => {
  let b, now = 1e12;
  for (let i = 0; i < 4; i++) b = take(b, now, opts).bucket;
  for (let s = 1; s < 30; s++) { const r = take(b, now + s * 1000, opts); assert.equal(r.allowed, false); b = r.bucket; }
  assert.equal(take(b, now + 30000, opts).allowed, true);
});

test('one thread per window', () => {
  const o = { limit: 1, windowMs: 120000 };
  const a = take(undefined, 0, o);
  assert.equal(a.allowed, true);
  const b = take(a.bucket, 60000, o);
  assert.equal(b.allowed, false);
  assert.equal(b.retryAfter, 60);
});

test('a refilled bucket can be forgotten', () => {
  const r = take(undefined, 0, opts);
  assert.equal(isFull(r.bucket, 1000, opts), false);
  assert.equal(isFull(r.bucket, 30000, opts), true);
  assert.equal(isFull(undefined, 0, opts), true);
});
