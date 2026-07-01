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
  WEEKLY_MISSIONS,
  RECALC_HISTORY_ACTIONS,
  normalizeGamificationAction,
  isTimeBasedXpAction,
  computeTimeBasedXp,
  computeManualDailyLogXp,
  resolveManualDailyLogOvertimeRate,
  clampXpHours,
  MAX_XP_HOURS_PER_EVENT,
} = require('../../shared/gamificationRules');
const { MIN_COMPLETION_MINUTES, parseTimeSpentToHours } = require('../../shared/timeSpent');
const { todayStart, todayEnd, getCurrentWeekRange, getPreviousWeekRange, getCurrentMonthRange, getPreviousMonthRange, getDateKey } = require('../utils/attendanceDate');

/** One XP audit row per user per entity (prevents inflated totals from legacy duplicate awards). */
const ENTITY_DEDUPE_FIELD = {
  ATTENDANCE_ACTION: 'date',
  ATTENDANCE_DAY_BONUS: 'date',
  LEAD_CAPTURE: 'leadId',
  COMPLETE_TASK: 'taskId',
  CREATE_TASK: 'taskId',
  REVIEW_APPROVAL: 'taskId',
  INVOICE_SUBMISSION: 'invoiceId',
  ASSET_UPLOAD: 'assetId',
  CREATE_PROJECT: 'projectId',
  CALENDAR_EVENT_CREATED: 'eventId',
  ANNOUNCEMENT_CREATED: 'announcementId',
};

const STEP_XP = DEFAULT_XP.stepXp;
const BULK_WRITE_CHUNK = 500;

const getTenantScopedUserFilter = () => {
  try {
    const { getTenantId } = require('../utils/tenantContext');
    const tenantId = getTenantId();
    return tenantId ? { tenantId } : {};
  } catch {
    return {};
  }
};

const getConfigKeyForAction = (action) => {
  const normalized = normalizeGamificationAction(action);
  return ACTION_CONFIG_KEY[normalized] || null;
};

const toPlainConfig = (config) => (config?.toObject ? config.toObject() : config);

/** DB config merged with DEFAULT_XP so recalc/sync always see effective rates. */
const getEffectiveConfigPlain = (config) => ({
  ...DEFAULT_XP,
  ...toPlainConfig(config),
});

const configSnapshot = (config) => {
  const plain = getEffectiveConfigPlain(config);
  return Object.fromEntries(
    Object.entries(ACTION_CONFIG_KEY)
      .filter(([, configKey]) => configKey)
      .map(([, configKey]) => [configKey, plain[configKey]])
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
    let config = await GamificationConfig.findOne().sort({ updatedAt: -1 });
    if (!config) {
      config = await GamificationConfig.create({});
    }
    return config;
  }

  static async getConfigPlain() {
    return getEffectiveConfigPlain(await this.getConfig());
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
    return clampXpHours(hours);
  }

  static computeActionXp(config, action, details = {}) {
    const normalized = normalizeGamificationAction(action);

    if (normalized === 'MISSION_COMPLETE') {
      return Number(details.expReward) || 0;
    }

    const rate = this.getXpRate(config, normalized);
    if (!rate) return 0;

    if (isTimeBasedXpAction(normalized)) {
      const rawHours = Number(details.hours) || 0;
      const hours = clampXpHours(rawHours);
      const xp =
        normalized === 'DAILY_LOG'
          ? computeManualDailyLogXp(
              hours,
              rate,
              resolveManualDailyLogOvertimeRate(toPlainConfig(config))
            )
          : computeTimeBasedXp(hours, rate);
      return xp;
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
    const normalized = normalizeGamificationAction(action);
    const query = {
      userId,
      action: normalized,
      createdAt: { $gte: startOfToday(), $lte: endOfToday() },
    };
    if (normalized === 'DAILY_LOG') {
      query['details.logId'] = { $exists: true, $ne: null };
    }
    return XPAuditLog.countDocuments(query);
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

  static resolveEntityDedupeKey(log) {
    if (!log?.userId || RECALC_HISTORY_ACTIONS.has(log.action)) return null;
    const normalized = normalizeGamificationAction(log.action);
    const field = ENTITY_DEDUPE_FIELD[normalized];
    if (!field) return null;

    let value = log.details?.[field];
    if (value == null || value === '') {
      if (normalized === 'ATTENDANCE_ACTION' || normalized === 'ATTENDANCE_DAY_BONUS') {
        value = getDateKey(log.createdAt);
      } else {
        return null;
      }
    }
    return `${String(log.userId)}|${normalized}|${String(value)}`;
  }

  /** In-memory: keep newest row per user+action+entity (matches awardActionXp upsert intent). */
  static dedupeXpAuditLogsForTotals(logs = []) {
    const keptByKey = new Map();
    const passthrough = [];

    for (const log of logs) {
      const key = this.resolveEntityDedupeKey(log);
      if (!key) {
        passthrough.push(log);
        continue;
      }
      const existing = keptByKey.get(key);
      if (!existing || new Date(log.createdAt) >= new Date(existing.createdAt)) {
        keptByKey.set(key, log);
      }
    }

    return [...passthrough, ...keptByKey.values()];
  }

  /** Delete duplicate entity-scoped audit rows (root cause of one-user XP inflation). */
  static async repairDuplicateXpAuditLogs(userIds = []) {
    const filter = userIds.length ? { userId: { $in: userIds } } : {};
    const logs = await XPAuditLog.find(filter)
      .select('_id userId action details createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const seenEntity = new Set();
    const toDelete = [];
    for (const log of logs) {
      const key = this.resolveEntityDedupeKey(log);
      if (!key) continue;
      if (seenEntity.has(key)) {
        toDelete.push(log._id);
      } else {
        seenEntity.add(key);
      }
    }

    if (toDelete.length) {
      await XPAuditLog.deleteMany({ _id: { $in: toDelete } });
    }

    const byUser = {};
    for (const log of logs) {
      if (!toDelete.some((id) => String(id) === String(log._id))) continue;
      const u = String(log.userId);
      byUser[u] = (byUser[u] || 0) + 1;
    }

    return { removed: toDelete.length, byUser };
  }

  static collectHoursBackfillIds(logs = []) {
    const taskIdSet = new Set();
    const logIdSet = new Set();
    for (const log of logs) {
      const normalized = normalizeGamificationAction(log.action);
      if (!isTimeBasedXpAction(normalized) || log.details?.hours != null) continue;
      if (normalized === 'COMPLETE_TASK' && log.details?.taskId) {
        taskIdSet.add(String(log.details.taskId));
      }
      if (normalized === 'DAILY_LOG' && log.details?.logId) {
        logIdSet.add(String(log.details.logId));
      }
    }
    return { taskIdSet, logIdSet };
  }

  static async fetchHoursBackfillMaps(logs = []) {
    const { taskIdSet, logIdSet } = this.collectHoursBackfillIds(logs);
    const Task = require('../models/Task');
    const Log = require('../models/Log');
    const tasksById = new Map();
    const logsById = new Map();

    const taskIds = [...taskIdSet].filter((id) => mongoose.Types.ObjectId.isValid(id));
    const dailyLogIds = [...logIdSet].filter((id) => mongoose.Types.ObjectId.isValid(id));

    if (taskIds.length) {
      const tasks = await Task.find({ _id: { $in: taskIds } })
        .select('actualHours plannedHours')
        .lean();
      for (const task of tasks) tasksById.set(String(task._id), task);
    }
    if (dailyLogIds.length) {
      const dailyLogs = await Log.find({ _id: { $in: dailyLogIds } })
        .select('details')
        .lean();
      for (const row of dailyLogs) logsById.set(String(row._id), row);
    }

    return { tasksById, logsById };
  }

  static resolveAuditHours(log, backfillMaps = null) {
    if (log.details?.hours != null) {
      const h = Number(log.details.hours);
      return h > 0 ? clampXpHours(h) : null;
    }
    if (!backfillMaps) return null;

    const normalized = normalizeGamificationAction(log.action);
    if (normalized === 'COMPLETE_TASK' && log.details?.taskId) {
      const task = backfillMaps.tasksById.get(String(log.details.taskId));
      if (task) return this.resolveTaskCompletionHours(task);
    }
    if (normalized === 'DAILY_LOG' && log.details?.logId) {
      const dailyLog = backfillMaps.logsById.get(String(log.details.logId));
      if (dailyLog) {
        const h = parseTimeSpentToHours(dailyLog.details?.timeSpent);
        return h > 0 ? clampXpHours(h) : null;
      }
    }
    return null;
  }

  static computeLogAmount(configPlain, log, hours = undefined, backfillMaps = null) {
    if (RECALC_HISTORY_ACTIONS.has(log.action)) {
      return 0;
    }
    const normalized = normalizeGamificationAction(log.action);
    const plain = configPlain?.taskCompletion != null ? configPlain : getEffectiveConfigPlain(configPlain);
    const configKey = getConfigKeyForAction(normalized);
    const rate = configKey ? (plain[configKey] ?? DEFAULT_XP[configKey] ?? 0) : 0;

    let resolvedHours = hours !== undefined && hours !== null
      ? hours
      : this.resolveAuditHours(log, backfillMaps);

    if (isTimeBasedXpAction(normalized)) {
      const stored = Number(log.amount) || 0;
      const maxXp = rate > 0 ? computeTimeBasedXp(MAX_XP_HOURS_PER_EVENT, rate) : stored;

      if (resolvedHours == null || resolvedHours <= 0) {
        if (maxXp > 0 && stored > maxXp) return maxXp;
        if (stored > 0 && (maxXp <= 0 || stored <= maxXp)) {
          return stored;
        }
        if (normalized === 'COMPLETE_TASK') {
          resolvedHours = MIN_COMPLETION_MINUTES / 60;
        }
      }

      if (resolvedHours != null && resolvedHours > 0 && rate > 0) {
        if (normalized === 'DAILY_LOG') {
          return computeManualDailyLogXp(
            resolvedHours,
            rate,
            resolveManualDailyLogOvertimeRate(plain)
          );
        }
        const xp = computeTimeBasedXp(resolvedHours, rate);
        if (maxXp > 0 && xp > maxXp) return maxXp;
        return xp;
      }

      return stored;
    }

    if (configKey && plain[configKey] != null) {
      return Number(plain[configKey]) || 0;
    }

    return Number(log.amount) || 0;
  }

  static resolveLogAmount(config, log, backfillMaps = null) {
    const plain = getEffectiveConfigPlain(config);
    return this.computeLogAmount(plain, log, undefined, backfillMaps);
  }

  static buildWeeklyGroupedBreakdown(logs, configPlain, backfillMaps, options = {}) {
    const deduped = this.dedupeXpAuditLogsForTotals(logs);
    const plain = getEffectiveConfigPlain(configPlain);
    const groupedMap = new Map();

    for (const log of deduped) {
      const normalized = normalizeGamificationAction(log.action);
      const resolvedAmount = this.resolveLogAmount(plain, log, backfillMaps);
      const timeBased = isTimeBasedXpAction(normalized);
      const key = timeBased ? normalized : `${normalized}::${resolvedAmount}`;

      if (!groupedMap.has(key)) {
        const configKey = getConfigKeyForAction(normalized);
        groupedMap.set(key, {
          action: normalized,
          actionLabel: ACTION_LABELS[normalized] || normalized,
          amountPerAction: 0,
          count: 0,
          totalXp: 0,
          totalHours: 0,
          timeBased,
          ratePerHour: timeBased && configKey ? plain[configKey] : null,
          sampleMessage: ACTION_LABELS[normalized] || normalized,
        });
      }

      const group = groupedMap.get(key);
      group.count += 1;
      group.totalXp += resolvedAmount;

      if (timeBased) {
        let h = this.resolveAuditHours(log, backfillMaps);
        if ((h == null || h <= 0) && normalized === 'COMPLETE_TASK') {
          h = MIN_COMPLETION_MINUTES / 60;
        }
        group.totalHours += h || 0;
      }
    }

    for (const group of groupedMap.values()) {
      if (group.count > 0) {
        group.amountPerAction = Math.round(group.totalXp / group.count);
        if (group.timeBased) {
          group.avgHours = Math.round((group.totalHours / group.count) * 100) / 100;
          group.calculationLine = `${group.count} × ${group.avgHours}h avg × ${group.ratePerHour} XP/h`;
        } else {
          group.calculationLine = `${group.count} × ${group.amountPerAction} XP`;
        }
      }
    }

    return Array.from(groupedMap.values()).sort((a, b) => b.totalXp - a.totalXp);
  }

  static buildCalculationSummary(groupedBreakdown, totalXp) {
    const lines = (groupedBreakdown || []).map((item) => ({
      action: item.action,
      actionLabel: item.actionLabel || item.sampleMessage,
      count: item.count,
      amountPerAction: item.amountPerAction,
      ratePerHour: item.ratePerHour,
      avgHours: item.avgHours,
      timeBased: item.timeBased,
      formula: item.calculationLine || (
        item.timeBased
          ? `${item.count} × ${item.avgHours ?? '?'}h × ${item.ratePerHour} XP/h`
          : `${item.count} × ${item.amountPerAction} XP`
      ),
      subtotal: item.totalXp,
    }));
    const subtotalSum = lines.reduce((sum, line) => sum + (Number(line.subtotal) || 0), 0);
    return {
      lines,
      subtotalSum,
      totalXp: Number(totalXp) || 0,
      verified: subtotalSum === (Number(totalXp) || 0),
    };
  }

  static async recalculateExpFromAudit(userId, configPlain, backfillMaps) {
    const plain = configPlain || (await this.getConfigPlain());
    const maps = backfillMaps || (await this.fetchHoursBackfillMaps(
      await XPAuditLog.find({ userId }).select('action amount details').lean()
    ));
    const logs = await XPAuditLog.find({ userId }).select('action amount details createdAt').lean();
    const dedupedLogs = this.dedupeXpAuditLogsForTotals(logs);

    let total = 0;
    for (const log of dedupedLogs) {
      total += this.computeLogAmount(plain, log, undefined, maps);
    }
    return total;
  }

  static async syncAuditLogAmountsFromConfig(options = {}) {
    const config = await this.getConfigPlain();
    const logs =
      options.logs ||
      (await XPAuditLog.find().select('action amount details').lean());
    const backfillMaps =
      options.backfillMaps || (await this.fetchHoursBackfillMaps(logs));

    const bulkOps = [];
    const unmappedActions = {};
    const samples = [];
    const actionStats = {};
    const hoursStats = {
      total: logs.length,
      hadHours: 0,
      backfilledHours: 0,
      frozenStoredAmount: 0,
    };

    for (const log of logs) {
      const configKey = getConfigKeyForAction(log.action);
      if (!configKey) {
        unmappedActions[log.action] = (unmappedActions[log.action] || 0) + 1;
        continue;
      }

      const hours = this.resolveAuditHours(log, backfillMaps);
      if (log.details?.hours != null) hoursStats.hadHours += 1;
      else if (hours != null) hoursStats.backfilledHours += 1;
      else if (isTimeBasedXpAction(normalizeGamificationAction(log.action))) {
        hoursStats.frozenStoredAmount += 1;
      }

      const newAmount = this.computeLogAmount(config, log, hours);
      const oldAmount = Number(log.amount) || 0;
      if (!actionStats[log.action]) {
        actionStats[log.action] = { configKey, count: 0, oldAmount, newAmount };
      }
      actionStats[log.action].count += 1;

      const needsHoursPersist = hours != null && log.details?.hours == null;
      if (newAmount !== oldAmount || needsHoursPersist) {
        if (samples.length < 5 && (log.action === 'COMPLETE_TASK' || configKey === 'taskCompletion')) {
          samples.push({ action: log.action, configKey, oldAmount, newAmount, hours });
        }
        const recalcAt = new Date();
        const $set = {
          amount: newAmount,
          previousAmount: oldAmount,
          recalculatedAt: recalcAt,
          recalcReason: 'config_sync',
        };
        if (needsHoursPersist) {
          $set.details = { ...(log.details || {}), hours };
        }
        bulkOps.push({
          updateOne: {
            filter: { _id: log._id },
            update: { $set },
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
      hoursStats,
      configRates: configSnapshot(config),
    };

    if (options.log !== false) {
      logger.info('Gamification', 'Audit log sync from config', {
        updatedLogs: result.updatedLogs,
        totalLogs: result.totalLogs,
        hoursStats: result.hoursStats,
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

  /** Sum stored audit amounts for the week (pre-recalc snapshot). */
  static snapshotWeeklyXpFromStoredAmounts(userIds, weekStart, weekEnd) {
    const idList = (userIds || []).map((id) => new mongoose.Types.ObjectId(id));
    const snapshot = {};
    for (const id of idList) {
      snapshot[String(id)] = 0;
    }
    if (!idList.length) return snapshot;

    return XPAuditLog.find({
      userId: { $in: idList },
      createdAt: { $gte: weekStart, $lte: weekEnd },
    })
      .select('userId amount')
      .lean()
      .then((logs) => {
        const deduped = GamificationService.dedupeXpAuditLogsForTotals(logs);
        for (const log of deduped) {
          const key = String(log.userId);
          snapshot[key] = (snapshot[key] || 0) + (Number(log.amount) || 0);
        }
        return snapshot;
      });
  }

  static aggregateWeeklyXpFromLogs(logs, config, backfillMaps = null) {
    const plain = getEffectiveConfigPlain(config);
    const totalsByUser = new Map();
    let storedSum = 0;
    let resolvedSum = 0;
    const dedupedLogs = this.dedupeXpAuditLogsForTotals(logs);

    for (const log of dedupedLogs) {
      const stored = Number(log.amount) || 0;
      const hours = this.resolveAuditHours(log, backfillMaps);
      const resolved = this.computeLogAmount(plain, log, undefined, backfillMaps);
      storedSum += stored;
      resolvedSum += resolved;
      const userKey = String(log.userId);
      totalsByUser.set(userKey, (totalsByUser.get(userKey) || 0) + resolved);
    }

    return {
      totalsByUser,
      storedSum,
      resolvedSum,
      logCount: dedupedLogs.length,
      rawLogCount: logs.length,
    };
  }

  /** Per-user weekly XP before/after last admin recalc (for leaderboard hover). */
  static buildWeeklyRecalcMetaByUser(logs, configPlain, backfillMaps, lastRecalculatedAt) {
    const lastRecalcMs = lastRecalculatedAt ? new Date(lastRecalculatedAt).getTime() : null;
    const byUser = new Map();
    const dedupedLogs = this.dedupeXpAuditLogsForTotals(logs);

    for (const log of dedupedLogs) {
      const userKey = String(log.userId);
      if (!byUser.has(userKey)) {
        byUser.set(userKey, { weeklyXp: 0, weeklyXpPrior: 0, changes: [] });
      }
      const row = byUser.get(userKey);
      const hours = this.resolveAuditHours(log, backfillMaps);
      const resolved = this.computeLogAmount(configPlain, log, undefined, backfillMaps);
      const adjustedInLastRecalc =
        lastRecalcMs != null
        && log.previousAmount != null
        && log.recalculatedAt
        && log.recalcReason === 'config_sync'
        && Math.abs(new Date(log.recalculatedAt).getTime() - lastRecalcMs) < 120000;

      row.weeklyXp += resolved;
      if (adjustedInLastRecalc) {
        const prev = Number(log.previousAmount) || 0;
        row.weeklyXpPrior += prev;
        if (resolved !== prev) {
          const normalized = normalizeGamificationAction(log.action);
          row.changes.push({
            action: log.action,
            actionLabel: ACTION_LABELS[normalized] || log.action,
            previousAmount: prev,
            amount: resolved,
            delta: resolved - prev,
          });
        }
      } else {
        row.weeklyXpPrior += resolved;
      }
    }

    for (const row of byUser.values()) {
      row.weeklyXpDelta = row.weeklyXp - row.weeklyXpPrior;
      row.changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    }
    return byUser;
  }

  static async getMonthlyLeaderboard(limit, monthStartInput) {
    const config = await this.getConfigPlain();
    const { monthStart, monthEnd, monthStartKey, monthEndKey } = monthStartInput
      ? getCurrentMonthRange(monthStartInput)
      : getCurrentMonthRange();

    const tenantFilter = getTenantScopedUserFilter();
    const tenantUsers = await User.find(tenantFilter).select('_id').lean();
    const tenantUserIds = tenantUsers.map((u) => u._id);
    const logQuery = {
      createdAt: { $gte: monthStart, $lte: monthEnd },
      ...(tenantUserIds.length ? { userId: { $in: tenantUserIds } } : {}),
    };

    const logs = await XPAuditLog.find(logQuery)
      .select('userId action amount details')
      .lean();

    const backfillMaps = await this.fetchHoursBackfillMaps(logs);
    const { totalsByUser, storedSum, resolvedSum, logCount } = this.aggregateWeeklyXpFromLogs(
      logs,
      config,
      backfillMaps
    );

    const sorted = [...totalsByUser.entries()].sort((a, b) => b[1] - a[1]);
    const entries =
      typeof limit === 'number' && limit > 0 ? sorted.slice(0, limit) : sorted;

    return {
      monthStart,
      monthEnd,
      monthStartKey,
      monthEndKey,
      entries,
      logCount,
      storedSum,
      resolvedSum,
      configRates: configSnapshot(config),
    };
  }

  static async getWeeklyLeaderboard(limit, weekStartInput) {
    const config = await this.getConfigPlain();
    const { weekStart, weekEnd, weekStartKey, weekEndKey } = weekStartInput
      ? getCurrentWeekRange(weekStartInput)
      : getCurrentWeekRange();

    const tenantFilter = getTenantScopedUserFilter();
    const tenantUsers = await User.find(tenantFilter).select('_id').lean();
    const tenantUserIds = tenantUsers.map((u) => u._id);
    const logQuery = {
      createdAt: { $gte: weekStart, $lte: weekEnd },
      ...(tenantUserIds.length ? { userId: { $in: tenantUserIds } } : {}),
    };

    const logs = await XPAuditLog.find(logQuery)
      .select('userId action amount details')
      .lean();

    const backfillMaps = await this.fetchHoursBackfillMaps(logs);
    const { totalsByUser, storedSum, resolvedSum, logCount } = this.aggregateWeeklyXpFromLogs(
      logs,
      config,
      backfillMaps
    );

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

  static async getLeaderboardTopEntries(limit = 5, monthStartInput) {
    const monthly = await this.getMonthlyLeaderboard(null, monthStartInput);
    const tenantFilter = getTenantScopedUserFilter();
    const allUsers = await User.find(tenantFilter, 'name avatar exp level').sort({ name: 1 }).lean();
    const monthlyXpByUserId = new Map(
      monthly.entries.map(([userId, monthlyXp]) => [String(userId), monthlyXp])
    );

    return allUsers
      .map((user) => ({
        ...user,
        monthlyXp: monthlyXpByUserId.get(String(user._id)) || 0,
      }))
      .sort((a, b) => {
        if (b.monthlyXp !== a.monthlyXp) return b.monthlyXp - a.monthlyXp;
        return (a.name || '').localeCompare(b.name || '');
      })
      .slice(0, limit)
      .map((user, index) => ({
        rank: index + 1,
        _id: user._id,
        name: user.name,
        avatar: user.avatar,
        monthlyXp: user.monthlyXp,
        exp: user.exp,
        level: user.level,
      }));
  }

  static formatXpLogForApi(log, config, toSimpleMessage) {
    const amount = this.resolveLogAmount(config, log);
    const adjusted = Boolean(
      log.recalculatedAt
      || log.action === 'XP_RECALC_ADJUSTMENT'
      || log.previousAmount != null
    );
    let message = toSimpleMessage ? toSimpleMessage(log) : (ACTION_LABELS[log.action] || log.action);
    if (log.action === 'XP_RECALC_ADJUSTMENT') {
      const removed = log.details?.removedAction;
      const prev = log.details?.previousAmount;
      if (removed && prev != null) {
        message = `Removed invalid ${removed} entry (${prev} XP) — totals recalculated`;
      } else if (log.details?.message) {
        message = log.details.message;
      }
    }
    return {
      _id: log._id,
      amount,
      storedAmount: Number(log.amount) || 0,
      action: log.action,
      actionLabel: ACTION_LABELS[log.action] || log.action.replace(/_/g, ' ').toLowerCase(),
      message,
      createdAt: log.createdAt,
      adjusted,
      previousAmount: log.previousAmount ?? log.details?.previousAmount ?? null,
      recalculatedAt: log.recalculatedAt || null,
      recalcReason: log.recalcReason || log.details?.reason || null,
    };
  }

  static async broadcastRecalculationEffects({ changes = [], auditSync, weeklyPreview }) {
    const { broadcastRealtimeEvent } = require('../config/realtime');
    const recalcAt = new Date();

    await broadcastRealtimeEvent('gamification', 'gamification_recalculated', {
      recalculatedAt: recalcAt,
      updatedUsers: changes.length,
      updatedAuditLogs: auditSync?.updatedLogs ?? 0,
      weeklyTop3: (weeklyPreview?.entries || []).slice(0, 3).map(([userId, weeklyXp]) => ({
        userId,
        weeklyXp,
      })),
    });

    const weeklyByUser = new Map(weeklyPreview?.entries || []);
    for (const change of changes) {
      const userKey = String(change.userId);
      await broadcastRealtimeEvent(`user-${userKey}`, 'xp_recalculated', {
        recalculatedAt: recalcAt,
        prevExp: change.prevExp,
        newExp: change.newExp,
        prevLevel: change.prevLevel,
        newLevel: change.newLevel,
        weeklyXp: weeklyByUser.get(userKey) ?? weeklyByUser.get(change.userId) ?? 0,
        adjusted: true,
      });
    }
  }

  static async recalculateUsersFromAudit(userIds = []) {
    const ids = [...new Set((userIds || []).map((id) => String(id)).filter(Boolean))];
    if (!ids.length) return { updatedUsers: 0, changes: [] };

    const config = await this.getConfigPlain();
    const allAuditLogs = await XPAuditLog.find().select('action amount details').lean();
    const backfillMaps = await this.fetchHoursBackfillMaps(allAuditLogs);

    let updatedUsers = 0;
    const changes = [];

    for (const userKey of ids) {
      const user = await User.findById(userKey).select('_id exp level');
      if (!user) continue;

      const newExp = Math.round(
        await this.recalculateExpFromAudit(user._id, config, backfillMaps)
      );
      const newLevel = await this.getLevelFromExp(newExp);
      const prevExp = Math.round(user.exp || 0);
      const prevLevel = user.level || 1;

      if (newExp !== prevExp || newLevel !== prevLevel) {
        user.exp = newExp;
        user.level = newLevel;
        await user.save();
        updatedUsers += 1;
        changes.push({ userId: user._id, prevExp, newExp, prevLevel, newLevel });
      }
    }

    return { updatedUsers, changes };
  }

  static async recalculateAllUsersFromConfig() {
    const config = await this.getConfigPlain();
    const tenantFilter = getTenantScopedUserFilter();
    const users = await User.find(tenantFilter).select('_id exp level tenantId');
    const tenantUserIds = users.map((u) => u._id);
    const auditUserFilter = tenantUserIds.length ? { userId: { $in: tenantUserIds } } : {};

    const { monthStart, monthEnd } = getCurrentMonthRange();
    const monthlyPriorSnapshot = await this.snapshotWeeklyXpFromStoredAmounts(
      tenantUserIds,
      monthStart,
      monthEnd
    );

    const { purgeQaGamificationData } = require('./qa/qaTestData');
    const qaGamificationPurge = await purgeQaGamificationData();

    const duplicateRepair = await this.repairDuplicateXpAuditLogs(tenantUserIds);

    const { repairReviewExploitData } = require('./reviewExploitRepairService');
    const reviewExploitRepair = await repairReviewExploitData({ log: true });
    const allAuditLogs = await XPAuditLog.find(auditUserFilter).select('action amount details').lean();
    const backfillMaps = await this.fetchHoursBackfillMaps(allAuditLogs);
    const auditSync = await this.syncAuditLogAmountsFromConfig({
      log: true,
      logs: allAuditLogs,
      backfillMaps,
    });

    let updatedUsers = 0;
    const changes = [];
    let sampleDelta = null;

    for (const user of users) {
      const newExp = Math.round(
        await this.recalculateExpFromAudit(user._id, config, backfillMaps)
      );
      const newLevel = await this.getLevelFromExp(newExp);
      const prevExp = Math.round(user.exp || 0);
      const prevLevel = user.level || 1;

      if (!sampleDelta && (newExp !== prevExp || newLevel !== prevLevel)) {
        sampleDelta = { userId: String(user._id), prevExp, newExp, prevLevel, newLevel };
      }

      user.exp = newExp;
      user.level = newLevel;
      await user.save();

      if (newExp !== prevExp || newLevel !== prevLevel) {
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

    const monthly = await this.getMonthlyLeaderboard(3);
    const recalculatedAt = new Date();

    let configDoc = await GamificationConfig.findOne();
    if (!configDoc) configDoc = await GamificationConfig.create({});
    configDoc.lastRecalculatedAt = recalculatedAt;
    configDoc.lastRecalcWeeklyPrior = monthlyPriorSnapshot;
    await configDoc.save();

    await this.broadcastRecalculationEffects({
      changes,
      auditSync,
      weeklyPreview: monthly,
    });

    logger.info('Gamification', 'Recalculate all users complete', {
      totalUsers: users.length,
      updatedUsers,
      updatedAuditLogs: auditSync.updatedLogs,
      qaGamificationPurge,
      duplicateRepair,
      reviewExploitRepair,
      configRates: configSnapshot(config),
      sampleDelta,
      monthlyTop3: monthly.entries.map(([userId, monthlyXp]) => ({ userId, monthlyXp })),
      monthRange: { start: monthly.monthStartKey, end: monthly.monthEndKey },
      monthlyStoredSum: monthly.storedSum,
      monthlyResolvedSum: monthly.resolvedSum,
    });

    return {
      totalUsers: users.length,
      updatedUsers,
      changes,
      auditSync,
      qaGamificationPurge,
      duplicateRepair,
      reviewExploitRepair,
      weeklyPreview: monthly,
      recalculatedAt,
    };
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

  static buildEntityAwardFilter(userId, action, entityKey, entityId) {
    const idStr = String(entityId);
    const entityMatch = [{ [`details.${entityKey}`]: entityId }, { [`details.${entityKey}`]: idStr }];
    if (mongoose.Types.ObjectId.isValid(idStr)) {
      entityMatch.push({ [`details.${entityKey}`]: new mongoose.Types.ObjectId(idStr) });
    }
    return { userId, action, $or: entityMatch };
  }

  static buildEntityDedupeKey(userId, action, entityKey, entityId) {
    return `${userId}:${action}:${entityKey}:${String(entityId)}`;
  }

  static async awardActionXp(userId, action = 'ACTION_TRACKED', details = {}, options = {}) {
    const config = await this.getConfig();
    const normalized = normalizeGamificationAction(action);
    const awardDetails = { ...details };
    if (isTimeBasedXpAction(normalized) && awardDetails.hours != null) {
      const rawHours = Number(awardDetails.hours) || 0;
      awardDetails.hours = clampXpHours(rawHours);
      awardDetails.rawHours = rawHours !== awardDetails.hours ? rawHours : undefined;
    }
    const amount = this.computeActionXp(config, action, awardDetails);
    if (!amount || amount <= 0) return null;

    const { entityKey, entityId, skipDailyCap = false } = options;

    if (!skipDailyCap) {
      const cap = getDailyCapForAction(action);
      if (cap != null && cap <= 0) return null;
      if (cap != null) {
        const countToday = await this.countActionToday(userId, action);
        if (countToday >= cap) return null;
      }
    }

    if (entityKey && entityId) {
      const filter = this.buildEntityAwardFilter(userId, action, entityKey, entityId);
      const dedupeKey = this.buildEntityDedupeKey(userId, action, entityKey, entityId);
      const insertDoc = {
        userId,
        amount,
        action,
        details: awardDetails,
        dedupeKey,
        createdAt: new Date(),
      };
      let upsert;
      try {
        upsert = await XPAuditLog.updateOne(filter, { $setOnInsert: insertDoc }, { upsert: true });
      } catch (err) {
        if (err?.code === 11000) return null;
        throw err;
      }
      if (upsert.upsertedCount !== 1) return null;

      const user = await User.findById(userId);
      if (!user) return null;
      const prevLevel = user.level || 1;
      user.exp = (user.exp || 0) + amount;
      const newLevel = await this.getLevelFromExp(user.exp);
      let leveledUp = false;
      if (newLevel > prevLevel) {
        user.level = newLevel;
        leveledUp = true;
      }
      try {
        await user.save();
      } catch (err) {
        // Race: Jest afterEach may wipe users while fire-and-forget XP job runs
        if (err?.name === 'DocumentNotFoundError') return null;
        throw err;
      }

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

    return this.awardExp(userId, amount, action, awardDetails);
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
    const endToday = endOfToday();

    const existing = await DailyMission.countDocuments({
      userId,
      cadence: { $ne: 'weekly' },
      date: { $gte: today, $lte: endToday },
    });

    if (existing > 0) return;

    const missions = DAILY_MISSIONS.map((m) => ({
      userId,
      title: m.title,
      description: m.description,
      targetCount: m.targetCount,
      expReward: m.expReward,
      actionType: m.actionType,
      cadence: 'daily',
      date: today,
    }));

    await DailyMission.insertMany(missions);
  }

  static async generateWeeklyMissions(userId) {
    const { weekStart, weekStartKey } = getCurrentWeekRange();

    const existing = await DailyMission.countDocuments({
      userId,
      cadence: 'weekly',
      weekKey: weekStartKey,
    });

    if (existing > 0) return;

    let newsletterCount = 0;
    try {
      const NewsletterIssue = require('../models/NewsletterIssue');
      const NewsletterArticle = require('../models/NewsletterArticle');
      const { getCurrentWeekKey } = require('../utils/newsletterWeek');
      const issue = await NewsletterIssue.findOne({ weekKey: getCurrentWeekKey() }).lean();
      if (issue) {
        newsletterCount = await NewsletterArticle.countDocuments({
          issueId: issue._id,
          addedBy: userId,
        });
      }
    } catch (err) {
      logger.warn('Gamification', 'Newsletter backfill skipped', { error: err.message });
    }

    const missions = WEEKLY_MISSIONS.map((m) => {
      const initialCount = m.actionType === 'NEWSLETTER_ARTICLE'
        ? Math.min(newsletterCount, m.targetCount)
        : 0;
      return {
        userId,
        title: m.title,
        description: m.description,
        targetCount: m.targetCount,
        expReward: m.expReward,
        actionType: m.actionType,
        cadence: 'weekly',
        weekKey: weekStartKey,
        date: weekStart,
        currentCount: initialCount,
        completed: initialCount >= m.targetCount,
      };
    });

    await DailyMission.insertMany(missions);

    for (const mission of missions) {
      if (mission.completed) {
        const saved = await DailyMission.findOne({
          userId,
          cadence: 'weekly',
          weekKey: weekStartKey,
          actionType: mission.actionType,
        });
        if (saved) {
          await this.awardActionXp(
            userId,
            'MISSION_COMPLETE',
            {
              missionId: saved._id,
              title: saved.title,
              expReward: saved.expReward,
            },
            { entityKey: 'missionId', entityId: saved._id }
          );
        }
      }
    }
  }

  static async progressMission(userId, actionType, count = 1) {
    const today = startOfToday();
    const { weekStartKey } = getCurrentWeekRange();

    const dailyMissions = await DailyMission.find({
      userId,
      actionType,
      completed: false,
      cadence: { $ne: 'weekly' },
      date: { $gte: today },
    });

    const weeklyMissions = await DailyMission.find({
      userId,
      actionType,
      completed: false,
      cadence: 'weekly',
      weekKey: weekStartKey,
    });

    const missions = [...dailyMissions, ...weeklyMissions];

    for (const mission of missions) {
      mission.currentCount += count;
      if (mission.currentCount >= mission.targetCount && !mission.completed) {
        mission.completed = true;
        await this.awardActionXp(
          userId,
          'MISSION_COMPLETE',
          {
            missionId: mission._id,
            title: mission.title,
            expReward: mission.expReward,
          },
          { entityKey: 'missionId', entityId: mission._id }
        );
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
