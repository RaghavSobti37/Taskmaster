import { describe, it, expect, beforeEach } from 'vitest';
import {
  fingerprintToast,
  shouldSuppressDuplicateToast,
  resetToastDedupeState,
} from './notifications';
import { SEVERITY } from './systemLogContract';

describe('toast dedupe', () => {
  beforeEach(() => {
    resetToastDedupeState();
  });

  it('fingerprints severity and message', () => {
    expect(fingerprintToast(SEVERITY.SUCCESS, 'Saved')).toBe('SUCCESS:saved');
  });

  it('suppresses duplicate toast within window', () => {
    const entry = { severity: SEVERITY.SUCCESS, message: 'Lead saved' };
    expect(shouldSuppressDuplicateToast(entry)).toBe(false);
    expect(shouldSuppressDuplicateToast(entry)).toBe(true);
  });

  it('allows different messages through', () => {
    expect(shouldSuppressDuplicateToast({ severity: SEVERITY.SUCCESS, message: 'A' })).toBe(false);
    expect(shouldSuppressDuplicateToast({ severity: SEVERITY.SUCCESS, message: 'B' })).toBe(false);
  });
});
