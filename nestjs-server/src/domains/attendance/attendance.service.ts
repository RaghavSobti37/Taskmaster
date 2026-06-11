import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Attendance, LeaveRequest, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../auth/auth.types';
import { isAdminUser, isOpsUser } from '../../auth/department-permissions';
import { toMongoList, toMongoShape } from '../../common/serializers/mongo-response';
import { AttendanceMetricsService } from './attendance-metrics.service';
import { newMongoId } from './attendance-id';
import { asTimeRecord, TimeRecord } from './attendance.types';
import {
  endOfDayFromKey,
  formatHHMM,
  getWeekRange,
  todayStart,
  toStartOfDay,
} from './attendance-date';

type AttendanceQuery = {
  start?: string;
  end?: string;
  mine?: 'true' | 'false';
  week?: 'current';
  weekStart?: string;
};

type CheckBody = {
  type?: 'in' | 'out';
  manualTime?: string;
  workMode?: 'office' | 'wfh';
};

type LeaveBody = {
  fromDate: string;
  toDate: string;
  reason?: string;
};

type LeaveQuery = {
  status?: 'pending' | 'approved' | 'rejected';
};

type ApproveBody = {
  approvalTarget: 'IN' | 'OUT';
  manualTime?: string;
  workMode?: 'office' | 'wfh';
};

type UpsertBody = {
  userId: string;
  username?: string;
  date: string;
  inTimeRecord?: TimeRecord;
  outTimeRecord?: TimeRecord;
  isHalfDay?: boolean;
  onLeave?: boolean;
  reason?: string;
};

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: AttendanceMetricsService,
  ) {}

  private requireTenantId(user: AuthUser): string {
    if (!user.tenantId) {
      throw new BadRequestException({ error: 'Tenant context required' });
    }
    return user.tenantId;
  }

  async listAttendance(user: AuthUser, query: AttendanceQuery) {
    const where: Prisma.AttendanceWhereInput = {};
    if (!isOpsUser(user) || query.mine === 'true') {
      where.userId = user.id;
    }

    if (query.week === 'current' || query.weekStart) {
      const range = getWeekRange(query.weekStart);
      where.date = { gte: range.weekStart, lte: range.weekEnd };
    } else if (query.start || query.end) {
      where.date = {};
      if (query.start) where.date.gte = toStartOfDay(query.start);
      if (query.end) where.date.lte = endOfDayFromKey(query.end);
    }

    const rows = await this.prisma.db.attendance.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    await Promise.all(
      rows.map((row) => {
        const inRecord = asTimeRecord(row.inTimeRecord);
        const outRecord = asTimeRecord(row.outTimeRecord);
        if (inRecord?.manualTimestamp && outRecord?.manualTimestamp) {
          return this.metrics.refreshAttendanceMetrics(row);
        }
        return null;
      }),
    );

    const refreshed = await this.prisma.db.attendance.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    return toMongoList(refreshed);
  }

  async checkInOut(user: AuthUser, body: CheckBody) {
    const tenantId = this.requireTenantId(user);
    const now = new Date();
    const today = todayStart();
    const type = body?.type === 'out' ? 'out' : 'in';

    const existing = await this.prisma.db.attendance.findFirst({
      where: { userId: user.id, date: today },
    });

    const targetRecord = type === 'in'
      ? asTimeRecord(existing?.inTimeRecord)
      : asTimeRecord(existing?.outTimeRecord);
    if (targetRecord?.isApproved) {
      throw new ForbiddenException({
        error: `${type === 'in' ? 'Check-in' : 'Check-out'} is locked for today`,
      });
    }
    if (targetRecord?.systemTimestamp) {
      throw new BadRequestException({ error: `Already marked ${type} for today` });
    }

    const timeValue = body?.manualTime || formatHHMM(now);
    const workMode = body?.workMode === 'wfh' ? 'wfh' : 'office';
    const record: TimeRecord = {
      systemTimestamp: now.toISOString(),
      manualTimestamp: timeValue,
      workMode,
      verificationMethod: 'MANUAL',
      isApproved: false,
    };

    const attendance = await this.prisma.db.attendance.upsert({
      where: {
        userId_date: {
          userId: user.id,
          date: today,
        },
      },
      create: {
        id: newMongoId(),
        tenantId,
        userId: user.id,
        username: user.name,
        date: today,
        inTimeRecord: type === 'in' ? record : {},
        outTimeRecord: type === 'out' ? record : {},
      },
      update: type === 'in'
        ? { inTimeRecord: record, username: user.name }
        : { outTimeRecord: record, username: user.name },
    });

    let result = attendance;
    const inRecord = asTimeRecord(attendance.inTimeRecord);
    const outRecord = asTimeRecord(attendance.outTimeRecord);
    if (inRecord?.manualTimestamp && outRecord?.manualTimestamp) {
      result = (await this.metrics.refreshAttendanceMetrics(attendance)) || attendance;
    }

    return toMongoShape(result);
  }

  async undoCheck(user: AuthUser, body: { type?: 'in' | 'out' }) {
    const today = todayStart();
    const type = body?.type === 'out' ? 'out' : 'in';
    const existing = await this.prisma.db.attendance.findFirst({
      where: { userId: user.id, date: today },
    });

    if (!existing) {
      throw new NotFoundException({ error: 'No attendance record for today' });
    }

    const targetRecord = type === 'in'
      ? asTimeRecord(existing.inTimeRecord)
      : asTimeRecord(existing.outTimeRecord);
    if (targetRecord?.isApproved) {
      throw new ForbiddenException({ error: 'Attendance is locked for today' });
    }
    if (!targetRecord?.systemTimestamp) {
      throw new BadRequestException({ error: `No check-${type} to undo` });
    }

    const attendance = await this.prisma.db.attendance.update({
      where: { id: existing.id },
      data: type === 'in'
        ? { inTimeRecord: {} }
        : { outTimeRecord: {} },
    });

    return toMongoShape(attendance);
  }

  async approveAttendance(user: AuthUser, id: string, body: ApproveBody) {
    if (!isOpsUser(user)) {
      throw new ForbiddenException({ error: 'Only operations can approve attendance' });
    }

    const row = await this.prisma.db.attendance.findUnique({ where: { id } });
    if (!row) throw new NotFoundException({ error: 'Attendance record not found' });
    if (row.onLeave) {
      throw new BadRequestException({ error: 'Leave entries are approved separately' });
    }

    const inTimeRecord = { ...(asTimeRecord(row.inTimeRecord) || {}) };
    const outTimeRecord = { ...(asTimeRecord(row.outTimeRecord) || {}) };

    if (body.approvalTarget === 'IN') {
      if (body.manualTime) inTimeRecord.manualTimestamp = body.manualTime;
      if (body.workMode) inTimeRecord.workMode = body.workMode;
      if (!inTimeRecord.manualTimestamp) {
        throw new BadRequestException({ error: 'Cannot approve empty IN record' });
      }
      inTimeRecord.isApproved = true;
      inTimeRecord.approvedBy = user.id;
    } else {
      if (body.manualTime) outTimeRecord.manualTimestamp = body.manualTime;
      if (body.workMode) outTimeRecord.workMode = body.workMode;
      if (!outTimeRecord.manualTimestamp) {
        throw new BadRequestException({ error: 'Cannot approve empty OUT record' });
      }
      outTimeRecord.isApproved = true;
      outTimeRecord.approvedBy = user.id;
    }

    let updatedRow = await this.prisma.db.attendance.update({
      where: { id },
      data: {
        inTimeRecord: body.approvalTarget === 'IN'
          ? inTimeRecord
          : (row.inTimeRecord as Prisma.InputJsonValue),
        outTimeRecord: body.approvalTarget === 'OUT'
          ? outTimeRecord
          : (row.outTimeRecord as Prisma.InputJsonValue),
      },
    });

    updatedRow = (await this.metrics.refreshAttendanceMetrics(updatedRow)) || updatedRow;

    const xpAward = this.metrics.isAttendanceDayLocked(updatedRow)
      ? await this.metrics.awardAttendanceXpOnDayLocked(updatedRow)
      : null;

    return { ...toMongoShape(updatedRow), xpAward };
  }

  async upsertByUserDate(user: AuthUser, body: UpsertBody) {
    if (!isOpsUser(user)) {
      throw new ForbiddenException({ error: 'Only operations can edit attendance' });
    }
    if (!body.userId || !body.date) {
      throw new BadRequestException({ error: 'userId and date are required' });
    }

    const tenantId = this.requireTenantId(user);
    const date = toStartOfDay(body.date);
    const inTimeRecord = body.inTimeRecord
      ? { ...body.inTimeRecord, verificationMethod: 'MANUAL' }
      : undefined;
    const outTimeRecord = body.outTimeRecord
      ? { ...body.outTimeRecord, verificationMethod: 'MANUAL' }
      : undefined;

    const row = await this.prisma.db.attendance.upsert({
      where: {
        userId_date: {
          userId: body.userId,
          date,
        },
      },
      create: {
        id: newMongoId(),
        tenantId,
        userId: body.userId,
        username: body.username,
        date,
        inTimeRecord: inTimeRecord || {},
        outTimeRecord: outTimeRecord || {},
        isHalfDay: !!body.isHalfDay,
        onLeave: !!body.onLeave,
        reason: body.reason || '',
        createdById: user.id,
      },
      update: {
        userId: body.userId,
        username: body.username,
        date,
        ...(inTimeRecord ? { inTimeRecord } : {}),
        ...(outTimeRecord ? { outTimeRecord } : {}),
        isHalfDay: !!body.isHalfDay,
        onLeave: !!body.onLeave,
        reason: body.reason || '',
        createdById: user.id,
      },
    });

    let result = row;
    const inRecord = asTimeRecord(row.inTimeRecord);
    const outRecord = asTimeRecord(row.outTimeRecord);
    if (inRecord?.manualTimestamp && outRecord?.manualTimestamp) {
      result = (await this.metrics.refreshAttendanceMetrics(row)) || row;
    }

    const xpAward = this.metrics.isAttendanceDayLocked(result)
      ? await this.metrics.awardAttendanceXpOnDayLocked(result)
      : null;

    return { ...toMongoShape(result), xpAward };
  }

  async createLeaveRequest(user: AuthUser, body: LeaveBody) {
    if (!body.fromDate || !body.toDate) {
      throw new BadRequestException({ error: 'fromDate and toDate are required' });
    }

    const tenantId = this.requireTenantId(user);
    const request = await this.prisma.db.leaveRequest.create({
      data: {
        id: newMongoId(),
        tenantId,
        userId: user.id,
        username: user.name,
        fromDate: toStartOfDay(body.fromDate),
        toDate: toStartOfDay(body.toDate),
        reason: body.reason || '',
        status: 'pending',
      },
    });

    return toMongoShape(request);
  }

  async listLeaveRequests(user: AuthUser, query: LeaveQuery) {
    const where: Prisma.LeaveRequestWhereInput = {};
    if (isOpsUser(user)) {
      if (query.status) where.status = query.status;
    } else {
      where.userId = user.id;
    }

    const requests = await this.prisma.db.leaveRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return this.populateLeaveRequests(requests);
  }

  async approveLeaveRequest(user: AuthUser, id: string) {
    if (!isOpsUser(user)) {
      throw new ForbiddenException({ error: 'Only operations can approve leave requests' });
    }

    const request = await this.prisma.db.leaveRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException({ error: 'Leave request not found' });
    if (request.status !== 'pending') {
      throw new BadRequestException({ error: `Leave request is already ${request.status}` });
    }

    const updated = await this.prisma.db.leaveRequest.update({
      where: { id },
      data: {
        status: 'approved',
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
    });

    await this.syncApprovedLeaveToAttendance(user, updated);

    return this.populateLeaveRequest(updated);
  }

  async rejectLeaveRequest(user: AuthUser, id: string, reviewNote?: string) {
    if (!isOpsUser(user)) {
      throw new ForbiddenException({ error: 'Only operations can reject leave requests' });
    }

    const request = await this.prisma.db.leaveRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException({ error: 'Leave request not found' });
    if (request.status !== 'pending') {
      throw new BadRequestException({ error: `Leave request is already ${request.status}` });
    }

    const updated = await this.prisma.db.leaveRequest.update({
      where: { id },
      data: {
        status: 'rejected',
        reviewedById: user.id,
        reviewedAt: new Date(),
        reviewNote: reviewNote || '',
      },
    });

    return this.populateLeaveRequest(updated);
  }

  async resetAll(user: AuthUser) {
    if (!isAdminUser(user)) {
      throw new ForbiddenException({ error: 'Not authorized — admin required' });
    }

    await this.prisma.db.attendance.deleteMany({});
    await this.prisma.db.leaveRequest.deleteMany({});
    return { message: 'All attendance records reset' };
  }

  private async syncApprovedLeaveToAttendance(user: AuthUser, leaveRequest: LeaveRequest) {
    const tenantId = this.requireTenantId(user);
    const days = this.eachDayInclusive(leaveRequest.fromDate, leaveRequest.toDate);
    await Promise.all(
      days.map((date) =>
        this.prisma.db.attendance.upsert({
          where: {
            userId_date: {
              userId: leaveRequest.userId,
              date: toStartOfDay(date),
            },
          },
          create: {
            id: newMongoId(),
            tenantId,
            userId: leaveRequest.userId,
            username: leaveRequest.username,
            date: toStartOfDay(date),
            onLeave: true,
            reason: leaveRequest.reason || '',
          },
          update: {
            onLeave: true,
            reason: leaveRequest.reason || '',
            username: leaveRequest.username,
          },
        }),
      ),
    );
  }

  private eachDayInclusive(start: Date, end: Date) {
    const days: Date[] = [];
    let current = toStartOfDay(start);
    const endDay = toStartOfDay(end);
    while (current <= endDay) {
      days.push(new Date(current));
      const next = new Date(current);
      next.setDate(next.getDate() + 1);
      current = toStartOfDay(next);
    }
    return days;
  }

  private async populateLeaveRequests(requests: LeaveRequest[]) {
    return Promise.all(requests.map((request) => this.populateLeaveRequest(request)));
  }

  private async populateLeaveRequest(request: LeaveRequest) {
    const [leaveUser, reviewer] = await Promise.all([
      this.prisma.withBypass(() => this.prisma.user.findUnique({
        where: { id: request.userId },
        select: { id: true, name: true, email: true },
      })),
      request.reviewedById
        ? this.prisma.withBypass(() => this.prisma.user.findUnique({
            where: { id: request.reviewedById! },
            select: { id: true, name: true },
          }))
        : null,
    ]);

    return toMongoShape({
      ...request,
      userId: leaveUser
        ? { _id: leaveUser.id, name: leaveUser.name, email: leaveUser.email }
        : request.userId,
      reviewedBy: reviewer
        ? { _id: reviewer.id, name: reviewer.name }
        : request.reviewedById,
    });
  }
}
