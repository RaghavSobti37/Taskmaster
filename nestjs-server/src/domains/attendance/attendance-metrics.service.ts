import { Injectable } from '@nestjs/common';
import { Attendance } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharedMetrics = require('../../../../shared/attendanceMetrics.js');
import { asTimeRecord } from './attendance.types';

const STANDARD_SHIFT_MINUTES = 8 * 60;

@Injectable()
export class AttendanceMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async refreshAttendanceMetrics(attendanceDoc: Attendance | null): Promise<Attendance | null> {
    if (!attendanceDoc) return null;
    const inRecord = asTimeRecord(attendanceDoc.inTimeRecord);
    const outRecord = asTimeRecord(attendanceDoc.outTimeRecord);
    const inTime = inRecord?.manualTimestamp;
    const outTime = outRecord?.manualTimestamp;
    if (!inTime || !outTime) return attendanceDoc;

    const metrics = sharedMetrics.buildAttendanceMetrics({
      inTime,
      outTime,
      loggedMinutes: 0,
    });
    const workedMinutes = metrics.workedMinutes;

    return this.prisma.db.attendance.update({
      where: { id: attendanceDoc.id },
      data: {
        systemHours: metrics.systemHours,
        loggedHours: metrics.loggedHours,
        unloggedMinutes: metrics.unloggedMinutes,
        discrepancyMinutes: metrics.unloggedMinutes,
        overtimeMinutes: Math.max(0, workedMinutes - STANDARD_SHIFT_MINUTES),
      },
    });
  }

  isAttendanceDayLocked(attendanceDoc: Attendance | null) {
    if (!attendanceDoc) return false;
    const inRecord = asTimeRecord(attendanceDoc.inTimeRecord);
    const outRecord = asTimeRecord(attendanceDoc.outTimeRecord);
    return Boolean(
      inRecord?.manualTimestamp
      && outRecord?.manualTimestamp
      && inRecord?.isApproved
      && outRecord?.isApproved,
    );
  }

  async awardAttendanceXpOnDayLocked(attendanceDoc: Attendance | null) {
    if (!attendanceDoc || !this.isAttendanceDayLocked(attendanceDoc)) {
      return null;
    }
    if (attendanceDoc.xpGrantedAt) {
      return { awarded: false, mainXp: null, bonusXp: null, reason: 'already_granted' };
    }
    return null;
  }
}
