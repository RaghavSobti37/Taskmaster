const User = require('../models/User');
const DailyMission = require('../models/DailyMission');
const XPAuditLog = require('../models/XPAuditLog');
const GamificationConfig = require('../models/GamificationConfig');
const {
  DEFAULT_XP,
  DEFAULT_DAILY_CAPS,
  ACTION_CONFIG_KEY,
  ACTION_LABELS,
  DAILY_MISSIONS,
} = require('../../shared/gamificationRules');
const { todayStart, todayEnd } = require('../utils/attendanceDate');

const STEP_XP = DEFAULT_XP.stepXp;

const getConfigKeyForAction = (action) => ACTION_CONFIG_KEY[action] || null;

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

  static getXpAmount(config, action) {
    const configKey = getConfigKeyForAction(action);
    if (!configKey) return 0;
    return config[configKey] ?? DEFAULT_XP[configKey] ?? 0;
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
    const rawXp = (level - 1) * stepXp;
    return Math.ceil(rawXp / 100) * 100;
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
    const existing = await XPAuditLog.findOne({
      userId,
      action,
      [`details.${entityKey}`]: entityId,
    }).select('_id').lean();
    return Boolean(existing);
  }

  static async recalculateExpFromAudit(userId) {
    const config = await this.getConfig();
    const logs = await XPAuditLog.find({ userId }).select('action amount').lean();

    let total = 0;
    for (const log of logs) {
      const configKey = getConfigKeyForAction(log.action);
      if (configKey && config[configKey] != null) {
        total += config[configKey];
      } else if (log.action === 'MISSION_COMPLETE') {
        total += log.amount || 0;
      } else {
        total += log.amount || 0;
      }
    }
    return total;
  }

  static async recalculateAllUsersFromConfig() {
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

    return { totalUsers: users.length, updatedUsers, changes };
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
      leveledUp,
    });

    return { exp: user.exp, level: user.level, leveledUp };
  }

  static async awardActionXp(userId, action = 'ACTION_TRACKED', details = {}, options = {}) {
    const config = await this.getConfig();
    const amount = this.getXpAmount(config, action);
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

    if (eventType === 'TASK_COMPLETED') {
      const completerId = userId || payload.completerId;
      if (!completerId || !task?._id) return null;

      await this.generateDailyMissions(completerId);
      await this.progressMission(completerId, 'COMPLETE_TASK', 1);

      return this.awardActionXp(completerId, 'COMPLETE_TASK', { taskId: task._id }, {
        entityKey: 'taskId',
        entityId: task._id,
      });
    }

    if (eventType === 'TASK_CREATED') {
      return this.awardActionXp(userId, 'CREATE_TASK', { taskId: task._id }, {
        entityKey: 'taskId',
        entityId: task._id,
      });
    }

    if (eventType === 'PROJECT_CREATED') {
      return this.awardActionXp(userId, 'CREATE_PROJECT', { projectId: project._id }, {
        entityKey: 'projectId',
        entityId: project._id,
      });
    }

    if (eventType === 'ASSET_UPLOADED') {
      return this.awardActionXp(userId, 'ASSET_UPLOAD', { assetId: asset._id }, {
        entityKey: 'assetId',
        entityId: asset._id,
      });
    }

    if (eventType === 'LEAD_CAPTURED') {
      return this.awardActionXp(userId, 'LEAD_CAPTURE', { leadId: lead._id }, {
        entityKey: 'leadId',
        entityId: lead._id,
      });
    }

    if (eventType === 'INVOICE_SUBMITTED') {
      return this.awardActionXp(userId, 'INVOICE_SUBMISSION', { invoiceId: invoice._id }, {
        entityKey: 'invoiceId',
        entityId: invoice._id,
      });
    }

    if (eventType === 'REVIEW_APPROVED') {
      return this.awardActionXp(reviewerId, 'REVIEW_APPROVAL', { taskId: task._id }, {
        entityKey: 'taskId',
        entityId: task._id,
      });
    }

    if (eventType === 'ATTENDANCE_DAY_COMPLETE') {
      const result = await this.awardActionXp(userId, 'ATTENDANCE_ACTION', { date: payload.date }, {
        entityKey: 'date',
        entityId: payload.date,
      });
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
