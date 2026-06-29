import { describe, it, expect } from 'vitest';
import {
  formatClockTimeForDisplay,
  formatAttendanceRecordTime,
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
