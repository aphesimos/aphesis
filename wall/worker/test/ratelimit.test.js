import { test } from 'node:test';
import assert from 'node:assert/strict';
import { take, expiresAt, visitorKey } from '../src/ratelimit.js';

const rule = { limit: 3, windowMs: 60_000, gapMs: 5_000 };

test('allows up to the limit, spaced by the gap', () => {
  let rec = null, t = 1_000_000;
  for (let i = 0; i < 3; i++) {
    const r = take(rec, t, rule);
    assert.equal(r.ok, true);
    rec = r.record; t += 6_000;
  }
  const r = take(rec, t, rule);
  assert.equal(r.ok, false);
  /* the first hit leaves the window 60 s after it was made */
  assert.equal(r.retryAfter, Math.ceil((1_000_000 + 60_000 - t) / 1000));
});

test('enforces the gap between two attempts', () => {
  const a = take(null, 0, rule);
  const b = take(a.record, 2_000, rule);
  assert.equal(b.ok, false);
  assert.equal(b.retryAfter, 3);
  assert.equal(take(a.record, 5_000, rule).ok, true);
});

test('a refused attempt is not counted', () => {
  const a = take(null, 0, rule);
  const b = take(a.record, 1_000, rule);
  assert.deepEqual(b.record.hits, [0]);
});

test('the window slides', () => {
  let rec = { hits: [0, 10_000, 20_000] };
  assert.equal(take(rec, 30_000, rule).ok, false);
  const r = take(rec, 60_001, rule);
  assert.equal(r.ok, true);
  assert.deepEqual(r.record.hits, [10_000, 20_000, 60_001]);
});

test('ignores junk and future times in a record', () => {
  const r = take({ hits: ['x', null, 9e15] }, 1000, rule);
  assert.equal(r.ok, true);
  assert.deepEqual(r.record.hits, [1000]);
});

test('records expire one window after the last hit', () => {
  assert.equal(expiresAt({ hits: [5, 10] }, rule), 60_010);
  assert.equal(expiresAt(null, rule), 0);
});

test('visitor keys are hashed, salted and change by day', async () => {
  const day = Date.UTC(2026, 10, 10, 12);
  const a = await visitorKey('203.0.113.7', 'salt', day);
  assert.match(a, /^[0-9a-f]{32}$/);
  assert.ok(!a.includes('203'));
  assert.equal(a, await visitorKey('203.0.113.7', 'salt', day + 3600_000));
  assert.notEqual(a, await visitorKey('203.0.113.7', 'salt', day + 86_400_000));
  assert.notEqual(a, await visitorKey('203.0.113.7', 'other', day));
  assert.notEqual(a, await visitorKey('203.0.113.8', 'salt', day));
});
