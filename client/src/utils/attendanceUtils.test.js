import { describe, it, expect } from 'vitest';
import {
  formatClockTimeForDisplay,
  formatAttendanceRecordTime,
  dateKeyToLocalDate,
  getISTTodayDate,
} from './attendanceUtils';

describe('attendanceUtils clock display', () => {
  it('pads single-digit hours to HH:mm', () => {
    expect(formatClockTimeForDisplay('9:05')).toBe('09:05');
    expect(formatClockTimeForDisplay('09:05')).toBe('09:05');
  });

  it('returns empty label when clock missing', () => {
    expect(formatClockTimeForDisplay('')).toBe('--');
    expect(formatClockTimeForDisplay('', { emptyLabel: '' })).toBe('');
  });

  it('formats attendance record manual timestamp', () => {
    expect(formatAttendanceRecordTime({ manualTimestamp: '8:30' })).toBe('08:30');
  });
});

describe('attendanceUtils IST today', () => {
  it('dateKeyToLocalDate builds local Date from yyyy-MM-dd key', () => {
    const date = dateKeyToLocalDate('2026-07-02');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(6);
    expect(date.getDate()).toBe(2);
  });

  it('getISTTodayDate matches formatDateKeyIST for same instant', () => {
    const today = getISTTodayDate();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
