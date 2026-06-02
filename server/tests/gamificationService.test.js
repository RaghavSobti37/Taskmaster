const GamificationService = require('../services/gamificationService');
const XPAuditLog = require('../models/XPAuditLog');
const GamificationConfig = require('../models/GamificationConfig');
const mongoose = require('mongoose');

describe('GamificationService XP resolution', () => {
  test('resolveLogAmount uses current config for COMPLETE_TASK', async () => {
    await GamificationConfig.create({ taskCompletion: 25, dailyLog: 10 });
    const config = await GamificationService.getConfigPlain();

    expect(GamificationService.resolveLogAmount(config, { action: 'COMPLETE_TASK', amount: 15 })).toBe(25);
  });

  test('resolveLogAmount keeps stored amount for unmapped actions', async () => {
    const config = await GamificationService.getConfigPlain();
    expect(GamificationService.resolveLogAmount(config, { action: 'MISSION_COMPLETE', amount: 20 })).toBe(20);
  });

  test('syncAuditLogAmountsFromConfig updates stored audit log amounts', async () => {
    const userId = new mongoose.Types.ObjectId();
    await GamificationConfig.create({ taskCompletion: 30, dailyLog: 10 });
    await XPAuditLog.create({ userId, action: 'COMPLETE_TASK', amount: 15 });
    await XPAuditLog.create({ userId, action: 'DAILY_LOG', amount: 10 });

    const sync = await GamificationService.syncAuditLogAmountsFromConfig({ log: false });
    expect(sync.updatedLogs).toBe(1);

    const taskLog = await XPAuditLog.findOne({ action: 'COMPLETE_TASK' }).lean();
    expect(taskLog.amount).toBe(30);
  });

  test('getWeeklyLeaderboard uses config rates not stale stored amounts', async () => {
    const userId = new mongoose.Types.ObjectId();
    await GamificationConfig.create({ taskCompletion: 40, dailyLog: 10 });
    const { weekStart, weekEnd } = require('../utils/attendanceDate').getCurrentWeekRange();

    await XPAuditLog.create({
      userId,
      action: 'COMPLETE_TASK',
      amount: 15,
      createdAt: weekStart,
    });

    const weekly = await GamificationService.getWeeklyLeaderboard(10);
    expect(weekly.entries).toEqual([[String(userId), 40]]);
    expect(weekly.resolvedSum).toBe(40);
    expect(weekly.storedSum).toBe(15);
  });
});
