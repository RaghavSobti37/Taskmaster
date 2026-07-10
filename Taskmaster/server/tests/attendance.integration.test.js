const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Department = require('../models/Department');
const { formatHHMM } = require('../utils/attendanceDate');
const { DEV_DEFAULT_PASSWORD } = require('../../shared/defaultPassword');
const { mintSessionAgent } = require('./helpers/mintTestSession');
const { PRESET_PAGES } = require('../utils/pagePermissions');

/** Pick a manual HH:MM on today that passes validateAttendanceTimes (avoids midnight wrap). */
function pastManualTime(minutesAgo = 120) {
  const { formatHHMM, getDateKey, todayStart, validateAttendanceTimes } = require('../utils/attendanceDate');
  const todayKey = getDateKey(todayStart());
  const candidates = [
    minutesAgo,
    90,
    60,
    45,
    30,
    15,
    5,
  ].map((m) => formatHHMM(new Date(Date.now() - m * 60 * 1000)));
  for (const t of candidates) {
    if (validateAttendanceTimes({ dateKey: todayKey, timeIn: t }).ok) return t;
  }
  return '00:01';
}

function laterManualTime(earlier, addMinutes = 60) {
  const { parseTimeToMinutes } = require('../utils/attendanceDate');
  const base = parseTimeToMinutes(earlier) + addMinutes;
  const h = Math.floor(base / 60) % 24;
  const m = base % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

async function registerAndLogin(agent, email, name) {
  const reg = await request(app)
    .post('/api/auth/register')
    .send({
      name,
      email,
      password: DEV_DEFAULT_PASSWORD,
      gender: 'male',
    });
  expect(reg.statusCode).toBe(201);
  await mintSessionAgent(agent, reg.body._id);
  return reg.body._id;
}

describe('Attendance API integration', () => {
  let userAgent;
  let opsAgent;

  beforeEach(async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    userAgent = request.agent(app);
    opsAgent = request.agent(app);

    await registerAndLogin(
      userAgent,
      `att-user-${stamp}@coreknot-test.local`,
      'Attendance User'
    );

    const opsDept = await Department.findOne({ slug: 'ops' })
      || await Department.create({
        name: 'Operations',
        slug: 'ops',
        permissionPreset: 'ops',
        pagePermissions: PRESET_PAGES.ops,
      });
    const opsId = await registerAndLogin(
      opsAgent,
      `att-ops-${stamp}@coreknot-test.local`,
      'Attendance Ops'
    );
    await User.findByIdAndUpdate(opsId, { departmentId: opsDept._id });
  });

  it('records check-in and check-out for authenticated user', async () => {
    const checkInTime = pastManualTime(120);
    const checkOutTime = laterManualTime(checkInTime, 60);
    const checkIn = await userAgent.post('/api/attendance/check').send({
      type: 'in',
      manualTime: checkInTime,
      workMode: 'office',
    });
    expect(checkIn.statusCode).toBe(200);
    expect(checkIn.body.inTimeRecord?.manualTimestamp).toBe(checkInTime);
    expect(checkIn.body.inTimeRecord?.isApproved).toBe(false);

    const checkOut = await userAgent.post('/api/attendance/check').send({
      type: 'out',
      manualTime: checkOutTime,
      workMode: 'office',
    });
    expect(checkOut.statusCode).toBe(200);
    expect(checkOut.body.outTimeRecord?.manualTimestamp).toBe(checkOutTime);

    const listRes = await userAgent.get('/api/attendance?mine=true');
    expect(listRes.statusCode).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body.length).toBeGreaterThan(0);
    expect(listRes.body[0].inTimeRecord?.manualTimestamp).toBe(checkInTime);
    expect(listRes.body[0].outTimeRecord?.manualTimestamp).toBe(checkOutTime);
  });

  it('rejects duplicate check-in for the same day', async () => {
    const first = await userAgent.post('/api/attendance/check').send({ type: 'in' });
    expect(first.statusCode).toBe(200);

    const second = await userAgent.post('/api/attendance/check').send({ type: 'in' });
    expect(second.statusCode).toBe(400);
    expect(second.body.error).toMatch(/Already marked in/i);
  });

  it('rejects future checkout time after validation hardening', async () => {
    const checkInTime = pastManualTime(120);
    const checkIn = await userAgent.post('/api/attendance/check').send({
      type: 'in',
      manualTime: checkInTime,
      workMode: 'office',
    });
    expect(checkIn.statusCode).toBe(200);

    const futureOut = await userAgent.post('/api/attendance/check').send({
      type: 'out',
      manualTime: '23:59',
      workMode: 'office',
    });
    expect(futureOut.statusCode).toBe(400);
    expect(futureOut.body.error).toMatch(/future/i);
  });

  it('rejects invalid undo payload type', async () => {
    const invalidUndo = await userAgent.post('/api/attendance/check/undo').send({ type: 'sideways' });
    expect(invalidUndo.statusCode).toBe(400);
  });

  it('returns fresh month list after check-in (cache bust)', async () => {
    const { getDateKey, getCurrentMonthRange } = require('../utils/attendanceDate');
    const { monthStartKey, monthEndKey } = getCurrentMonthRange();
    const checkInManual = pastManualTime(90);

    const before = await userAgent.get('/api/attendance').query({
      start: monthStartKey,
      end: monthEndKey,
      mine: 'true',
    });
    expect(before.statusCode).toBe(200);

    const checkIn = await userAgent.post('/api/attendance/check').send({
      type: 'in',
      manualTime: checkInManual,
      workMode: 'office',
    });
    expect(checkIn.statusCode).toBe(200);

    const after = await userAgent.get('/api/attendance').query({
      start: monthStartKey,
      end: monthEndKey,
      mine: 'true',
    });
    expect(after.statusCode).toBe(200);
    const todayKey = getDateKey();
    const todayRow = after.body.find((row) => getDateKey(row.date) === todayKey);
    expect(todayRow?.inTimeRecord?.manualTimestamp).toBe(checkInManual);
  });

  it('rejects unauthenticated attendance list', async () => {
    const res = await request(app).get('/api/attendance');
    expect(res.statusCode).toBe(401);
  });

  it('allows ops user to list roster users', async () => {
    const res = await opsAgent.get('/api/attendance/roster-users');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
  });

  it('blocks non-ops user from roster-users endpoint', async () => {
    const res = await userAgent.get('/api/attendance/roster-users');
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/Operations access required/i);
  });

  it('returns empty list after admin reset after cache warmup', async () => {
    const checkInTime = pastManualTime(120);
    await userAgent.post('/api/attendance/check').send({
      type: 'in',
      manualTime: checkInTime,
      workMode: 'office',
    });

    const warmed = await userAgent.get('/api/attendance?mine=true');
    expect(warmed.statusCode).toBe(200);
    expect(Array.isArray(warmed.body)).toBe(true);
    expect(warmed.body.length).toBeGreaterThan(0);

    const reset = await opsAgent.delete('/api/attendance/reset');
    expect([200, 403]).toContain(reset.statusCode);

    if (reset.statusCode === 200) {
      const afterReset = await userAgent.get('/api/attendance?mine=true');
      expect(afterReset.statusCode).toBe(200);
      expect(afterReset.body).toEqual([]);
    }
  });
});
