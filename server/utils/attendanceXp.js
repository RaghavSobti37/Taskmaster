const GamificationService = require('../services/gamificationService');
const { getDateKey } = require('./attendanceDate');

const STANDARD_SHIFT_HOURS = 8;
const DISCREPANCY_THRESHOLD_MINUTES = 30;

/** Day is locked when ops approved both check-in and check-out. */
function isAttendanceDayLocked(attendanceDoc) {
  const row = attendanceDoc?.toObject ? attendanceDoc.toObject() : attendanceDoc;
  return Boolean(
    row?.inTimeRecord?.manualTimestamp
    && row?.outTimeRecord?.manualTimestamp
    && row.inTimeRecord.isApproved
    && row.outTimeRecord.isApproved
  );
}

/**
 * Award full-day attendance XP once per calendar day, only after admin lock.
 * @returns {{ awarded: boolean, mainXp: object|null, bonusXp: object|null }}
 */
async function awardAttendanceXpOnDayLocked(attendanceDoc) {
  if (!attendanceDoc || !isAttendanceDayLocked(attendanceDoc)) {
    return { awarded: false, mainXp: null, bonusXp: null, reason: 'not_locked' };
  }
  if (attendanceDoc.xpGrantedAt) {
    return { awarded: false, mainXp: null, bonusXp: null, reason: 'already_granted' };
  }

  const hours = Number(attendanceDoc.systemHours) || 0;
  if (hours <= 0) {
    return { awarded: false, mainXp: null, bonusXp: null, reason: 'no_hours' };
  }

  const dateKey = getDateKey(attendanceDoc.date);
  const mainXp = await GamificationService.awardActionXp(
    attendanceDoc.userId,
    'ATTENDANCE_ACTION',
    { date: dateKey, hours },
    { entityKey: 'date', entityId: dateKey }
  );

  let bonusXp = null;
  if (
    hours >= STANDARD_SHIFT_HOURS
    && (attendanceDoc.discrepancyMinutes || 0) < DISCREPANCY_THRESHOLD_MINUTES
  ) {
    bonusXp = await GamificationService.awardActionXp(
      attendanceDoc.userId,
      'ATTENDANCE_DAY_BONUS',
      { date: dateKey, at: attendanceDoc.outTimeRecord?.manualTimestamp },
      { entityKey: 'date', entityId: `${dateKey}:bonus` }
    );
  }

  if (mainXp) {
    attendanceDoc.xpGrantedAt = new Date();
    await attendanceDoc.save();
    await GamificationService.progressMission(attendanceDoc.userId, 'ATTENDANCE_DAY', 1);
    return { awarded: true, mainXp, bonusXp, reason: 'granted' };
  }

  return { awarded: false, mainXp: null, bonusXp, reason: 'deduped_or_zero' };
}

module.exports = {
  isAttendanceDayLocked,
  awardAttendanceXpOnDayLocked,
  STANDARD_SHIFT_HOURS,
  DISCREPANCY_THRESHOLD_MINUTES,
};
