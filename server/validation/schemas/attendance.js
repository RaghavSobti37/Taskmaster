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

const attendanceUndoBody = z.object({
  type: z.enum(['in', 'out']).optional(),
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

const rosterUsersQuery = z.object({
  viewMode: z.enum(['daily', 'compact', 'week', 'month']).optional(),
  monthStart: dateKey,
  monthEnd: dateKey,
});

module.exports = {
  attendanceQuery,
  attendanceCheckBody,
  attendanceUndoBody,
  leaveRequestBody,
  leaveRequestsQuery,
  leaveReviewBody,
  rosterUsersQuery,
};
