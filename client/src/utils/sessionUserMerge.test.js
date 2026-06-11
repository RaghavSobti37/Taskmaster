import { describe, it, expect } from 'vitest';
import { mergeSessionUser } from './sessionUserMerge';

describe('mergeSessionUser', () => {
  const baseUser = {
    _id: 'u1',
    name: 'Temp User',
    mustChangePassword: true,
  };

  it('clears mustChangePassword when API returns explicit false', () => {
    const merged = mergeSessionUser(baseUser, { mustChangePassword: false });
    expect(merged.mustChangePassword).toBe(false);
    expect(merged.name).toBe('Temp User');
  });

  it('clears mustChangePassword when profileCompletion.needsPasswordChange is false', () => {
    const merged = mergeSessionUser(baseUser, {
      profileCompletion: { needsPasswordChange: false },
    });
    expect(merged.mustChangePassword).toBe(false);
  });

  it('keeps mustChangePassword when password change still required', () => {
    const merged = mergeSessionUser(baseUser, {
      name: 'Updated',
      profileCompletion: { needsPasswordChange: true },
    });
    expect(merged.mustChangePassword).toBe(true);
    expect(merged.name).toBe('Updated');
  });
});
