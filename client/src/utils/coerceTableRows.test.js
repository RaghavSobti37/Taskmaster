import { describe, it, expect } from 'vitest';
import { coerceTableRows } from './coerceTableRows.js';

describe('coerceTableRows', () => {
  it('returns arrays as-is', () => {
    const rows = [{ _id: '1' }];
    expect(coerceTableRows(rows)).toBe(rows);
  });

  it('extracts users/data/items envelopes', () => {
    const users = [{ _id: 'u1' }];
    expect(coerceTableRows({ users, pagination: { total: 1 } })).toEqual(users);
    expect(coerceTableRows({ data: users })).toEqual(users);
    expect(coerceTableRows({ items: users })).toEqual(users);
  });

  it('returns [] for non-array payloads', () => {
    expect(coerceTableRows(null)).toEqual([]);
    expect(coerceTableRows({})).toEqual([]);
    expect(coerceTableRows('bad')).toEqual([]);
  });
});
