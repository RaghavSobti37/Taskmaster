import { describe, it, expect } from 'vitest';
import { canDeletePin, getPinAuthorId } from './pinBoardPermissions';

describe('pinBoardPermissions', () => {
  const authorId = 'user-abc';
  const admin = { _id: 'admin-1', departmentId: { slug: 'admin' } };
  const author = { _id: authorId };
  const other = { _id: 'user-other' };
  const pin = { _id: 'pin-1', createdBy: { _id: authorId, name: 'Author' } };

  it('resolves pin author id from populated or raw ref', () => {
    expect(getPinAuthorId(pin)).toBe(authorId);
    expect(getPinAuthorId({ createdBy: authorId })).toBe(authorId);
  });

  it('allows delete for pin author and admin only', () => {
    expect(canDeletePin(author, pin)).toBe(true);
    expect(canDeletePin(admin, pin)).toBe(true);
    expect(canDeletePin(other, pin)).toBe(false);
    expect(canDeletePin(null, pin)).toBe(false);
  });
});
