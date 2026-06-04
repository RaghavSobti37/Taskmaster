const express = require('express');
const ipaddr = require('ipaddr.js');

const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { isOpsUser, isAdminUser } = require('../utils/departmentPermissions');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');
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
const { isAttendanceExcluded } = require('../utils/attendanceUsers');
const { createNotification } = require('../services/notificationDispatcher');

const isOps = (user) => isOpsUser(user);

const STANDARD_SHIFT_MINUTES = 8 * 60;
const DISCREPANCY_THRESHOLD_MINUTES = 30;

const resolveClientIp = (req) => {
  let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (ip && typeof ip === 'string') {
    ip = ip.split(',')[0].trim();
    if (ip.includes('::ffff:')) {
      return ip.split('::ffff:')[1];
    }
  }
  return ip || '';
};

/** Comma-separated office egress IPs (v4/v6). OFFICE_IP_WHITELIST is legacy alias — both are merged. */
function getOfficeIpTargets() {
  const chunks = [
    process.env.OFFICE_PUBLIC_IP,
    process.env.OFFICE_IP_WHITELIST,
  ];
  return [...new Set(
    chunks
      .flatMap((v) => String(v || '').split(','))
      .map((s) => s.trim())
      .filter(Boolean)
  )];
}

function verifyNetworkMatch(clientRawIp, targetOfficeIp) {
  if (!clientRawIp || !targetOfficeIp) return false;
  try {
    let cleanedClient = clientRawIp;
    if (cleanedClient.includes('::ffff:')) {
      cleanedClient = cleanedClient.split('::ffff:')[1];
    }
    
    // Support comma-separated target IPs
    const targetIps = targetOfficeIp.split(',').map(i => i.trim());
    
    const parsedClient = ipaddr.process(cleanedClient);
    
    if (parsedClient.toString() === '::1' || parsedClient.toString() === '127.0.0.1') {
      console.log('[ATTENDANCE DEBUG] Localhost loopback detected. Auto-matching for testing.');
      return true; 
    }
    
    const clientString = parsedClient.toString();
    for (const target of targetIps) {
      try {
        const parsedTarget = ipaddr.process(target);
        if (clientString === parsedTarget.toString()) return true;
      } catch (e) {}
    }
    return false;
  } catch (error) {
    console.error('[ATTENDANCE NETWORK ERROR]', error.message);
    return false;
  }
}

const computeAttendanceMetrics = (attendanceDoc) => refreshAttendanceMetrics(attendanceDoc);

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
      if (end) query.date.$lte = endOfDayFromKey(end);
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
    res.json(rows.map((row) => (row.toObject ? row.toObject() : row)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function suggestWorkModeFromRequest(req) {
  const clientIp = resolveClientIp(req);
  const officeIpTargets = getOfficeIpTargets();
  if (officeIpTargets.length > 0 && verifyNetworkMatch(clientIp, officeIpTargets.join(','))) {
    return 'office';
  }
  return 'wfh';
}

router.get('/work-mode-hint', async (req, res) => {
  try {
    res.json({ suggestedMode: suggestWorkModeFromRequest(req) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/check', async (req, res) => {
  try {
    const now = new Date();
    const today = todayStart();
    const type = req.body?.type === 'out' ? 'out' : 'in';
    const clientIp = resolveClientIp(req);

    const existing = await Attendance.findOne({ userId: req.user._id, date: today });

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

    const updateBlock = type === 'in'
      ? { 'inTimeRecord': { systemTimestamp: now, manualTimestamp: timeValue, workMode, checkInIp: clientIp, verificationMethod, isApproved: false } }
      : { 'outTimeRecord': { systemTimestamp: now, manualTimestamp: timeValue, workMode, checkOutIp: clientIp, verificationMethod, isApproved: false } };

    const attendance = await Attendance.findOneAndUpdate(
      { userId: req.user._id, date: today },
      {
        $set: {
          userId: req.user._id,
          username: req.user.name,
          date: today,
          ...updateBlock
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    if (attendance.inTimeRecord?.manualTimestamp && attendance.outTimeRecord?.manualTimestamp) {
      await computeAttendanceMetrics(attendance);
    }

    const payload = attendance.toObject ? attendance.toObject() : attendance;
    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/check/undo', async (req, res) => {
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

    const updatedRow = await computeAttendanceMetrics(row);
    await updatedRow.save();

    let xpAward = null;
    if (isAttendanceDayLocked(updatedRow)) {
      xpAward = await awardAttendanceXpOnDayLocked(updatedRow);
    }

    res.json({ ...updatedRow.toObject(), xpAward });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/upsert/by-user-date', async (req, res) => {
  try {
    if (!isOps(req.user)) return res.status(403).json({ error: 'Only operations can edit attendance' });
    const { userId, username, date, inTimeRecord, outTimeRecord, isHalfDay, onLeave, reason } = req.body;
    if (!userId || !date) return res.status(400).json({ error: 'userId and date are required' });

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

    res.json({ ...(row.toObject ? row.toObject() : row), xpAward });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/leave', async (req, res) => {
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

router.delete('/reset', async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ error: 'Not authorized — admin required' });
    }
    await Attendance.deleteMany({});
    await LeaveRequest.deleteMany({});
    res.json({ message: 'All attendance records reset' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
