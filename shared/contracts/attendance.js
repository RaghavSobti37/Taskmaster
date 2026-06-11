const { z } = require('zod');

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();

const attendanceQuery = z.object({
  start: dateKey,
  end: dateKey,
  mine: z.enum(['true', 'false']).optional(),
  week: z.enum(['current']).optional(),
  weekStart: dateKey,
});

const attendanceCheckBody = z.object({
  type: z.enum(['in', 'out']).optional(),
  manualTime: z.string().optional(),
  workMode: z.enum(['office', 'wfh']).optional(),
});

const leaveRequestBody = z.object({
  fromDate: z.string().min(1),
  toDate: z.string().min(1),
  reason: z.string().optional(),
});

const leaveRequestsQuery = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
});

const leaveReviewBody = z.object({
  reviewNote: z.string().optional(),
});

const approveAttendanceBody = z.object({
  approvalTarget: z.enum(['IN', 'OUT']),
  manualTime: z.string().optional(),
  workMode: z.enum(['office', 'wfh']).optional(),
});

const upsertAttendanceBody = z.object({
  userId: z.string().min(1),
  username: z.string().optional(),
  date: z.string().min(1),
  inTimeRecord: z.record(z.unknown()).optional(),
  outTimeRecord: z.record(z.unknown()).optional(),
  isHalfDay: z.boolean().optional(),
  onLeave: z.boolean().optional(),
  reason: z.string().optional(),
});

module.exports = {
  attendanceQuery,
  attendanceCheckBody,
  leaveRequestBody,
  leaveRequestsQuery,
  leaveReviewBody,
  approveAttendanceBody,
  upsertAttendanceBody,
};
