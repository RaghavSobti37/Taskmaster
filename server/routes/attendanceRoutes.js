const express = require('express');

const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { isOpsUser, isAdminUser } = require('../utils/departmentPermissions');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const { awardAttendanceXpOnDayLocked, isAttendanceDayLocked } = require('../utils/attendanceXp');
const { refreshAttendanceMetrics } = require('../utils/refreshAttendanceMetrics');
const {
  getDateKey,
  toStartOfDay,
  endOfDayFromKey,
  todayStart,
  formatHHMM,
  getCurrentWeekRange,
  getWeekRange,
  validateAttendanceTimes,
} = require('../utils/attendanceDate');
const { syncApprovedLeaveToAttendance } = require('../utils/leaveApprovalSync');
const { createNotification } = require('../services/notificationDispatcher');
const { validateQuery } = require('../validation/validateQuery');
const { validateBody } = require('../validation/validateBody');
const {
  attendanceQuery,
  attendanceCheckBody,
  attendanceUndoBody,
  leaveRequestBody,
  leaveRequestsQuery,
  leaveReviewBody,
  rosterUsersQuery,
} = require('../validation/schemas/attendance');
const { getVisibleRosterUsers } = require('../utils/attendanceRosterService');
const { publishDomainEvent } = require('../services/sync/eventBus');
const { mapAttendanceRow } = require('../services/sync/syncPayloadMappers');
const {
  getAttendanceStatsCache,
  setAttendanceStatsCache,
  bustAttendanceCacheForUser,
  bustAllAttendanceCache,
} = require('../services/hybridCache');

const emitAttendanceEvent = (eventType, doc) => {
  const row = mapAttendanceRow(doc?.toObject ? doc.toObject() : doc);
  if (!row) return;
  publishDomainEvent(eventType, row, { entityId: row.id }).catch(() => {});
};

const isOps = (user) => isOpsUser(user);

const STANDARD_SHIFT_MINUTES = 8 * 60;
const DISCREPANCY_THRESHOLD_MINUTES = 30;

const computeAttendanceMetrics = (attendanceDoc) => refreshAttendanceMetrics(attendanceDoc);

router.use(protect);

router.get('/roster-users', validateQuery(rosterUsersQuery), async (req, res) => {
  try {
    if (!isOps(req.user)) {
      return res.status(403).json({ error: 'Operations access required' });
    }

    const users = await getVisibleRosterUsers({
      viewMode: req.query.viewMode,
      monthStart: req.query.monthStart,
      monthEnd: req.query.monthEnd,
    });

    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', validateQuery(attendanceQuery), async (req, res) => {
  try {
    const { start, end, mine, week, weekStart } = req.query;
    const query = {};
    if (!isOps(req.user) || mine === 'true') {
      query.userId = req.user._id;
    }

    if (week === 'current' || weekStart) {
      const range = getWeekRange(weekStart);
      query.date = { $gte: range.weekStart, $lte: range.weekEnd };
    } else if (start || end) {
      query.date = {};
      if (start) query.date.$gte = toStartOfDay(start);
      if (end) query.date.$lte = endOfDayFromKey(end);
    }

    const rangeKey = JSON.stringify({ start, end, mine, week, weekStart });
    const cacheUserId = String(query.userId || req.user._id);
    const cached = await getAttendanceStatsCache(cacheUserId, rangeKey);
    if (cached) {
      return res.json(cached);
    }

    const rows = await Attendance.find(query).sort({ date: -1 });
    await Promise.all(
      rows.map((row) => {
        if (row.inTimeRecord?.manualTimestamp && row.outTimeRecord?.manualTimestamp) {
          return refreshAttendanceMetrics(row);
        }
        return null;
      })
    );
    const payload = rows.map((row) => (row.toObject ? row.toObject() : row));
    await setAttendanceStatsCache(cacheUserId, rangeKey, payload);
    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/check', validateBody(attendanceCheckBody), async (req, res) => {
  try {
    const now = new Date();
    const today = todayStart();
    const type = req.body?.type === 'out' ? 'out' : 'in';
    const tenantId = req.user?.tenantId || req.tenantId;
    const ownAttendanceQuery = { userId: req.user._id, date: today };

    const existing = await Attendance.findOne(ownAttendanceQuery).setOptions({ bypassTenant: true });

    const targetRecord = type === 'in' ? existing?.inTimeRecord : existing?.outTimeRecord;
    if (targetRecord?.isApproved) {
      return res.status(403).json({ error: `${type === 'in' ? 'Check-in' : 'Check-out'} is locked for today` });
    }
    if (targetRecord?.systemTimestamp) {
      return res.status(400).json({ error: `Already marked ${type} for today` });
    }

    const timeValue = req.body?.manualTime || formatHHMM(now);
    const workMode = req.body?.workMode === 'wfh' ? 'wfh' : 'office';
    const verificationMethod = 'MANUAL';
    const timeValidation = validateAttendanceTimes({
      dateKey: getDateKey(today),
      timeIn: type === 'in' ? timeValue : existing?.inTimeRecord?.manualTimestamp,
      timeOut: type === 'out' ? timeValue : existing?.outTimeRecord?.manualTimestamp,
      onLeave: existing?.onLeave,
      isHalfDay: existing?.isHalfDay,
    });
    if (!timeValidation.ok) {
      return res.status(400).json({ error: timeValidation.error });
    }

    const updateBlock = type === 'in'
      ? { 'inTimeRecord': { systemTimestamp: now, manualTimestamp: timeValue, workMode, verificationMethod, isApproved: false } }
      : { 'outTimeRecord': { systemTimestamp: now, manualTimestamp: timeValue, workMode, verificationMethod, isApproved: false } };

    const attendance = await Attendance.findOneAndUpdate(
      ownAttendanceQuery,
      {
        $set: {
          userId: req.user._id,
          username: req.user.name,
          date: today,
          ...(tenantId ? { tenantId } : {}),
          ...updateBlock,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).setOptions({ bypassTenant: true });

    if (attendance.inTimeRecord?.manualTimestamp && attendance.outTimeRecord?.manualTimestamp) {
      await computeAttendanceMetrics(attendance);
    }

    const payload = attendance.toObject ? attendance.toObject() : attendance;
    emitAttendanceEvent('attendance.checked', payload);
    await bustAttendanceCacheForUser(String(req.user._id));
    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/check/undo', validateBody(attendanceUndoBody), async (req, res) => {
  try {
    const today = todayStart();
    const type = req.body?.type === 'out' ? 'out' : 'in';
    const existing = await Attendance.findOne({ userId: req.user._id, date: today });

    if (!existing) return res.status(404).json({ error: 'No attendance record for today' });

    const targetRecord = type === 'in' ? existing.inTimeRecord : existing.outTimeRecord;
    if (targetRecord?.isApproved) {
      return res.status(403).json({ error: 'Attendance is locked for today' });
    }
    if (!targetRecord?.systemTimestamp) {
      return res.status(400).json({ error: `No check-${type} to undo` });
    }

    const updateBlock = type === 'in'
      ? { $unset: { 'inTimeRecord': '' } }
      : { $unset: { 'outTimeRecord': '' } };

    const attendance = await Attendance.findOneAndUpdate(
      { userId: req.user._id, date: today },
      updateBlock,
      { new: true }
    );
    await bustAttendanceCacheForUser(String(req.user._id));
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/approve', async (req, res) => {
  try {
    if (!isOps(req.user)) return res.status(403).json({ error: 'Only operations can approve attendance' });

    const { approvalTarget, manualTime, workMode } = req.body;
    if (approvalTarget !== 'IN' && approvalTarget !== 'OUT') {
      return res.status(400).json({ error: 'Invalid approval target. Must be IN or OUT.' });
    }

    const row = await Attendance.findById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Attendance record not found' });
    if (row.onLeave) return res.status(400).json({ error: 'Leave entries are approved separately' });

    if (approvalTarget === 'IN') {
      if (!row.inTimeRecord) row.inTimeRecord = {};
      if (manualTime) row.inTimeRecord.manualTimestamp = manualTime;
      if (workMode) row.inTimeRecord.workMode = workMode;
      
      if (!row.inTimeRecord.manualTimestamp) return res.status(400).json({ error: 'Cannot approve empty IN record' });
      
      row.inTimeRecord.isApproved = true;
      row.inTimeRecord.approvedBy = req.user._id;
    } else {
      if (!row.outTimeRecord) row.outTimeRecord = {};
      if (manualTime) row.outTimeRecord.manualTimestamp = manualTime;
      if (workMode) row.outTimeRecord.workMode = workMode;
      
      if (!row.outTimeRecord.manualTimestamp) return res.status(400).json({ error: 'Cannot approve empty OUT record' });
      
      row.outTimeRecord.isApproved = true;
      row.outTimeRecord.approvedBy = req.user._id;
    }
    const timeValidation = validateAttendanceTimes({
      dateKey: getDateKey(row.date),
      timeIn: row.inTimeRecord?.manualTimestamp,
      timeOut: row.outTimeRecord?.manualTimestamp,
      onLeave: row.onLeave,
      isHalfDay: row.isHalfDay,
    });
    if (!timeValidation.ok) {
      return res.status(400).json({ error: timeValidation.error });
    }

    const updatedRow = await computeAttendanceMetrics(row);
    await updatedRow.save();

    let xpAward = null;
    if (isAttendanceDayLocked(updatedRow)) {
      xpAward = await awardAttendanceXpOnDayLocked(updatedRow);
    }

    const payload = { ...updatedRow.toObject(), xpAward };
    emitAttendanceEvent('attendance.updated', updatedRow);
    await bustAttendanceCacheForUser(String(updatedRow.userId));
    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/upsert/by-user-date', async (req, res) => {
  try {
    if (!isOps(req.user)) return res.status(403).json({ error: 'Only operations can edit attendance' });
    const { userId, username, date, inTimeRecord, outTimeRecord, isHalfDay, onLeave, reason } = req.body;
    if (!userId || !date) return res.status(400).json({ error: 'userId and date are required' });
    const timeValidation = validateAttendanceTimes({
      dateKey: getDateKey(toStartOfDay(date)),
      timeIn: inTimeRecord?.manualTimestamp,
      timeOut: outTimeRecord?.manualTimestamp,
      onLeave: !!onLeave,
      isHalfDay: !!isHalfDay,
    });
    if (!timeValidation.ok) {
      return res.status(400).json({ error: timeValidation.error });
    }

    const row = await Attendance.findOneAndUpdate(
      { userId, date: toStartOfDay(date) },
      {
        $set: {
          userId,
          username,
          date: toStartOfDay(date),
          inTimeRecord: inTimeRecord ? { ...inTimeRecord, verificationMethod: 'MANUAL' } : undefined,
          outTimeRecord: outTimeRecord ? { ...outTimeRecord, verificationMethod: 'MANUAL' } : undefined,
          isHalfDay: !!isHalfDay,
          onLeave: !!onLeave,
          reason: reason || '',
          createdBy: req.user._id
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    if (row.inTimeRecord?.manualTimestamp && row.outTimeRecord?.manualTimestamp) {
      await computeAttendanceMetrics(row);
    }

    let xpAward = null;
    if (isAttendanceDayLocked(row)) {
      xpAward = await awardAttendanceXpOnDayLocked(row);
    }

    const upsertPayload = { ...(row.toObject ? row.toObject() : row), xpAward };
    emitAttendanceEvent('attendance.updated', row);
    await bustAttendanceCacheForUser(String(row.userId));
    res.json(upsertPayload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/leave', validateBody(leaveRequestBody), async (req, res) => {
  // Unchanged leave functionality
  try {
    const { fromDate, toDate, reason } = req.body;
    if (!fromDate || !toDate) return res.status(400).json({ error: 'fromDate and toDate are required' });
    const start = toStartOfDay(fromDate);
    const end = toStartOfDay(toDate);
    const request = await LeaveRequest.create({
      userId: req.user._id,
      username: req.user.name,
      fromDate: start,
      toDate: end,
      reason: reason || '',
      status: 'pending',
    });
    res.status(201).json(request);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/leave/requests', validateQuery(leaveRequestsQuery), async (req, res) => {
  try {
    const query = {};
    if (isOps(req.user)) {
      if (req.query.status) query.status = req.query.status;
    } else {
      query.userId = req.user._id;
    }
    const requests = await LeaveRequest.find(query)
      .populate('userId', 'name email')
      .populate('reviewedBy', 'name')
      .sort({ createdAt: -1 })
      .lean();
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/leave/requests/:id/approve', async (req, res) => {
  try {
    if (!isOps(req.user)) {
      return res.status(403).json({ error: 'Only operations can approve leave requests' });
    }

    const request = await LeaveRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Leave request not found' });
    if (request.status !== 'pending') {
      return res.status(400).json({ error: `Leave request is already ${request.status}` });
    }

    request.status = 'approved';
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    await request.save();

    await syncApprovedLeaveToAttendance(request);

    const populated = await LeaveRequest.findById(request._id)
      .populate('userId', 'name email')
      .populate('reviewedBy', 'name')
      .lean();

    res.json(populated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/leave/requests/:id/reject', validateBody(leaveReviewBody), async (req, res) => {
  try {
    if (!isOps(req.user)) {
      return res.status(403).json({ error: 'Only operations can reject leave requests' });
    }

    const request = await LeaveRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Leave request not found' });
    if (request.status !== 'pending') {
      return res.status(400).json({ error: `Leave request is already ${request.status}` });
    }

    request.status = 'rejected';
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    request.reviewNote = req.body?.reviewNote || '';
    await request.save();

    const populated = await LeaveRequest.findById(request._id)
      .populate('userId', 'name email')
      .populate('reviewedBy', 'name')
      .lean();

    res.json(populated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/reset', async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ error: 'Not authorized — admin required' });
    }
    await Attendance.deleteMany({});
    await LeaveRequest.deleteMany({});
    await bustAllAttendanceCache();
    res.json({ message: 'All attendance records reset' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
