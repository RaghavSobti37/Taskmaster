import { describe, it, expect } from 'vitest';
import {
  computeIntervalMinutes,
  computeTimeSpentFromInterval,
  getLogWorkDateKey,
  getLogTimelineBounds,
  getLogTimelineDisplay,
  assignTimelineLanes,
  computeTimelineDisplayRange,
  normalizeDailyLogDetails,
  isLogEditable,
  formatLogInterval,
} from './dailyLogDetails';

describe('dailyLogDetails', () => {
  it('computes duration from start/end clock times', () => {
    expect(computeIntervalMinutes('09:00', '11:30')).toBe(150);
    expect(computeTimeSpentFromInterval('09:00', '11:30')).toBe('2h 30m');
  });

  it('uses workDate when present for day key', () => {
    const log = {
      createdAt: '2026-06-29T10:00:00.000Z',
      details: { workDate: '2026-06-20' },
    };
    expect(getLogWorkDateKey(log)).toBe('2026-06-20');
  });

  it('normalizes details with interval and work date', () => {
    const out = normalizeDailyLogDetails({
      workDate: '2026-06-15',
      startTime: '10:00',
      endTime: '12:00',
      memberIds: ['a', 'a', 'b'],
    });
    expect(out.workDate).toBe('2026-06-15');
    expect(out.timeSpent).toBe('2h');
    expect(out.memberIds).toEqual(['a', 'b']);
  });

  it('allows edit within window for recent work dates', () => {
    const today = new Date();
    const key = today.toISOString().slice(0, 10);
    const log = { details: { workDate: key }, createdAt: today.toISOString() };
    expect(isLogEditable(log, { isAdmin: false })).toBe(true);
  });

  it('builds timeline blocks from explicit start/end', () => {
    const { firstIn, lastOut, blocks } = getLogTimelineBounds([
      {
        _id: 'a',
        details: { title: 'Deep work', startTime: '09:00', endTime: '11:00' },
      },
    ]);
    expect(firstIn).toBe(9 * 60);
    expect(lastOut).toBe(11 * 60);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].estimated).toBe(false);
  });

  it('estimates timeline blocks from timeSpent and createdAt when clocks missing', () => {
    const { firstIn, lastOut, blocks } = getLogTimelineBounds([
      {
        _id: 'b',
        createdAt: '2026-06-29T15:30:00.000Z',
        details: { title: 'Legacy log', timeSpent: '1h' },
      },
    ]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].estimated).toBe(true);
    expect(blocks[0].endMin).toBe(blocks[0].startMin + 60);
    expect(firstIn).toBe(blocks[0].startMin);
    expect(lastOut).toBe(blocks[0].endMin);
  });

  it('uses 30m default block when duration unknown', () => {
    const { blocks } = getLogTimelineBounds([
      {
        _id: 'c',
        createdAt: '2026-06-29T14:00:00.000Z',
        details: { title: 'No duration' },
      },
    ]);
    expect(blocks[0].estimated).toBe(true);
    expect(blocks[0].endMin - blocks[0].startMin).toBe(30);
  });

  it('formats log interval with padded HH:mm like attendance', () => {
    expect(formatLogInterval({
      details: { startTime: '9:00', endTime: '11:30' },
    })).toBe('09:00 – 11:30');
  });

  it('extends timeline range past 22:00 when work ends later', () => {
    const { rangeStart, rangeEnd } = computeTimelineDisplayRange({
      firstIn: 9 * 60 + 2,
      lastOut: 22 * 60 + 40,
    });
    expect(rangeStart).toBe(8 * 60 + 32);
    expect(rangeEnd).toBe(23 * 60 + 10);
  });

  it('assigns separate lanes for overlapping blocks', () => {
    const { blocks, laneCount } = assignTimelineLanes([
      { id: 'a', startMin: 540, endMin: 600, title: 'A' },
      { id: 'b', startMin: 545, endMin: 605, title: 'B' },
    ]);
    expect(laneCount).toBe(2);
    expect(blocks.find((b) => b.id === 'a')?.lane).toBe(0);
    expect(blocks.find((b) => b.id === 'b')?.lane).toBe(1);
  });

  it('merges attendance bounds into timeline display range', () => {
    const display = getLogTimelineDisplay(
      [{ _id: 'x', details: { title: 'Late', startTime: '21:40', endTime: '22:40' } }],
      { attendanceInMin: 9 * 60 + 2, attendanceOutMin: 22 * 60 + 40 },
    );
    expect(display.rangeEnd).toBe(23 * 60 + 10);
    expect(display.lastOut).toBe(22 * 60 + 40);
  });
});
