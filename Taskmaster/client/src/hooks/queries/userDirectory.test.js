import { describe, it, expect } from 'vitest';
import { normalizeUserDirectory } from './logs.js';
import { normalizeDepartmentsList } from './departments.js';

describe('normalizeUserDirectory', () => {
  it('returns arrays as-is', () => {
    const users = [{ _id: '1', name: 'A' }];
    expect(normalizeUserDirectory(users)).toBe(users);
  });

  it('extracts users from directory payload', () => {
    const users = [{ _id: '1' }];
    expect(normalizeUserDirectory({ users, pagination: { total: 1 } })).toEqual(users);
  });

  it('returns [] for nullish or malformed payloads', () => {
    expect(normalizeUserDirectory(null)).toEqual([]);
    expect(normalizeUserDirectory({ users: null })).toEqual([]);
    expect(normalizeUserDirectory({})).toEqual([]);
  });
});

describe('normalizeDepartmentsList', () => {
  it('returns arrays only', () => {
    const depts = [{ _id: 'd1', name: 'Sales' }];
    expect(normalizeDepartmentsList(depts)).toBe(depts);
    expect(normalizeDepartmentsList({})).toEqual([]);
  });
});
