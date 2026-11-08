const test = require('node:test');
const assert = require('node:assert/strict');
const { suggestUsernames } = require('../username-suggestions');

test('preserves requested spelling and skips taken names case-insensitively', () => {
  const taken = new Set(['alex1', 'alex2', 'alex4']);
  assert.deepEqual(suggestUsernames('Alex', name => taken.has(name.toLowerCase())), ['Alex3', 'Alex5', 'Alex6']);
});

test('keeps long and Georgian names inside registration rules', () => {
  for (const name of ['abcdefghijklmnopqrst', 'გიორგი', 'a                  b']) {
    const names = suggestUsernames(name, () => false);
    assert.equal(names.length, 3);
    assert.equal(new Set(names).size, 3);
    for (const value of names) {
      assert.ok(value.length >= 2 && value.length <= 20);
      assert.match(value, /^[\w\u10D0-\u10FF\s\-.]+$/);
    }
  }
});

test('never returns reserved or blocked candidates and bounds the search', () => {
  let checks = 0;
  assert.deepEqual(suggestUsernames('support', () => { checks++; return true; }), []);
  assert.ok(checks <= 100);
});
