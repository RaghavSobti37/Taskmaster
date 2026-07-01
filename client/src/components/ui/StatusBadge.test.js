import { describe, expect, it } from 'vitest';
import { resolveStatusRole } from './statusRole.js';

describe('resolveStatusRole', () => {
  it('maps positive states to positive role', () => {
    expect(resolveStatusRole('Available')).toBe('positive');
    expect(resolveStatusRole('INVOICE')).toBe('positive');
  });

  it('maps in-use to active (not teal)', () => {
    expect(resolveStatusRole('In Use')).toBe('active');
  });

  it('maps category to neutral', () => {
    expect(resolveStatusRole('category')).toBe('neutral');
  });

  it('maps errors to error role', () => {
    expect(resolveStatusRole('Damaged')).toBe('error');
    expect(resolveStatusRole('danger')).toBe('error');
  });
});
