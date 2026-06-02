const express = require('express');
const ipaddr = require('ipaddr.js');

const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { isOpsUser, isAdminUser } = require('../utils/departmentPermissions');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');
const GamificationService = require('../services/gamificationService');
const { parseTimeSpentToHours } = require('../../shared/timeSpent');
const {
  getDateKey,
  toStartOfDay,
  endOfDayFromKey,
  todayStart,
  formatHHMM,
  getCurrentWeekRange,
  getWeekRange,
  validateAttendanceTimes,
  parseTimeToMinutes,
} = require('../utils/attendanceDate');
const { isAttendanceExcluded } = require('../utils/attendanceUsers');
const Log = require('../models/Log');
const { createNotification } = require('../services/notificationDispatcher');
const { queueGamificationEvent } = require('../services/backgroundQueue');

const isOps = (user) => isOpsUser(user);

const STANDARD_SHIFT_MINUTES = 8 * 60;
const DISCREPANCY_THRESHOLD_MINUTES = 30;

const NASHIK_OFFICE_LAT = 19.9975;
const NASHIK_OFFICE_LNG = 73.7898;
const OFFICE_RADIUS_METERS = 1000;
const OFFICE_RADIUS_KM = OFFICE_RADIUS_METERS / 1000;

const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

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

const computeAttendanceMetrics = async (attendanceDoc) => {
  const inTime = attendanceDoc.inTimeRecord?.manualTimestamp;
  const outTime = attendanceDoc.outTimeRecord?.manualTimestamp;

  if (!inTime || !outTime) return attendanceDoc;

  const inMin = parseTimeToMinutes(inTime);
  const outMin = parseTimeToMinutes(outTime);
  let systemMinutes = outMin - inMin;
  if (systemMinutes < 0) systemMinutes += 24 * 60;

  const dayStart = toStartOfDay(attendanceDoc.date);
  const dayEnd = new Date(dayStart);
  dayEnd.setHours(23, 59, 59, 999);

  const logs = await Log.find({
    userId: attendanceDoc.userId,
    action: 'DAILY_LOG',
    createdAt: { $gte: dayStart, $lte: dayEnd },
    'details.type': { $nin: ['TASK_COMPLETION', 'TASK_REVIEW'] }
  }).select('details').lean();

  const loggedHours = logs.reduce(
    (sum, l) => sum + parseTimeSpentToHours(l.details?.timeSpent),
    0
  );
  const systemHours = systemMinutes / 60;
  const discrepancyMinutes = Math.abs(Math.round(systemHours * 60) - Math.round(loggedHours * 60));
  const overtimeMinutes = Math.max(0, systemMinutes - STANDARD_SHIFT_MINUTES);

  attendanceDoc.systemHours = Math.round(systemHours * 100) / 100;
  attendanceDoc.loggedHours = Math.round(loggedHours * 100) / 100;
  attendanceDoc.discrepancyMinutes = discrepancyMinutes;
  attendanceDoc.overtimeMinutes = overtimeMinutes;
  await attendanceDoc.save();

  return attendanceDoc;
};

const awardAttendanceXpIfEligible = async (attendanceDoc) => {
  if (attendanceDoc.systemHours >= 8 && attendanceDoc.discrepancyMinutes < DISCREPANCY_THRESHOLD_MINUTES) {
    const todayStr = getDateKey(attendanceDoc.date);
    await GamificationService.awardActionXp(
      attendanceDoc.userId,
      'ATTENDANCE_DAY_BONUS',
      { date: todayStr, at: attendanceDoc.outTimeRecord?.manualTimestamp },
      { entityKey: 'date', entityId: todayStr },
    );
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
      if (end) query.date.$lte = endOfDayFromKey(end);
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
    const type = req.body?.type === 'out' ? 'out' : 'in';

    // Diagnostic Logs
    console.log(`[ATTENDANCE DIAGNOSTIC] RUNNING WATERFALL FOR USER: ${req.user._id}`);
    console.log(`[ATTENDANCE DIAGNOSTIC] TIMESTAMP: ${now.toISOString()}`);
    console.log(`[ATTENDANCE DIAGNOSTIC] TIER 1 - Incoming Lat: ${req.body.lat}, Lng: ${req.body.lng}`);

    if (req.body.lat && req.body.lng) {
      const computedDistance = getDistanceFromLatLonInKm(parseFloat(req.body.lat), parseFloat(req.body.lng), NASHIK_OFFICE_LAT, NASHIK_OFFICE_LNG) * 1000;
      console.log(`[ATTENDANCE DIAGNOSTIC] TIER 1 - Distance to Nashik Office Center: ${computedDistance} meters`);
      console.log(`[ATTENDANCE DIAGNOSTIC] TIER 1 - Inside ${OFFICE_RADIUS_METERS}m Radius? ${computedDistance <= OFFICE_RADIUS_METERS}`);
    } else {
      console.log(`[ATTENDANCE DIAGNOSTIC] TIER 1 - GPS Coordinates missing or denied by browser payload.`);
    }

    const clientIp = resolveClientIp(req);
    const officeIpTargets = getOfficeIpTargets();
    const officeIpList = officeIpTargets.join(',') || '(none configured)';
    const networkMatchPreview = officeIpTargets.length > 0
      && verifyNetworkMatch(clientIp, officeIpList);
    console.log(`[ATTENDANCE DIAGNOSTIC] TIER 2 - Raw Detected Client IP: "${clientIp}"`);
    console.log(`[ATTENDANCE DIAGNOSTIC] TIER 2 - Office IP targets (${officeIpTargets.length}): ${officeIpList}`);
    console.log(`[ATTENDANCE DIAGNOSTIC] TIER 2 - Network Match? ${networkMatchPreview}`);

    const existing = await Attendance.findOne({ userId: req.user._id, date: today });

    const targetRecord = type === 'in' ? existing?.inTimeRecord : existing?.outTimeRecord;
    if (targetRecord?.isApproved) {
      return res.status(403).json({ error: `${type === 'in' ? 'Check-in' : 'Check-out'} is locked for today` });
    }
    if (targetRecord?.systemTimestamp) {
      return res.status(400).json({ error: `Already marked ${type} for today` });
    }

    const timeValue = req.body?.manualTime || formatHHMM(now);

    // Multi-Tier Verification Logic
    let workMode = 'wfh';
    let verificationMethod = 'NONE';
    const { lat, lng } = req.body;

    // Tier 1: GPS
    if (lat && lng) {
      const dist = getDistanceFromLatLonInKm(parseFloat(lat), parseFloat(lng), NASHIK_OFFICE_LAT, NASHIK_OFFICE_LNG);
      if (dist <= OFFICE_RADIUS_KM) {
        workMode = 'office';
        verificationMethod = 'GPS';
      }
    }

    // Tier 2: Office Network / Fixed IP Check (v4 + v6 whitelist)
    if (workMode !== 'office' && officeIpTargets.length > 0) {
      const isOfficeNetwork = verifyNetworkMatch(clientIp, officeIpTargets.join(','));
      if (isOfficeNetwork) {
        workMode = 'office';
        verificationMethod = 'NETWORK';
      }
    } // Tier 3: WFH fallback is already set above

    console.log(`[ATTENDANCE DIAGNOSTIC] RESULT - workMode=${workMode} verificationMethod=${verificationMethod}`);

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
      await awardAttendanceXpIfEligible(attendance);
      const todayStr = getDateKey(attendance.date);
      queueGamificationEvent('ATTENDANCE_DAY_COMPLETE', {
        userId: req.user._id,
        date: todayStr,
        hours: attendance.systemHours || 0,
      });
    }

    const payload = attendance.toObject ? attendance.toObject() : attendance;
    res.json({
      ...payload,
      _attendanceDiagnostic: {
        workMode,
        verificationMethod,
        clientIp,
        officeIpTargetCount: officeIpTargets.length,
        tier1Gps: lat && lng ? 'attempted' : 'missing',
      },
    });
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
    res.json(updatedRow);
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
      await awardAttendanceXpIfEligible(row);
      queueGamificationEvent('ATTENDANCE_DAY_COMPLETE', {
        userId: row.userId,
        date: getDateKey(row.date),
        hours: row.systemHours || 0,
      });
    }

    res.json(row);
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
