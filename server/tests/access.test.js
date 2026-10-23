import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../routes/auth.js';
import { assertOwner } from '../middleware/auth.js';

test('password hashes verify and reject the wrong password', () => {
  const stored = hashPassword('correct-horse');
  assert.equal(verifyPassword('correct-horse', stored), true);
  assert.equal(verifyPassword('other-horse', stored), false);
});

test('owners can read their records and other users cannot', () => {
  const record = { ownerId: 'user-1' };
  assert.doesNotThrow(() => assertOwner(record, { id: 'user-1', role: 'user' }));
  assert.doesNotThrow(() => assertOwner(record, { id: 'admin-1', role: 'admin' }));
  assert.throws(() => assertOwner(record, { id: 'user-2', role: 'user' }), /do not have access/);
  assert.throws(() => assertOwner(null, { id: 'user-1', role: 'user' }), /not found/);
});
