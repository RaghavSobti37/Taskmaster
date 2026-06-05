import { describe, it, expect } from 'vitest';
import { resolvePaletteQuery } from './commandPaletteResolver';

describe('resolvePaletteQuery', () => {
  it('detects add note command', () => {
    const result = resolvePaletteQuery('add note Follow up call');
    expect(result.kind).toBe('note');
    expect(result.note?.title).toContain('Follow up');
  });

  it('returns null kind for empty query', () => {
    expect(resolvePaletteQuery('').kind).toBeNull();
  });
});
