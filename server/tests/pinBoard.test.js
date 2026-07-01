const { canDeletePin } = require('../utils/pinBoardPermissions');

describe('pinBoardPermissions', () => {
  const authorId = '507f1f77bcf86cd799439011';
  const otherId = '507f1f77bcf86cd799439012';
  const pin = { createdBy: authorId };

  it('allows delete for pin author and admin only', () => {
    const author = { _id: authorId };
    const other = { _id: otherId };
    const admin = { _id: otherId, departmentId: { slug: 'admin' } };

    expect(canDeletePin(author, pin)).toBe(true);
    expect(canDeletePin(admin, pin)).toBe(true);
    expect(canDeletePin(other, pin)).toBe(false);
    expect(canDeletePin(null, pin)).toBe(false);
  });
});
