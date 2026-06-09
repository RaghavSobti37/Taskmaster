import { describe, it, expect } from 'vitest';
import {
  filterAttendanceRosterUsers,
  hasAttendanceActivity,
  leaveOverlapsRange,
  buildVirtualLeaveEntry,
  ROSTER_VIEW_MODES,
} from '../utils/attendanceRosterVisibility';

const today = new Date('2026-06-09T12:00:00');
const userA = { _id: 'user-a', name: 'Deepank Soni', email: 'deepank@example.com' };
const userB = { _id: 'user-b', name: 'Root Admin', email: 'admin@example.com' };
const userC = { _id: 'user-c', name: 'Ishaan Sobti', email: 'ishaan@example.com' };

describe('attendanceRosterVisibility', () => {
  it('hasAttendanceActivity detects check-in/out, leave, and half-day', () => {
    expect(hasAttendanceActivity(null)).toBe(false);
    expect(hasAttendanceActivity({ inTimeRecord: { systemTimestamp: new Date() } })).toBe(true);
    expect(hasAttendanceActivity({ onLeave: true })).toBe(true);
    expect(hasAttendanceActivity({ isHalfDay: true })).toBe(true);
    expect(hasAttendanceActivity({ date: today })).toBe(false);
  });

  it('shows user with activity in last 7 days', () => {
    const visible = filterAttendanceRosterUsers({
      users: [userA, userB],
      activityRows: [
        { userId: 'user-a', date: new Date('2026-06-08'), inTimeRecord: { manualTimestamp: '09:00' } },
      ],
      approvedLeaves: [],
      today,
      viewMode: ROSTER_VIEW_MODES.DAILY,
    });
    expect(visible.map((u) => u._id)).toEqual(['user-a']);
  });

  it('hides inactive users without approved leave', () => {
    const visible = filterAttendanceRosterUsers({
      users: [userB, userC],
      activityRows: [],
      approvedLeaves: [],
      today,
      viewMode: ROSTER_VIEW_MODES.DAILY,
    });
    expect(visible).toHaveLength(0);
  });

  it('keeps user visible during approved leave window', () => {
    const visible = filterAttendanceRosterUsers({
      users: [userC],
      activityRows: [],
      approvedLeaves: [{
        userId: 'user-c',
        status: 'approved',
        fromDate: new Date('2026-06-08'),
        toDate: new Date('2026-06-12'),
      }],
      today,
      viewMode: ROSTER_VIEW_MODES.DAILY,
    });
    expect(visible.map((u) => u._id)).toEqual(['user-c']);
  });

  it('shows user in month view when they have activity in selected month', () => {
    const visible = filterAttendanceRosterUsers({
      users: [userB],
      activityRows: [],
      monthActivityRows: [
        { userId: 'user-b', date: new Date('2026-05-15'), inTimeRecord: { manualTimestamp: '09:00' } },
      ],
      approvedLeaves: [],
      today,
      viewMode: ROSTER_VIEW_MODES.MONTH,
      monthRange: { start: new Date('2026-05-01'), end: new Date('2026-05-31') },
    });
    expect(visible.map((u) => u._id)).toEqual(['user-b']);
  });

  it('leaveOverlapsRange matches inclusive date ranges', () => {
    const leave = {
      status: 'approved',
      fromDate: new Date('2026-06-10'),
      toDate: new Date('2026-06-12'),
    };
    expect(leaveOverlapsRange(leave, new Date('2026-06-09'), new Date('2026-06-09'))).toBe(false);
    expect(leaveOverlapsRange(leave, new Date('2026-06-10'), new Date('2026-06-10'))).toBe(true);
    expect(leaveOverlapsRange(leave, new Date('2026-06-08'), new Date('2026-06-11'))).toBe(true);
  });

  it('buildVirtualLeaveEntry creates onLeave row for approved leave day', () => {
    const entry = buildVirtualLeaveEntry('user-c', new Date('2026-06-11'), [{
      userId: 'user-c',
      status: 'approved',
      fromDate: new Date('2026-06-10'),
      toDate: new Date('2026-06-12'),
      reason: 'Travel',
    }]);
    expect(entry).toMatchObject({ onLeave: true, reason: 'Travel' });
  });
});
