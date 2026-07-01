import { describe, it, expect } from 'vitest';
import {
  countActiveFilters,
  isFilterFieldActive,
  resolveFilterDefault,
} from './selectionFilterUtils';

describe('selectionFilterUtils', () => {
  it('resolveFilterDefault returns type-specific baselines', () => {
    expect(resolveFilterDefault({ type: 'toggle' })).toBe(false);
    expect(resolveFilterDefault({ type: 'chips' })).toEqual([]);
    expect(resolveFilterDefault({ type: 'dateRange' })).toEqual({ start: '', end: '' });
    expect(resolveFilterDefault({ type: 'radio' })).toBe('all');
    expect(resolveFilterDefault({ defaultValue: '' })).toBe('');
  });

  it('isFilterFieldActive detects non-default radio values', () => {
    expect(isFilterFieldActive({ type: 'radio', value: 'all', defaultValue: 'all' })).toBe(false);
    expect(isFilterFieldActive({ type: 'radio', value: 'warm', defaultValue: 'all' })).toBe(true);
    expect(isFilterFieldActive({ type: 'radio', value: '', defaultValue: '' })).toBe(false);
  });

  it('isFilterFieldActive handles toggle, chips, and dateRange', () => {
    expect(isFilterFieldActive({ type: 'toggle', value: false })).toBe(false);
    expect(isFilterFieldActive({ type: 'toggle', value: true })).toBe(true);
    expect(isFilterFieldActive({ type: 'chips', value: [] })).toBe(false);
    expect(isFilterFieldActive({ type: 'chips', value: ['a'] })).toBe(true);
    expect(isFilterFieldActive({ type: 'dateRange', value: { start: '', end: '' } })).toBe(false);
    expect(isFilterFieldActive({ type: 'dateRange', value: { start: '2024-01-01', end: '' } })).toBe(true);
  });

  it('countActiveFilters counts only active fields', () => {
    const fields = [
      { id: 'a', type: 'radio', value: 'all', defaultValue: 'all' },
      { id: 'b', type: 'radio', value: 'hot', defaultValue: 'all' },
      { id: 'c', type: 'toggle', value: true },
      { id: 'd', type: 'radio', value: '', defaultValue: '' },
    ];
    expect(countActiveFilters(fields)).toBe(2);
  });
});
