const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');
const XPAuditLog = require('../models/XPAuditLog');
const GamificationService = require('../services/gamificationService');
const {
  getDateKey,
  toStartOfDay,
  endOfDayFromKey,
  todayStart,
  formatHHMM,
  getCurrentWeekRange,
  validateAttendanceTimes,
  parseTimeToMinutes,
} = require('../utils/attendanceDate');
const { isAttendanceExcluded } = require('../utils/attendanceUsers');
const Log = require('../models/Log');
const { createNotification } = require('../services/notificationDispatcher');

const { isOpsUser, isAdminUser } = require('../utils/departmentPermissions');

const isOps = (user) => isOpsUser(user);

const STANDARD_SHIFT_MINUTES = 8 * 60;
const DISCREPANCY_THRESHOLD_MINUTES = 30;

const getOfficeIpWhitelist = () => (process.env.OFFICE_IP_WHITELIST || '')
  .split(',')
  .map((ip) => ip.trim())
  .filter(Boolean);

const resolveClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.ip || '';
};

const isOfficeIp = (ip) => {
  const whitelist = getOfficeIpWhitelist();
  if (whitelist.length === 0) return false;
  return whitelist.some((w) => ip === w || ip.endsWith(w));
};

const computeAttendanceMetrics = async (attendanceDoc) => {
  if (!attendanceDoc?.timeIn || !attendanceDoc?.timeOut) return attendanceDoc;

  const inMin = parseTimeToMinutes(attendanceDoc.timeIn);
  const outMin = parseTimeToMinutes(attendanceDoc.timeOut);
  let systemMinutes = outMin - inMin;
  if (systemMinutes < 0) systemMinutes += 24 * 60;

  const dayStart = toStartOfDay(attendanceDoc.date);
  const dayEnd = new Date(dayStart);
  dayEnd.setHours(23, 59, 59, 999);

  const logs = await Log.find({
    userId: attendanceDoc.userId,
    action: 'DAILY_LOG',
    createdAt: { $gte: dayStart, $lte: dayEnd },
    'details.type': { $ne: 'TASK_COMPLETION' }
  }).select('details').lean();

  const parseHours = (str) => {
    if (!str) return 0;
    const match = String(str).match(/([\d.]+)/);
    return match ? parseFloat(match[1]) : 0;
  };

  const loggedHours = logs.reduce((sum, l) => sum + parseHours(l.details?.timeSpent), 0);
  const systemHours = systemMinutes / 60;
  const discrepancyMinutes = Math.abs(Math.round(systemHours * 60) - Math.round(loggedHours * 60));
  const overtimeMinutes = Math.max(0, systemMinutes - STANDARD_SHIFT_MINUTES);

  attendanceDoc.systemHours = Math.round(systemHours * 100) / 100;
  attendanceDoc.loggedHours = Math.round(loggedHours * 100) / 100;
  attendanceDoc.discrepancyMinutes = discrepancyMinutes;
  attendanceDoc.overtimeMinutes = overtimeMinutes;
  await attendanceDoc.save();

  if (discrepancyMinutes >= DISCREPANCY_THRESHOLD_MINUTES) {
    await createNotification({
      recipientId: attendanceDoc.userId,
      title: 'Attendance Discrepancy Detected',
      message: `Your logged hours (${loggedHours}h) differ from system hours (${systemHours.toFixed(1)}h) for ${getDateKey(attendanceDoc.date)}.`,
      category: 'attendance',
      type: 'alert',
      actionUrl: '/attendance'
    });
  }

  return attendanceDoc;
};

const isInsideWindow = (value, targetHour, targetMinute) => {
  const d = new Date(value);
  const start = new Date(d);
  const end = new Date(d);
  start.setHours(targetHour, targetMinute - 1, 0, 0);
  end.setHours(targetHour, targetMinute, 59, 999);
  return d >= start && d <= end;
};

const getWeekRange = (weekStartInput) => getCurrentWeekRange(weekStartInput);

const materializeApprovedLeave = async (request, reviewerId) => {
  const start = toStartOfDay(request.fromDate);
  const end = toStartOfDay(request.toDate);
  const upserts = [];
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const day = new Date(date);
    upserts.push(
      Attendance.findOneAndUpdate(
        { userId: request.userId, date: day },
        {
          $set: {
            userId: request.userId,
            username: request.username,
            date: day,
            onLeave: true,
            isHalfDay: false,
            reason: request.reason || '',
            createdBy: reviewerId,
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      )
    );
  }
  return Promise.all(upserts);
};

const awardAttendanceXpIfEligible = async (attendanceDoc) => {
  if (attendanceDoc.onLeave) return;

  const dayStart = toStartOfDay(attendanceDoc.date);
  const dayEnd = new Date(dayStart);
  dayEnd.setHours(23, 59, 59, 999);

  if (attendanceDoc.timeIn && isInsideWindow(`${getDateKey(attendanceDoc.date)}T${attendanceDoc.timeIn}:00+05:30`, 10, 30)) {
    const alreadyAwarded = await XPAuditLog.findOne({
      userId: attendanceDoc.userId,
      action: 'ATTENDANCE_CHECKIN_WINDOW',
      'details.date': getDateKey(attendanceDoc.date),
      createdAt: { $gte: dayStart, $lte: dayEnd }
    });
    if (!alreadyAwarded) {
      await GamificationService.awardExp(attendanceDoc.userId, 1, 'ATTENDANCE_CHECKIN_WINDOW', {
        date: getDateKey(attendanceDoc.date),
        at: attendanceDoc.timeIn
      });
    }
  }

  if (attendanceDoc.timeOut && isInsideWindow(`${getDateKey(attendanceDoc.date)}T${attendanceDoc.timeOut}:00+05:30`, 18, 30)) {
    const alreadyAwarded = await XPAuditLog.findOne({
      userId: attendanceDoc.userId,
      action: 'ATTENDANCE_CHECKOUT_WINDOW',
      'details.date': getDateKey(attendanceDoc.date),
      createdAt: { $gte: dayStart, $lte: dayEnd }
    });
    if (!alreadyAwarded) {
      await GamificationService.awardExp(attendanceDoc.userId, 1, 'ATTENDANCE_CHECKOUT_WINDOW', {
        date: getDateKey(attendanceDoc.date),
        at: attendanceDoc.timeOut
      });
    }
  }
};

router.use(protect);

router.get('/', async (req, res) => {
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
      if (end) {
        query.date.$lte = endOfDayFromKey(end);
      }
    }

    const rows = await Attendance.find(query).sort({ date: -1 }).lean();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/check', async (req, res) => {
  try {
    const now = new Date();
    const today = todayStart();
    const todayKey = getDateKey(now);
    const type = req.body?.type === 'out' ? 'out' : 'in';
    const existing = await Attendance.findOne({ userId: req.user._id, date: today });

    if (existing?.isApproved) {
      return res.status(403).json({ error: 'Attendance is locked for today' });
    }
    if (type === 'in' && existing?.timeIn) {
      return res.status(400).json({ error: 'Already marked in for today' });
    }
    if (type === 'out' && existing?.timeOut) {
      return res.status(400).json({ error: 'Already marked out for today' });
    }
    if (type === 'out' && !existing?.timeIn) {
      return res.status(400).json({ error: 'Must check in before checking out' });
    }

    const timeValue = formatHHMM(now);
    const timeValidation = validateAttendanceTimes({
      dateKey: todayKey,
      timeIn: type === 'in' ? timeValue : existing?.timeIn,
      timeOut: type === 'out' ? timeValue : undefined,
      onLeave: false,
    });
    if (!timeValidation.ok) {
      return res.status(400).json({ error: timeValidation.error });
    }

    const clientIp = resolveClientIp(req);
    const checkInFields = type === 'in' ? {
      timeIn: timeValue,
      checkInIp: clientIp,
      workMode: isOfficeIp(clientIp) ? 'office' : 'wfh',
      onLeave: false,
    } : { timeOut: timeValue };

    const attendance = await Attendance.findOneAndUpdate(
      { userId: req.user._id, date: today },
      {
        $set: {
          userId: req.user._id,
          username: req.user.name,
          date: today,
          ...checkInFields,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    if (type === 'out' && attendance.timeIn && attendance.timeOut) {
      await computeAttendanceMetrics(attendance);
    }

    await awardAttendanceXpIfEligible(attendance);
    await GamificationService.awardActionXp(req.user._id, 'ATTENDANCE_ACTION', { type });
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/check/undo', async (req, res) => {
  try {
    const today = todayStart();
    const type = req.body?.type === 'out' ? 'out' : 'in';
    const existing = await Attendance.findOne({ userId: req.user._id, date: today });

    if (!existing) {
      return res.status(404).json({ error: 'No attendance record for today' });
    }
    if (existing.isApproved) {
      return res.status(403).json({ error: 'Attendance is locked for today' });
    }
    if (type === 'in' && !existing.timeIn) {
      return res.status(400).json({ error: 'No check-in to undo' });
    }
    if (type === 'out' && !existing.timeOut) {
      return res.status(400).json({ error: 'No check-out to undo' });
    }

    const update = type === 'in' ? { $unset: { timeIn: '' } } : { $unset: { timeOut: '' } };
    const attendance = await Attendance.findOneAndUpdate(
      { userId: req.user._id, date: today },
      update,
      { new: true }
    );
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/approve', async (req, res) => {
  try {
    if (!isOps(req.user)) {
      return res.status(403).json({ error: 'Only operations can approve attendance' });
    }

    const row = await Attendance.findById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Attendance record not found' });
    if (row.onLeave) {
      return res.status(400).json({ error: 'Leave entries are approved separately' });
    }
    if (!row.timeIn && !row.timeOut) {
      return res.status(400).json({ error: 'Cannot approve empty attendance' });
    }

    row.isApproved = true;
    row.approvedBy = req.user._id;
    row.approvedAt = new Date();
    await row.save();
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/leave', async (req, res) => {
  try {
    const { fromDate, toDate, reason } = req.body;
    if (!fromDate || !toDate) return res.status(400).json({ error: 'fromDate and toDate are required' });

    const start = toStartOfDay(fromDate);
    const end = toStartOfDay(toDate);
    if (end < start) return res.status(400).json({ error: 'toDate must be after fromDate' });

    const request = await LeaveRequest.create({
      userId: req.user._id,
      username: req.user.name,
      fromDate: start,
      toDate: end,
      reason: reason || '',
      status: 'pending',
    });

    await GamificationService.awardActionXp(req.user._id, 'LEAVE_APPLIED', { fromDate, toDate });
    res.status(201).json(request);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/leave/requests', async (req, res) => {
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
    if (!isOps(req.user)) return res.status(403).json({ error: 'Only operations can approve leave' });
    const request = await LeaveRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Leave request not found' });
    if (request.status !== 'pending') return res.status(400).json({ error: 'Leave request already processed' });

    request.status = 'approved';
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    request.reviewNote = req.body?.reviewNote || '';
    await request.save();

    await createNotification({
      recipientId: request.userId,
      title: 'Leave Request Approved',
      message: `Your leave from ${getDateKey(request.fromDate)} to ${getDateKey(request.toDate)} was approved.`,
      category: 'attendance',
      actionUrl: '/attendance'
    });

    const records = await materializeApprovedLeave(request, req.user._id);
    res.json({ request, records });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/leave/requests/:id/reject', async (req, res) => {
  try {
    if (!isOps(req.user)) return res.status(403).json({ error: 'Only operations can reject leave' });
    const request = await LeaveRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Leave request not found' });
    if (request.status !== 'pending') return res.status(400).json({ error: 'Leave request already processed' });

    request.status = 'rejected';
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    request.reviewNote = req.body?.reviewNote || req.body?.reason || '';
    await request.save();

    await createNotification({
      recipientId: request.userId,
      title: 'Leave Request Rejected',
      message: request.reviewNote || 'Your leave request was not approved.',
      category: 'attendance',
      type: 'alert',
      actionUrl: '/attendance'
    });

    res.json(request);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/reset', async (req, res) => {
  try {
    if (!isAdminUser(req.user)) return res.status(403).json({ error: 'Only admins can reset attendance data' });
    const [attendanceResult, leaveResult] = await Promise.all([
      Attendance.deleteMany({}),
      LeaveRequest.deleteMany({}),
    ]);
    res.json({
      message: 'Attendance data reset successfully',
      deleted: {
        attendance: attendanceResult.deletedCount,
        leaveRequests: leaveResult.deletedCount,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (!isOps(req.user)) return res.status(403).json({ error: 'Only operations can edit attendance' });
    const allowed = ['timeIn', 'timeOut', 'isHalfDay', 'onLeave', 'reason', 'date', 'userId', 'username', 'isApproved', 'workMode'];
    const payload = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) payload[key] = req.body[key];
    }
    if (payload.userId && !payload.username) {
      const user = await User.findById(payload.userId).select('name');
      if (user) payload.username = user.name;
    }
    if (payload.workMode) {
      payload.workModeOverrideBy = req.user._id;
    }

    const existing = await Attendance.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Attendance record not found' });

    const dateKey = getDateKey(payload.date || existing.date);
    const timeValidation = validateAttendanceTimes({
      dateKey,
      timeIn: payload.timeIn !== undefined ? payload.timeIn : existing.timeIn,
      timeOut: payload.timeOut !== undefined ? payload.timeOut : existing.timeOut,
      onLeave: payload.onLeave !== undefined ? payload.onLeave : existing.onLeave,
      isHalfDay: payload.isHalfDay !== undefined ? payload.isHalfDay : existing.isHalfDay,
    });
    if (!timeValidation.ok) {
      return res.status(400).json({ error: timeValidation.error });
    }

    const row = await Attendance.findByIdAndUpdate(req.params.id, { $set: payload }, { new: true });
    await awardAttendanceXpIfEligible(row);
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/upsert/by-user-date', async (req, res) => {
  try {
    if (!isOps(req.user)) return res.status(403).json({ error: 'Only operations can edit attendance' });
    const { userId, username, date, timeIn, timeOut, isHalfDay, onLeave, reason } = req.body;
    if (!userId || !date) return res.status(400).json({ error: 'userId and date are required' });

    const dateKey = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())
      ? date.trim()
      : getDateKey(date);
    const timeValidation = validateAttendanceTimes({
      dateKey,
      timeIn: timeIn || '',
      timeOut: timeOut || '',
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
          timeIn,
          timeOut,
          isHalfDay: !!isHalfDay,
          onLeave: !!onLeave,
          reason: reason || '',
          createdBy: req.user._id
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    await awardAttendanceXpIfEligible(row);
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
