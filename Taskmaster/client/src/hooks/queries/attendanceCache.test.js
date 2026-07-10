import { describe, it, expect } from 'vitest';
import { upsertAttendanceRowInList } from './attendanceCache';

describe('upsertAttendanceRowInList', () => {
  const existing = {
    _id: 'a1',
    userId: 'user-1',
    date: '2026-07-02T00:00:00.000+05:30',
    inTimeRecord: null,
  };

  const updated = {
    _id: 'a1',
    userId: 'user-1',
    date: '2026-07-02T00:00:00.000+05:30',
    inTimeRecord: { manualTimestamp: '11:30', systemTimestamp: '2026-07-02T06:00:00.000Z' },
  };

  it('replaces matching row by user + IST date', () => {
    const next = upsertAttendanceRowInList([existing], updated);
    expect(next).toHaveLength(1);
    expect(next[0].inTimeRecord.manualTimestamp).toBe('11:30');
  });

  it('prepends when no matching row exists', () => {
    const next = upsertAttendanceRowInList([], updated);
    expect(next).toHaveLength(1);
    expect(next[0]._id).toBe('a1');
  });
});
