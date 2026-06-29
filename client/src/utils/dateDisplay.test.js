import { describe, it, expect } from 'vitest';
import {
  DATE_DISPLAY_FORMAT,
  formatDisplayDate,
  formatDisplayDateTime,
  formatDateKeyForDisplay,
} from './dateDisplay';

describe('dateDisplay', () => {
  it('uses dd/MM/yyyy format constant', () => {
    expect(DATE_DISPLAY_FORMAT).toBe('dd/MM/yyyy');
  });

  it('formats ISO timestamps for display', () => {
    expect(formatDisplayDate('2026-06-29T10:30:00.000Z')).toMatch(/^\d{2}\/\d{2}\/2026$/);
  });

  it('formats date keys for display', () => {
    expect(formatDateKeyForDisplay('2026-06-29')).toBe('29/06/2026');
  });

  it('formats datetime with time', () => {
    const out = formatDisplayDateTime('2026-06-29T15:45:00');
    expect(out).toMatch(/^\d{2}\/\d{2}\/2026 \d{2}:\d{2}$/);
  });
});
