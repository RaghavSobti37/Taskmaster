const mongoose = require('mongoose');
const User = require('../models/User');
const DailyMission = require('../models/DailyMission');
const XPAuditLog = require('../models/XPAuditLog');
const GamificationConfig = require('../models/GamificationConfig');
const logger = require('../utils/logger');
const {
  DEFAULT_XP,
  DEFAULT_DAILY_CAPS,
  ACTION_CONFIG_KEY,
  ACTION_LABELS,
  DAILY_MISSIONS,
  normalizeGamificationAction,
  isTimeBasedXpAction,
  computeTimeBasedXp,
} = require('../../shared/gamificationRules');
const { MIN_COMPLETION_MINUTES } = require('../../shared/timeSpent');
const { todayStart, todayEnd, getCurrentWeekRange } = require('../utils/attendanceDate');

const STEP_XP = DEFAULT_XP.stepXp;
const BULK_WRITE_CHUNK = 500;

const getConfigKeyForAction = (action) => {
  const normalized = normalizeGamificationAction(action);
  return ACTION_CONFIG_KEY[normalized] || null;
};

const toPlainConfig = (config) => (config?.toObject ? config.toObject() : config);

const configSnapshot = (config) => {
  const plain = toPlainConfig(config);
  return Object.fromEntries(
    Object.entries(ACTION_CONFIG_KEY)
      .filter(([, configKey]) => configKey)
      .map(([, configKey]) => [configKey, plain?.[configKey]])
  );
};

const getDailyCapForAction = (action) => {
  const configKey = getConfigKeyForAction(action);
  if (!configKey) return null;
  return DEFAULT_DAILY_CAPS[configKey] ?? null;
};

const startOfToday = () => todayStart();
const endOfToday = () => todayEnd();

class GamificationService {
  static async getConfig() {
    let config = await GamificationConfig.findOne();
    if (!config) {
      config = await GamificationConfig.create({});
    }
    return config;
  }

  static async getConfigPlain() {
    return toPlainConfig(await this.getConfig());
  }

  static getXpRate(config, action) {
    const configKey = getConfigKeyForAction(action);
    if (!configKey) return 0;
    const plain = toPlainConfig(config);
    return plain[configKey] ?? DEFAULT_XP[configKey] ?? 0;
  }

  static getXpAmount(config, action) {
    return this.getXpRate(config, action);
  }

  static resolveTaskCompletionHours(task = {}) {
    let hours = Number(task.actualHours) || 0;
    if (hours <= 0) hours = Number(task.plannedHours) || 0;
    if (hours <= 0) hours = MIN_COMPLETION_MINUTES / 60;
    return hours;
  }

  static computeActionXp(config, action, details = {}) {
    const normalized = normalizeGamificationAction(action);
    const rate = this.getXpRate(config, normalized);
    if (!rate) return 0;

    if (isTimeBasedXpAction(normalized)) {
      const hours = Number(details.hours) || 0;
      return computeTimeBasedXp(hours, rate);
    }

    return Number(rate) || 0;
  }

  static async getLevelFromExp(exp) {
    const config = await this.getConfig();
    const stepXp = config.stepXp || STEP_XP;
    return Math.max(1, Math.floor((exp || 0) / stepXp) + 1);
  }

  static async getExpForLevel(level) {
    const config = await this.getConfig();
    const stepXp = config.stepXp || STEP_XP;
    if (level <= 1) return 0;
    return (level - 1) * stepXp;
  }

  static async countActionToday(userId, action) {
    return XPAuditLog.countDocuments({
      userId,
      action,
      createdAt: { $gte: startOfToday(), $lte: endOfToday() },
    });
  }

  static async hasAwardForEntity(userId, action, entityKey, entityId) {
    if (!entityId) return false;
    const idStr = String(entityId);
    const entityMatch = [{ [`details.${entityKey}`]: entityId }, { [`details.${entityKey}`]: idStr }];
    if (mongoose.Types.ObjectId.isValid(idStr)) {
      entityMatch.push({ [`details.${entityKey}`]: new mongoose.Types.ObjectId(idStr) });
    }
    const existing = await XPAuditLog.findOne({
      userId,
      action,
      $or: entityMatch,
    }).select('_id').lean();
    return Boolean(existing);
  }

  static resolveLogAmount(config, log) {
    const normalized = normalizeGamificationAction(log.action);
    const plain = toPlainConfig(config);
    const configKey = getConfigKeyForAction(normalized);

    if (isTimeBasedXpAction(normalized) && log.details?.hours != null) {
      const rate = configKey ? (plain[configKey] ?? DEFAULT_XP[configKey] ?? 0) : 0;
      return computeTimeBasedXp(log.details.hours, rate);
    }

    if (configKey && plain[configKey] != null && !isTimeBasedXpAction(normalized)) {
      return Number(plain[configKey]) || 0;
    }

    return Number(log.amount) || 0;
  }

  static async recalculateExpFromAudit(userId) {
    const config = await this.getConfig();
    const logs = await XPAuditLog.find({ userId }).select('action amount details').lean();

    let total = 0;
    for (const log of logs) {
      total += this.resolveLogAmount(config, log);
    }
    return total;
  }

  static async syncAuditLogAmountsFromConfig(options = {}) {
    const config = await this.getConfigPlain();
    const logs = await XPAuditLog.find().select('action amount details').lean();

    const bulkOps = [];
    const unmappedActions = {};
    const samples = [];
    const actionStats = {};

    for (const log of logs) {
      const configKey = getConfigKeyForAction(log.action);
      if (!configKey) {
        unmappedActions[log.action] = (unmappedActions[log.action] || 0) + 1;
        continue;
      }
      if (config[configKey] == null) continue;

      const isTimeBased = isTimeBasedXpAction(log.action);
      const hours = log.details?.hours;
      let newAmount;
      if (isTimeBased && hours != null) {
        newAmount = computeTimeBasedXp(hours, Number(config[configKey]) || 0);
      } else if (isTimeBased) {
        continue;
      } else {
        newAmount = Number(config[configKey]) || 0;
      }
      const oldAmount = Number(log.amount) || 0;
      if (!actionStats[log.action]) {
        actionStats[log.action] = { configKey, count: 0, oldAmount, newAmount };
      }
      actionStats[log.action].count += 1;

      if (newAmount !== oldAmount) {
        if (samples.length < 5 && (log.action === 'COMPLETE_TASK' || configKey === 'taskCompletion')) {
          samples.push({ action: log.action, configKey, oldAmount, newAmount });
        }
        bulkOps.push({
          updateOne: {
            filter: { _id: log._id },
            update: { $set: { amount: newAmount } },
          },
        });
      }
    }

    for (let i = 0; i < bulkOps.length; i += BULK_WRITE_CHUNK) {
      await XPAuditLog.bulkWrite(bulkOps.slice(i, i + BULK_WRITE_CHUNK), { ordered: false });
    }

    const result = {
      totalLogs: logs.length,
      updatedLogs: bulkOps.length,
      unmappedActions,
      actionStats,
      samples,
      configRates: configSnapshot(config),
    };

    if (options.log !== false) {
      logger.info('Gamification', 'Audit log sync from config', {
        updatedLogs: result.updatedLogs,
        totalLogs: result.totalLogs,
        configRates: result.configRates,
        samples: result.samples,
        unmappedActions: result.unmappedActions,
        completeTask: result.actionStats.COMPLETE_TASK || null,
      });
      if (Object.keys(unmappedActions).length > 0) {
        logger.warn('Gamification', 'Audit logs with unmapped actions (stored amount kept)', {
          unmappedActions,
        });
      }
    }

    return result;
  }

  static aggregateWeeklyXpFromLogs(logs, config) {
    const totalsByUser = new Map();
    let storedSum = 0;
    let resolvedSum = 0;

    for (const log of logs) {
      const stored = Number(log.amount) || 0;
      const resolved = this.resolveLogAmount(config, log);
      storedSum += stored;
      resolvedSum += resolved;
      const userKey = String(log.userId);
      totalsByUser.set(userKey, (totalsByUser.get(userKey) || 0) + resolved);
    }

    return { totalsByUser, storedSum, resolvedSum, logCount: logs.length };
  }

  static async getWeeklyLeaderboard(limit) {
    const config = await this.getConfigPlain();
    const { weekStart, weekEnd, weekStartKey, weekEndKey } = getCurrentWeekRange();

    const logs = await XPAuditLog.find({
      createdAt: { $gte: weekStart, $lte: weekEnd },
    })
      .select('userId action amount details')
      .lean();

    const { totalsByUser, storedSum, resolvedSum, logCount } = this.aggregateWeeklyXpFromLogs(logs, config);

    const sorted = [...totalsByUser.entries()].sort((a, b) => b[1] - a[1]);
    const entries =
      typeof limit === 'number' && limit > 0 ? sorted.slice(0, limit) : sorted;

    return {
      weekStart,
      weekEnd,
      weekStartKey,
      weekEndKey,
      entries,
      logCount,
      storedSum,
      resolvedSum,
      configRates: configSnapshot(config),
    };
  }

  static async recalculateAllUsersFromConfig() {
    const config = await this.getConfigPlain();
    const auditSync = await this.syncAuditLogAmountsFromConfig({ log: true });

    const users = await User.find().select('_id exp level');
    let updatedUsers = 0;
    const changes = [];

    for (const user of users) {
      const newExp = await this.recalculateExpFromAudit(user._id);
      const newLevel = await this.getLevelFromExp(newExp);
      const prevExp = user.exp || 0;
      const prevLevel = user.level || 1;

      if (newExp !== prevExp || newLevel !== prevLevel) {
        user.exp = newExp;
        user.level = newLevel;
        await user.save();
        updatedUsers++;
        changes.push({
          userId: user._id,
          prevExp,
          newExp,
          prevLevel,
          newLevel,
        });
      }
    }

    const weekly = await this.getWeeklyLeaderboard(3);

    logger.info('Gamification', 'Recalculate all users complete', {
      totalUsers: users.length,
      updatedUsers,
      updatedAuditLogs: auditSync.updatedLogs,
      configRates: configSnapshot(config),
      weeklyTop3: weekly.entries.map(([userId, weeklyXp]) => ({ userId, weeklyXp })),
      weekRange: { start: weekly.weekStartKey, end: weekly.weekEndKey },
      weeklyStoredSum: weekly.storedSum,
      weeklyResolvedSum: weekly.resolvedSum,
    });

    return { totalUsers: users.length, updatedUsers, changes, auditSync, weeklyPreview: weekly };
  }

  static async awardExp(userId, amount, action, details = {}) {
    if (!amount || amount <= 0) return null;

    const user = await User.findById(userId);
    if (!user) return null;

    user.exp = (user.exp || 0) + amount;
    const newLevel = await this.getLevelFromExp(user.exp);

    let leveledUp = false;
    if (newLevel > (user.level || 1)) {
      user.level = newLevel;
      leveledUp = true;
    }

    await user.save();

    await XPAuditLog.create({
      userId,
      amount,
      action,
      details,
    });

    const { broadcastRealtimeEvent } = require('../config/realtime');
    await broadcastRealtimeEvent(`user-${userId}`, 'xp_awarded', {
      amount,
      action,
      actionLabel: ACTION_LABELS[action] || action,
      newTotal: user.exp,
      newLevel: user.level,
      leveledUp,
    });

    return { exp: user.exp, level: user.level, leveledUp };
  }

  static async awardActionXp(userId, action = 'ACTION_TRACKED', details = {}, options = {}) {
    const config = await this.getConfig();
    const amount = this.computeActionXp(config, action, details);
    if (!amount || amount <= 0) return null;

    const { entityKey, entityId, skipDailyCap = false } = options;

    if (entityKey && entityId) {
      const already = await this.hasAwardForEntity(userId, action, entityKey, entityId);
      if (already) return null;
    }

    if (!skipDailyCap) {
      const cap = getDailyCapForAction(action);
      if (cap != null && cap <= 0) return null;
      if (cap != null) {
        const countToday = await this.countActionToday(userId, action);
        if (countToday >= cap) return null;
      }
    }

    return this.awardExp(userId, amount, action, details);
  }

  static async handleGamificationEvent(eventType, payload = {}) {
    const { userId, task, project, asset, lead, invoice, reviewerId } = payload;
    const { isQaSyncGamification } = require('../utils/qaProbeContext');
    const qaProbe = isQaSyncGamification();
    const awardOpts = (entityKey, entityId) => ({
      entityKey,
      entityId,
      ...(qaProbe ? { skipDailyCap: true } : {}),
    });

    if (eventType === 'TASK_COMPLETED') {
      const completerId = userId || payload.completerId;
      if (!completerId || !task?._id) return null;

      const hours = this.resolveTaskCompletionHours(task);

      await this.generateDailyMissions(completerId);
      await this.progressMission(completerId, 'COMPLETE_TASK', 1);

      return this.awardActionXp(
        completerId,
        'COMPLETE_TASK',
        { taskId: task._id, hours, actualHours: task.actualHours },
        awardOpts('taskId', task._id)
      );
    }

    if (eventType === 'TASK_CREATED') {
      return this.awardActionXp(userId, 'CREATE_TASK', { taskId: task._id }, awardOpts('taskId', task._id));
    }

    if (eventType === 'PROJECT_CREATED') {
      return this.awardActionXp(userId, 'CREATE_PROJECT', { projectId: project._id }, awardOpts('projectId', project._id));
    }

    if (eventType === 'ASSET_UPLOADED') {
      return this.awardActionXp(userId, 'ASSET_UPLOAD', { assetId: asset._id }, awardOpts('assetId', asset._id));
    }

    if (eventType === 'LEAD_CAPTURED') {
      return this.awardActionXp(userId, 'LEAD_CAPTURE', { leadId: lead._id }, awardOpts('leadId', lead._id));
    }

    if (eventType === 'INVOICE_SUBMITTED') {
      return this.awardActionXp(userId, 'INVOICE_SUBMISSION', { invoiceId: invoice._id }, awardOpts('invoiceId', invoice._id));
    }

    if (eventType === 'REVIEW_APPROVED') {
      return this.awardActionXp(reviewerId, 'REVIEW_APPROVAL', { taskId: task._id }, awardOpts('taskId', task._id));
    }

    if (eventType === 'ATTENDANCE_DAY_COMPLETE') {
      const hours = Number(payload.hours) || 0;
      const result = await this.awardActionXp(
        userId,
        'ATTENDANCE_ACTION',
        { date: payload.date, hours },
        awardOpts('date', payload.date)
      );
      await this.progressMission(userId, 'ATTENDANCE_DAY', 1);
      return result;
    }

    return null;
  }

  static async generateDailyMissions(userId) {
    const today = startOfToday();

    const existing = await DailyMission.countDocuments({
      userId,
      date: { $gte: today },
    });

    if (existing > 0) return;

    const missions = DAILY_MISSIONS.map((m) => ({
      userId,
      title: m.title,
      description: m.description,
      targetCount: m.targetCount,
      expReward: m.expReward,
      actionType: m.actionType,
      date: today,
    }));

    await DailyMission.insertMany(missions);
  }

  static async progressMission(userId, actionType, count = 1) {
    const today = startOfToday();

    const missions = await DailyMission.find({
      userId,
      actionType,
      completed: false,
      date: { $gte: today },
    });

    for (const mission of missions) {
      mission.currentCount += count;
      if (mission.currentCount >= mission.targetCount) {
        mission.completed = true;
        await this.awardExp(userId, mission.expReward, 'MISSION_COMPLETE', {
          missionId: mission._id,
          title: mission.title,
        });
      }
      await mission.save();
    }
  }

  static getRulesMetadata() {
    const {
      FAIRNESS_PRINCIPLES,
      ROLE_PATHS,
      XP_RULE_ROWS,
      NO_XP_ACTIONS,
      DEFAULT_DAILY_CAPS,
      DAILY_MISSIONS,
      ACTION_LABELS,
    } = require('../../shared/gamificationRules');

    return {
      fairnessPrinciples: FAIRNESS_PRINCIPLES,
      rolePaths: ROLE_PATHS,
      xpRules: XP_RULE_ROWS,
      noXpActions: NO_XP_ACTIONS,
      dailyCaps: DEFAULT_DAILY_CAPS,
      dailyMissions: DAILY_MISSIONS,
      actionLabels: ACTION_LABELS,
    };
  }
}

module.exports = GamificationService;
