import { describe, it, expect, beforeEach } from 'vitest';
import {
  DATE_DISPLAY_FORMAT,
  formatDisplayDate,
  formatDisplayDateTime,
  formatDateKeyForDisplay,
  formatWeekdayDateLong,
  formatDobInput,
  parseDobInput,
} from './dateDisplay';
import { setActiveDateFormat } from './dateFormatRegistry';

describe('dateDisplay', () => {
  beforeEach(() => {
    setActiveDateFormat('dmY', 'en-IN');
  });

  it('uses dd/MM/yyyy format constant', () => {
    expect(DATE_DISPLAY_FORMAT).toBe('dd/MM/yyyy');
  });

  it('formats ISO timestamps for display', () => {
    expect(formatDisplayDate('2026-06-29T10:30:00.000Z')).toMatch(/^\d{2}\/\d{2}\/2026$/);
  });

  it('formats date keys for display', () => {
    expect(formatDateKeyForDisplay('2026-06-29')).toBe('29/06/2026');
  });

  it('formats date keys with weekday flag as DD/MM/YYYY only', () => {
    expect(formatDateKeyForDisplay('2026-06-29', { withWeekday: true })).toBe('29/06/2026');
    expect(formatWeekdayDateLong('2026-06-29')).toBe('29/06/2026');
  });

  it('formats datetime with time', () => {
    const out = formatDisplayDateTime('2026-06-29T15:45:00');
    expect(out).toMatch(/^\d{2}\/\d{2}\/2026 \d{2}:\d{2}$/);
  });

  it('parses and formats DOB as DD/MM/YYYY', () => {
    expect(formatDobInput('2003-05-11')).toBe('11/05/2003');
    expect(parseDobInput('11/05/2003')).toEqual({ ok: true, value: '2003-05-11' });
    expect(parseDobInput('bad')).toEqual({ ok: false, error: 'Use DD/MM/YYYY' });
  });

  it('respects user MM/DD/YYYY preference', () => {
    setActiveDateFormat('mdY', 'en-US');
    expect(formatDisplayDate('2026-07-08T12:00:00')).toBe('07/08/2026');
    expect(parseDobInput('07/08/2003')).toEqual({ ok: true, value: '2003-07-08' });
  });

  it('auto mode follows region', () => {
    setActiveDateFormat('auto', 'en-US');
    expect(formatDisplayDate('2026-07-08T12:00:00')).toBe('07/08/2026');
    setActiveDateFormat('auto', 'en-IN');
    expect(formatDisplayDate('2026-07-08T12:00:00')).toBe('08/07/2026');
  });
});
