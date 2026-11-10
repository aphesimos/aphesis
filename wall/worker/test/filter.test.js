import { test } from 'node:test';
import assert from 'node:assert/strict';
import { check, clean, MAX_LENGTH } from '../src/filter.js';

test('keeps quiet lines', () => {
  for (const t of ['festina lente', 'i left a door open in a dream and the fog came in',
    'the class met in scunthorpe', 'a cocktail, a dickens novel, a pass', 'shiitake soup, a cockatoo', 'Ἄφεσις · 色即是空']) {
    const r = check(t);
    assert.equal(r.ok, true, t);
  }
});

test('cleans to one line', () => {
  assert.equal(clean('  two\n lines\t here ​ '), 'two lines here');
  assert.equal(check('a\nb').text, 'a b');
});

test('refuses empty and long lines', () => {
  assert.deepEqual(check('   '), { ok: false, reason: 'empty' });
  assert.equal(check('x'.repeat(MAX_LENGTH)).ok, true);
  assert.deepEqual(check('x'.repeat(MAX_LENGTH + 1)), { ok: false, reason: 'long' });
  /* length is counted in characters, not UTF-16 units */
  assert.equal(check('色'.repeat(MAX_LENGTH)).ok, true);
});

test('refuses words, in disguise too', () => {
  for (const t of ['shit', 'what the FUCK', 'sh1t happens', 's.h.i.t', 'f u c k this', 'fuuuuck', 'ſhit'.replace('ſ', 's'),
    'you b!tch', 'a big d1ck', 'kys', 'kill yourself', 'shït']) {
    assert.deepEqual(check(t), { ok: false, reason: 'word' }, t);
  }
});

test('refuses links and handles', () => {
  for (const t of ['see https://x.example', 'www.spam', 'buy at cheap-pills.com', 'follow @someone_here', 'join discord.gg/abc']) {
    assert.deepEqual(check(t), { ok: false, reason: 'link' }, t);
  }
});

test('takes extra words', () => {
  assert.equal(check('the word is marmalade').ok, true);
  assert.deepEqual(check('the word is marmalade', ['marmalade']), { ok: false, reason: 'word' });
});
