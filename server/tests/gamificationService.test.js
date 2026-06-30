const GamificationService = require('../services/gamificationService');
const XPAuditLog = require('../models/XPAuditLog');
const GamificationConfig = require('../models/GamificationConfig');
const User = require('../models/User');
const Task = require('../models/Task');
const mongoose = require('mongoose');
const { computeTimeBasedXp } = require('../../shared/gamificationRules');

describe('GamificationService XP resolution', () => {
  test('computeTimeBasedXp multiplies hours by rate', () => {
    expect(computeTimeBasedXp(2, 10)).toBe(20);
    expect(computeTimeBasedXp(1.5, 10)).toBe(15);
    expect(computeTimeBasedXp(0.5, 10)).toBe(5);
  });

  test('resolveLogAmount uses hours × rate for time-based actions', async () => {
    await GamificationConfig.create({ taskCompletion: 10, dailyLog: 8 });
    const config = await GamificationService.getConfigPlain();

    expect(GamificationService.resolveLogAmount(config, {
      action: 'COMPLETE_TASK',
      amount: 99,
      details: { hours: 2 },
    })).toBe(20);

    expect(GamificationService.resolveLogAmount(config, {
      action: 'DAILY_LOG',
      amount: 99,
      details: { hours: 1.5 },
    })).toBe(12);
  });

  test('resolveLogAmount keeps stored amount for legacy time-based logs without hours', async () => {
    await GamificationConfig.create({ taskCompletion: 25 });
    const config = await GamificationService.getConfigPlain();

    expect(GamificationService.resolveLogAmount(config, {
      action: 'COMPLETE_TASK',
      amount: 15,
    })).toBe(15);
  });

  test('resolveLogAmount keeps stored amount for unmapped actions', async () => {
    const config = await GamificationService.getConfigPlain();
    expect(GamificationService.resolveLogAmount(config, { action: 'MISSION_COMPLETE', amount: 20 })).toBe(20);
  });

  test('computeActionXp uses task hours for COMPLETE_TASK', async () => {
    await GamificationConfig.create({ taskCompletion: 10 });
    const config = await GamificationService.getConfig();

    expect(GamificationService.computeActionXp(config, 'COMPLETE_TASK', { hours: 2 })).toBe(20);
    expect(GamificationService.computeActionXp(config, 'CREATE_TASK', {})).toBe(2);
  });

  test('resolveTaskCompletionHours falls back to minimum when unset', () => {
    expect(GamificationService.resolveTaskCompletionHours({ actualHours: 0, plannedHours: 0 })).toBe(0.5);
    expect(GamificationService.resolveTaskCompletionHours({ actualHours: 3 })).toBe(3);
    expect(GamificationService.resolveTaskCompletionHours({ actualHours: 100 })).toBe(12);
  });

  test('getExpForLevel uses linear stepXp without rounding to 100', async () => {
    await GamificationConfig.create({ stepXp: 150 });
    expect(await GamificationService.getExpForLevel(1)).toBe(0);
    expect(await GamificationService.getExpForLevel(2)).toBe(150);
    expect(await GamificationService.getExpForLevel(3)).toBe(300);
  });

  test('getLevelFromExp aligns with getExpForLevel thresholds', async () => {
    await GamificationConfig.create({ stepXp: 150 });
    expect(await GamificationService.getLevelFromExp(0)).toBe(1);
    expect(await GamificationService.getLevelFromExp(149)).toBe(1);
    expect(await GamificationService.getLevelFromExp(150)).toBe(2);
    expect(await GamificationService.getLevelFromExp(300)).toBe(3);
  });

  test('syncAuditLogAmountsFromConfig updates time-based audit amounts from hours', async () => {
    const userId = new mongoose.Types.ObjectId();
    await GamificationConfig.create({ taskCompletion: 10, dailyLog: 8 });
    await XPAuditLog.create({
      userId,
      action: 'COMPLETE_TASK',
      amount: 15,
      details: { hours: 2, taskId: new mongoose.Types.ObjectId() },
    });
    await XPAuditLog.create({
      userId,
      action: 'DAILY_LOG',
      amount: 10,
      details: { hours: 1, logId: new mongoose.Types.ObjectId() },
    });

    const sync = await GamificationService.syncAuditLogAmountsFromConfig({ log: false });
    expect(sync.updatedLogs).toBe(2);

    const taskLog = await XPAuditLog.findOne({ action: 'COMPLETE_TASK' }).lean();
    expect(taskLog.amount).toBe(20);

    const dailyLog = await XPAuditLog.findOne({ action: 'DAILY_LOG' }).lean();
    expect(dailyLog.amount).toBe(8);
  });

  test('syncAuditLogAmountsFromConfig applies manual daily log overtime on rate change', async () => {
    const userId = new mongoose.Types.ObjectId();
    await GamificationConfig.create({ dailyLog: 10 });
    await XPAuditLog.create({
      userId,
      action: 'DAILY_LOG',
      amount: 100,
      details: { hours: 10, logId: new mongoose.Types.ObjectId() },
    });

    await GamificationConfig.updateOne({}, { dailyLog: 12 });
    const sync = await GamificationService.syncAuditLogAmountsFromConfig({ log: false });
    expect(sync.updatedLogs).toBe(1);

    const dailyLog = await XPAuditLog.findOne({ action: 'DAILY_LOG' }).lean();
    expect(dailyLog.amount).toBe(132);
  });

  test('purgeQaGamificationData removes qaProbe XP audits', async () => {
    const userId = new mongoose.Types.ObjectId();
    await User.create({ _id: userId, name: 'QA XP', email: 'real-user@test.com', exp: 100, level: 2 });
    await XPAuditLog.create({
      userId,
      action: 'COMPLETE_TASK',
      amount: 25,
      details: { qaProbe: true, taskId: new mongoose.Types.ObjectId() },
    });
    await XPAuditLog.create({
      userId,
      action: 'CREATE_TASK',
      amount: 2,
      details: { taskId: new mongoose.Types.ObjectId() },
    });

    const { purgeQaGamificationData } = require('../services/qa/qaTestData');
    const purged = await purgeQaGamificationData();
    expect(purged.deletedXpAudits).toBeGreaterThanOrEqual(1);

    const remaining = await XPAuditLog.countDocuments({ userId });
    expect(remaining).toBe(1);

    const recalc = await GamificationService.recalculateUsersFromAudit([userId]);
    expect(recalc.updatedUsers).toBe(1);
    const user = await User.findById(userId).lean();
    expect(user.exp).toBe(2);
  });

  test('buildWeeklyRecalcMetaByUser sums prior amounts from last recalc', async () => {
    const userId = new mongoose.Types.ObjectId();
    const config = { taskCompletion: 10, dailyLog: 10 };
    const recalcAt = new Date('2026-06-02T20:00:00Z');
    const logs = [
      {
        userId,
        action: 'COMPLETE_TASK',
        amount: 30,
        previousAmount: 20,
        recalculatedAt: recalcAt,
        recalcReason: 'config_sync',
        details: { hours: 3 },
      },
      {
        userId,
        action: 'LEAD_CAPTURE',
        amount: 50,
        details: {},
      },
    ];
    const meta = GamificationService.buildWeeklyRecalcMetaByUser(
      logs,
      config,
      { tasksById: new Map(), logsById: new Map() },
      recalcAt
    );
    const row = meta.get(String(userId));
    expect(row.weeklyXp).toBe(80);
    expect(row.weeklyXpPrior).toBe(70);
    expect(row.weeklyXpDelta).toBe(10);
    expect(row.changes[0].delta).toBe(10);
  });

  test('sync backfills task hours when audit row omits details.hours', async () => {
    const userId = new mongoose.Types.ObjectId();
    const taskId = new mongoose.Types.ObjectId();
    await GamificationConfig.create({ taskCompletion: 10 });
    await Task.collection.insertOne({
      _id: taskId,
      title: 'Backfill task',
      actualHours: 2,
      plannedHours: 0,
    });
    await XPAuditLog.create({
      userId,
      action: 'COMPLETE_TASK',
      amount: 999,
      details: { taskId },
    });

    const sync = await GamificationService.syncAuditLogAmountsFromConfig({ log: false });
    expect(sync.updatedLogs).toBe(1);
    expect(sync.hoursStats.backfilledHours).toBe(1);

    const row = await XPAuditLog.findOne({ action: 'COMPLETE_TASK' }).lean();
    expect(row.details.hours).toBe(2);
    expect(row.amount).toBe(20);
  });

  test('repairDuplicateXpAuditLogs removes duplicate attendance rows per day', async () => {
    const userId = new mongoose.Types.ObjectId();
    const dateKey = '2026-06-03';
    await XPAuditLog.create([
      { userId, action: 'ATTENDANCE_ACTION', amount: 120, details: { date: dateKey, hours: 8 } },
      { userId, action: 'ATTENDANCE_ACTION', amount: 120, details: { date: dateKey, hours: 8 } },
      { userId, action: 'ATTENDANCE_ACTION', amount: 120, details: { date: '2026-06-04', hours: 8 } },
    ]);
    const repair = await GamificationService.repairDuplicateXpAuditLogs([userId]);
    expect(repair.removed).toBe(1);
    const remaining = await XPAuditLog.countDocuments({ userId, action: 'ATTENDANCE_ACTION' });
    expect(remaining).toBe(2);
  });

  test('resolveLogAmount uses hours x rate when hours present', async () => {
    await GamificationConfig.create({ taskCompletion: 20 });
    const config = await GamificationService.getConfigPlain();
    const amount = GamificationService.resolveLogAmount(config, {
      action: 'COMPLETE_TASK',
      amount: 1000,
      details: { hours: 1 },
    });
    expect(amount).toBe(20);
  });

  test('resolveLogAmount caps legacy inflated COMPLETE_TASK without hours', async () => {
    await GamificationConfig.create({ taskCompletion: 20 });
    const config = await GamificationService.getConfigPlain();
    const amount = GamificationService.resolveLogAmount(config, {
      action: 'COMPLETE_TASK',
      amount: 1000,
      details: {},
    });
    expect(amount).toBe(240);
  });

  test('buildWeeklyGroupedBreakdown groups task completions together', async () => {
    const userId = new mongoose.Types.ObjectId();
    await GamificationConfig.create({ taskCompletion: 20 });
    const config = await GamificationService.getConfigPlain();
    const logs = [
      { userId, action: 'COMPLETE_TASK', amount: 20, details: { hours: 1 } },
      { userId, action: 'COMPLETE_TASK', amount: 40, details: { hours: 2 } },
    ];
    const groups = GamificationService.buildWeeklyGroupedBreakdown(
      logs,
      config,
      { tasksById: new Map(), logsById: new Map() }
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].action).toBe('COMPLETE_TASK');
    expect(groups[0].count).toBe(2);
    expect(groups[0].totalXp).toBe(60);
    expect(groups[0].timeBased).toBe(true);
  });

  test('aggregateWeeklyXpFromLogs dedupes entity-scoped actions before summing', async () => {
    const userId = new mongoose.Types.ObjectId();
    await GamificationConfig.create({ attendanceLog: 10 });
    const config = await GamificationService.getConfigPlain();
    const weekStart = new Date('2026-06-02T00:00:00Z');
    const weekEnd = new Date('2026-06-08T23:59:59Z');
    const logs = [
      {
        userId,
        action: 'ATTENDANCE_ACTION',
        amount: 80,
        details: { date: '2026-06-03', hours: 8 },
        createdAt: weekStart,
      },
      {
        userId,
        action: 'ATTENDANCE_ACTION',
        amount: 80,
        details: { date: '2026-06-03', hours: 8 },
        createdAt: weekStart,
      },
    ];
    const { totalsByUser, rawLogCount, logCount } = GamificationService.aggregateWeeklyXpFromLogs(
      logs,
      config,
      { tasksById: new Map(), logsById: new Map() }
    );
    expect(rawLogCount).toBe(2);
    expect(logCount).toBe(1);
    expect(totalsByUser.get(String(userId))).toBe(80);
  });

  test('snapshotWeeklyXpFromStoredAmounts sums per user for the week', async () => {
    const userA = new mongoose.Types.ObjectId();
    const userB = new mongoose.Types.ObjectId();
    const weekStart = new Date('2026-06-02T00:00:00Z');
    const weekEnd = new Date('2026-06-08T23:59:59Z');
    await XPAuditLog.create([
      { userId: userA, action: 'LEAD_CAPTURE', amount: 50, createdAt: weekStart },
      { userId: userB, action: 'LEAD_CAPTURE', amount: 50, createdAt: weekStart },
    ]);
    const snap = await GamificationService.snapshotWeeklyXpFromStoredAmounts(
      [userA, userB],
      weekStart,
      weekEnd
    );
    expect(snap[String(userA)]).toBe(50);
    expect(snap[String(userB)]).toBe(50);
  });

  test('recalculateAllUsersFromConfig syncs user exp from time-based audit history', async () => {
    const userId = new mongoose.Types.ObjectId();
    await GamificationConfig.create({ taskCompletion: 10, stepXp: 100 });
    await User.create({ _id: userId, name: 'Test User', email: 'xp@test.com', exp: 15, level: 1 });
    await XPAuditLog.create({
      userId,
      action: 'COMPLETE_TASK',
      amount: 15,
      details: { hours: 2 },
    });
    await XPAuditLog.create({
      userId,
      action: 'COMPLETE_TASK',
      amount: 15,
      details: { hours: 1 },
    });

    await GamificationConfig.updateOne({}, { taskCompletion: 12 });

    const result = await GamificationService.recalculateAllUsersFromConfig();
    expect(result.updatedUsers).toBe(1);

    const user = await User.findById(userId).lean();
    expect(user.exp).toBe(36);
  });

  test('computeActionXp clamps inflated hours to max per event', async () => {
    await GamificationConfig.create({ taskCompletion: 15, dailyLog: 10 });
    const config = await GamificationService.getConfig();
    expect(GamificationService.computeActionXp(config, 'COMPLETE_TASK', { hours: 100 })).toBe(180);
    expect(GamificationService.computeActionXp(config, 'DAILY_LOG', { hours: 50 })).toBe(140);
  });

  test('awardActionXp blocks duplicate entity awards (race-safe upsert)', async () => {
    const userId = new mongoose.Types.ObjectId();
    await User.create({ _id: userId, name: 'Dup', email: 'dup@test.com', exp: 0, level: 1 });
    const taskId = new mongoose.Types.ObjectId();
    const opts = { entityKey: 'taskId', entityId: taskId };

    const [a, b] = await Promise.all([
      GamificationService.awardActionXp(userId, 'REVIEW_APPROVAL', { taskId }, opts),
      GamificationService.awardActionXp(userId, 'REVIEW_APPROVAL', { taskId }, opts),
    ]);

    const awarded = [a, b].filter(Boolean).length;
    const rows = await XPAuditLog.countDocuments({ userId, action: 'REVIEW_APPROVAL', 'details.taskId': taskId });
    expect(awarded).toBe(1);
    expect(rows).toBe(1);
  });

  test('MISSION_COMPLETE awards once per missionId', async () => {
    const userId = new mongoose.Types.ObjectId();
    await User.create({ _id: userId, name: 'Mission', email: 'mission@test.com', exp: 0, level: 1 });
    const missionId = new mongoose.Types.ObjectId();
    const first = await GamificationService.awardActionXp(
      userId,
      'MISSION_COMPLETE',
      { missionId, title: 'Task Conqueror', expReward: 25 },
      { entityKey: 'missionId', entityId: missionId }
    );
    const second = await GamificationService.awardActionXp(
      userId,
      'MISSION_COMPLETE',
      { missionId, title: 'Task Conqueror', expReward: 25 },
      { entityKey: 'missionId', entityId: missionId }
    );
    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  test('computeManualDailyLogXp awards overtime rate above 8 hours', async () => {
    const { computeManualDailyLogXp } = require('../../shared/gamificationRules');
    expect(computeManualDailyLogXp(6, 10, 15)).toBe(60);
    expect(computeManualDailyLogXp(10, 10, 15)).toBe(110);
  });

  test('DAILY_LOG daily cap blocks sixth manual award same day', async () => {
    const userId = new mongoose.Types.ObjectId();
    await User.create({ _id: userId, name: 'Cap', email: 'cap@test.com', exp: 0, level: 1 });
    await GamificationConfig.create({ dailyLog: 10 });

    const awards = [];
    for (let i = 0; i < 6; i += 1) {
      const logId = new mongoose.Types.ObjectId();
      awards.push(
        await GamificationService.awardActionXp(
          userId,
          'DAILY_LOG',
          { logId, hours: 1, manualDailyLog: true },
          { entityKey: 'logId', entityId: logId }
        )
      );
    }
    expect(awards.filter(Boolean).length).toBe(5);
    expect(awards[5]).toBeNull();
  });

  test('DAILY_LOG daily cap ignores awards without logId (non-manual)', async () => {
    const userId = new mongoose.Types.ObjectId();
    await User.create({ _id: userId, name: 'Cap2', email: 'cap2@test.com', exp: 0, level: 1 });
    await GamificationConfig.create({ dailyLog: 10 });
    await XPAuditLog.create({
      userId,
      action: 'DAILY_LOG',
      amount: 50,
      details: { hours: 5 },
      createdAt: new Date(),
    });

    const logId = new mongoose.Types.ObjectId();
    const manual = await GamificationService.awardActionXp(
      userId,
      'DAILY_LOG',
      { logId, hours: 1 },
      { entityKey: 'logId', entityId: logId }
    );
    expect(manual).not.toBeNull();
  });

  test('buildCalculationSummary sums grouped subtotals to total', async () => {
    const groups = [
      { action: 'LEAD_CAPTURE', actionLabel: 'Lead capture', count: 2, amountPerAction: 50, totalXp: 100, timeBased: false, calculationLine: '2 × 50 XP' },
      { action: 'COMPLETE_TASK', actionLabel: 'Task completion', count: 1, amountPerAction: 30, totalXp: 30, timeBased: true, ratePerHour: 10, avgHours: 3, calculationLine: '1 × 3h avg × 10 XP/h' },
    ];
    const summary = GamificationService.buildCalculationSummary(groups, 130);
    expect(summary.lines).toHaveLength(2);
    expect(summary.subtotalSum).toBe(130);
    expect(summary.totalXp).toBe(130);
    expect(summary.verified).toBe(true);
    expect(summary.lines[0].formula).toBe('2 × 50 XP');
  });

  test('getMonthlyLeaderboard resolves time-based amounts from stored hours', async () => {
    const userId = new mongoose.Types.ObjectId();
    await GamificationConfig.create({ taskCompletion: 10 });
    const { monthStart } = require('../utils/attendanceDate').getCurrentMonthRange();

    await XPAuditLog.create({
      userId,
      action: 'COMPLETE_TASK',
      amount: 5,
      details: { hours: 3 },
      createdAt: monthStart,
    });

    const monthly = await GamificationService.getMonthlyLeaderboard(10);
    expect(monthly.entries).toEqual([[String(userId), 30]]);
    expect(monthly.resolvedSum).toBe(30);
    expect(monthly.storedSum).toBe(5);
  });

  test('getWeeklyLeaderboard resolves time-based amounts from stored hours', async () => {
    const userId = new mongoose.Types.ObjectId();
    await GamificationConfig.create({ taskCompletion: 10 });
    const { weekStart } = require('../utils/attendanceDate').getCurrentWeekRange();

    await XPAuditLog.create({
      userId,
      action: 'COMPLETE_TASK',
      amount: 5,
      details: { hours: 3 },
      createdAt: weekStart,
    });

    const weekly = await GamificationService.getWeeklyLeaderboard(10);
    expect(weekly.entries).toEqual([[String(userId), 30]]);
    expect(weekly.resolvedSum).toBe(30);
    expect(weekly.storedSum).toBe(5);
  });
});
