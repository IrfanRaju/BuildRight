import test from 'node:test';
import assert from 'node:assert/strict';
import { containsRegex, escapeRegex, textOr } from '../lib/search.js';

test('search terms are partial and case-insensitive without treating punctuation as regex', () => {
  assert.equal(escapeRegex('Cement (50kg)'), 'Cement \\(50kg\\)');
  const regex = containsRegex('PaInT');
  assert.equal(regex.test('Exterior weathercoat paint'), true);
  assert.equal(regex.test('primer'), false);
  assert.equal(containsRegex('cement').test('replacement'), false);
  assert.equal(containsRegex('cement').test('Cementitious adhesive'), true);
  const clause = textOr(['name', 'summary'], containsRegex('leak'));
  assert.equal(clause.$or[0].name.test('Roof leakage'), true);
  assert.equal(containsRegex('   '), null);
});
