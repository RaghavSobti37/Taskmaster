const mongoose = require('mongoose');
const {
  isAttendanceDayLocked,
  awardAttendanceXpOnDayLocked,
} = require('../utils/attendanceXp');
const GamificationService = require('../services/gamificationService');
const XPAuditLog = require('../models/XPAuditLog');
const User = require('../models/User');
const GamificationConfig = require('../models/GamificationConfig');

describe('attendance XP on admin lock', () => {
  test('isAttendanceDayLocked requires both approved in and out', () => {
    expect(
      isAttendanceDayLocked({
        inTimeRecord: { manualTimestamp: '09:00', isApproved: true },
        outTimeRecord: { manualTimestamp: '18:00', isApproved: false },
      })
    ).toBe(false);
    expect(
      isAttendanceDayLocked({
        inTimeRecord: { manualTimestamp: '09:00', isApproved: true },
        outTimeRecord: { manualTimestamp: '18:00', isApproved: true },
      })
    ).toBe(true);
  });

  test('awardAttendanceXpOnDayLocked grants once per day', async () => {
    const userId = new mongoose.Types.ObjectId();
    await User.create({ _id: userId, name: 'Att', email: 'att@test.com', exp: 0, level: 1 });
    await GamificationConfig.create({ attendanceLog: 15, attendanceDayBonus: 5 });

    const attendance = {
      _id: new mongoose.Types.ObjectId(),
      userId,
      date: new Date('2026-06-02T00:00:00.000Z'),
      systemHours: 8,
      discrepancyMinutes: 0,
      inTimeRecord: { manualTimestamp: '09:00', isApproved: true },
      outTimeRecord: { manualTimestamp: '18:00', isApproved: true },
      save: jest.fn().mockResolvedValue(true),
    };

    const first = await awardAttendanceXpOnDayLocked(attendance);
    expect(first.awarded).toBe(true);

    const second = await awardAttendanceXpOnDayLocked(attendance);
    expect(second.reason).toBe('already_granted');

    const count = await XPAuditLog.countDocuments({ userId, action: 'ATTENDANCE_ACTION' });
    expect(count).toBe(1);
  });
});
