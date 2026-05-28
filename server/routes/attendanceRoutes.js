const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');
const XPAuditLog = require('../models/XPAuditLog');
const GamificationService = require('../services/gamificationService');

const OPS_ROLES = new Set(['admin', 'ops', 'operations', 'Operations']);

const isOps = (user) => OPS_ROLES.has(user?.role);
const toStartOfDay = (date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const formatHHMM = (date = new Date()) => {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

const isInsideWindow = (value, targetHour, targetMinute) => {
  const d = new Date(value);
  const start = new Date(d);
  const end = new Date(d);
  start.setHours(targetHour, targetMinute - 1, 0, 0);
  end.setHours(targetHour, targetMinute, 59, 999);
  return d >= start && d <= end;
};

const getWeekRange = (weekStartInput) => {
  let weekStart;
  if (weekStartInput) {
    weekStart = toStartOfDay(weekStartInput);
  } else {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    weekStart = new Date(now);
    weekStart.setDate(now.getDate() + diffToMonday);
    weekStart.setHours(0, 0, 0, 0);
  }
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return { weekStart, weekEnd };
};

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

  if (attendanceDoc.timeIn && isInsideWindow(`${dayStart.toISOString().slice(0, 10)}T${attendanceDoc.timeIn}:00`, 10, 30)) {
    const alreadyAwarded = await XPAuditLog.findOne({
      userId: attendanceDoc.userId,
      action: 'ATTENDANCE_CHECKIN_WINDOW',
      'details.date': dayStart.toISOString().slice(0, 10),
      createdAt: { $gte: dayStart, $lte: dayEnd }
    });
    if (!alreadyAwarded) {
      await GamificationService.awardExp(attendanceDoc.userId, 1, 'ATTENDANCE_CHECKIN_WINDOW', {
        date: dayStart.toISOString().slice(0, 10),
        at: attendanceDoc.timeIn
      });
    }
  }

  if (attendanceDoc.timeOut && isInsideWindow(`${dayStart.toISOString().slice(0, 10)}T${attendanceDoc.timeOut}:00`, 18, 30)) {
    const alreadyAwarded = await XPAuditLog.findOne({
      userId: attendanceDoc.userId,
      action: 'ATTENDANCE_CHECKOUT_WINDOW',
      'details.date': dayStart.toISOString().slice(0, 10),
      createdAt: { $gte: dayStart, $lte: dayEnd }
    });
    if (!alreadyAwarded) {
      await GamificationService.awardExp(attendanceDoc.userId, 1, 'ATTENDANCE_CHECKOUT_WINDOW', {
        date: dayStart.toISOString().slice(0, 10),
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
        const endDate = toStartOfDay(end);
        endDate.setHours(23, 59, 59, 999);
        query.date.$lte = endDate;
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
    const today = toStartOfDay(now);
    const type = req.body?.type === 'out' ? 'out' : 'in';
    const timeValue = req.body?.time || formatHHMM(now);

    const attendance = await Attendance.findOneAndUpdate(
      { userId: req.user._id, date: today },
      {
        $set: {
          userId: req.user._id,
          username: req.user.name,
          date: today,
          ...(type === 'in' ? { timeIn: timeValue } : { timeOut: timeValue })
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    await awardAttendanceXpIfEligible(attendance);
    await GamificationService.awardActionXp(req.user._id, 'ATTENDANCE_ACTION', { type });
    res.json(attendance);
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
    res.json(request);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/batch/present', async (req, res) => {
  try {
    if (!isOps(req.user)) return res.status(403).json({ error: 'Only operations can batch update attendance' });
    const { date, userIds } = req.body;
    if (!date) return res.status(400).json({ error: 'date is required' });

    const day = toStartOfDay(date);
    const users = userIds?.length
      ? await User.find({ _id: { $in: userIds } }).select('name')
      : await User.find({}).select('name');

    const results = await Promise.all(
      users.map((userRow) =>
        Attendance.findOneAndUpdate(
          { userId: userRow._id, date: day },
          {
            $set: {
              userId: userRow._id,
              username: userRow.name,
              date: day,
              timeIn: '09:00',
              timeOut: '18:00',
              isHalfDay: false,
              onLeave: false,
              createdBy: req.user._id,
            },
          },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        )
      )
    );

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/reset', async (req, res) => {
  try {
    if (!isOps(req.user)) return res.status(403).json({ error: 'Only operations can reset attendance data' });
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
    const allowed = ['timeIn', 'timeOut', 'isHalfDay', 'onLeave', 'reason', 'date', 'userId', 'username'];
    const payload = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) payload[key] = req.body[key];
    }
    if (payload.userId && !payload.username) {
      const user = await User.findById(payload.userId).select('name');
      if (user) payload.username = user.name;
    }
    const row = await Attendance.findByIdAndUpdate(req.params.id, { $set: payload }, { new: true });
    if (!row) return res.status(404).json({ error: 'Attendance record not found' });
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
