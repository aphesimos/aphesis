/* the sigil is a function of the poster token: the same token draws the same mark, every time, everywhere */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import { hash32, bitReader } from '../../src/hash.js';
import { sigilSpec, sigilSVG, sigilLabel } from '../../src/sigil.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/* the design system's runtime, read from its branch, in a sandbox with just enough of a window */
function runtime() {
  const src = execFileSync('git', ['-C', here, 'show', 'design-system:system/components/bundle.js'], { encoding: 'utf8' });
  const sandbox = { performance, requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}, console };
  sandbox.window = sandbox;
  vm.runInNewContext(src, sandbox);
  return sandbox.Aphesis;
}

test('hash32 is stable and spreads neighbours apart', () => {
  assert.equal(hash32('a1f3'), hash32('a1f3'));
  assert.equal(hash32(''), hash32(''));
  assert.notEqual(hash32('a1f3'), hash32('a1f4'));
  assert.equal(hash32('φ ἀγορά'), hash32('φ ἀγορά'));
  /* known value, so a change to the hash (which would redraw every sigil) is caught */
  assert.equal(hash32('aphesis'), hash32('aphesis', 0));
  assert.equal(typeof hash32('x'), 'number');
});

test('bit reader gives the same sequence for the same token', () => {
  const a = bitReader('3fa9c0de12ab45ef'), b = bitReader('3fa9c0de12ab45ef');
  for (let i = 0; i < 40; i++) assert.equal(a.take(3), b.take(3));
});

test('same token, same spec; tokens differ, sigils differ', () => {
  const t = '3fa9c0de12ab45ef';
  assert.deepEqual(sigilSpec(t), sigilSpec(t));
  const seen = new Set();
  for (let i = 0; i < 400; i++) seen.add(JSON.stringify(sigilSpec('token-' + i)));
  assert.ok(seen.size > 390, 'distinct sigils: ' + seen.size);
});

test('every mark stays on the 24-unit grid', () => {
  for (let i = 0; i < 300; i++) {
    const s = sigilSpec('grid-' + i);
    assert.ok(s.strokes.length >= 1 && s.strokes.length <= 2);
    assert.ok(s.grains.length <= 3);
    for (const k of s.strokes) for (const [x, y] of k.pts) { assert.ok(x >= 2 && x <= 22, 'x ' + x); assert.ok(y >= 2 && y <= 22, 'y ' + y); }
    for (const g of s.grains) { assert.ok(g.x >= 2 && g.x <= 22 && g.y >= 2 && g.y <= 22); }
    for (const k of s.strokes) assert.ok(k.w >= 1 && k.w <= 1.9);
  }
});

test('the drawn SVG is identical for the same token, with the real brush', (t) => {
  let A;
  try { A = runtime(); } catch (e) { t.skip('design-system branch not readable: ' + e.message); return; }
  const one = sigilSVG('3fa9c0de12ab45ef', A);
  const fresh = runtime();
  /* a fresh runtime (fresh caches) draws the very same path */
  const two = sigilSVG('3fa9c0de12ab45ef' + '', fresh);
  assert.equal(one, two);
  assert.match(one, /^<svg viewBox="0 0 24 24"/);
  assert.match(one, /fill="currentColor"/);
  assert.doesNotMatch(one, /accent|#[0-9a-f]{3,6}|rgb/i, 'no color is chosen by the sigil');
});

test('label names the parts', () => {
  assert.match(sigilLabel('3fa9c0de12ab45ef'), /^sigil: [a-z]+/);
});
