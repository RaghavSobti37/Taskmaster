const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { canDeletePin } = require('../utils/pinBoardPermissions');

describe('pinBoardPermissions', () => {
  const authorId = '507f1f77bcf86cd799439011';
  const otherId = '507f1f77bcf86cd799439012';
  const pin = { createdBy: authorId };

  it('allows delete for pin author and admin only', () => {
    const author = { _id: authorId };
    const other = { _id: otherId };
    const admin = { _id: otherId, departmentId: { slug: 'admin' } };

    assert.equal(canDeletePin(author, pin), true);
    assert.equal(canDeletePin(admin, pin), true);
    assert.equal(canDeletePin(other, pin), false);
    assert.equal(canDeletePin(null, pin), false);
  });
});
