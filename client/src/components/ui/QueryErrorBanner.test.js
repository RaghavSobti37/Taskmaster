import { describe, it, expect } from 'vitest';
import { getQueryErrorMessage } from './QueryErrorBanner.jsx';

describe('getQueryErrorMessage', () => {
  it('prefers API error field', () => {
    expect(getQueryErrorMessage({ response: { data: { error: 'Denied' } } })).toBe('Denied');
  });

  it('falls back to message then default', () => {
    expect(getQueryErrorMessage({ message: 'Network Error' })).toBe('Network Error');
    expect(getQueryErrorMessage(null)).toBe('Failed to load data');
    expect(getQueryErrorMessage(null, 'Custom fallback')).toBe('Custom fallback');
  });
});
