const GamificationService = require('../services/gamificationService');
const XPAuditLog = require('../models/XPAuditLog');
const GamificationConfig = require('../models/GamificationConfig');
const User = require('../models/User');
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
