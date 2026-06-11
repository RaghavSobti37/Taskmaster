import { describe, it, expect } from 'vitest';
import { QUERY_STALE_TIMES, resolveQueryStaleTime } from './queryDefaults';

describe('resolveQueryStaleTime', () => {
  it('applies frequent tier for artist-os query root', () => {
    expect(resolveQueryStaleTime(['artist-os', 'artist-1', 'overview'])).toBe(QUERY_STALE_TIMES.frequent);
  });

  it('falls back to default for unknown roots', () => {
    expect(resolveQueryStaleTime(['unknown-root'])).toBe(QUERY_STALE_TIMES.default);
  });
});
