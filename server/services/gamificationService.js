const User = require('../models/User');
const DailyMission = require('../models/DailyMission');

/**
 * Gamification Service
 * Handles EXP gains, Level Ups, and Daily Mission tracking.
 */
class GamificationService {
  /**
   * Calculate level based on EXP.
   * Curve: Level = floor(sqrt(EXP / 100)) + 1
   * e.g., 0 exp = lvl 1. 100 exp = lvl 2. 400 exp = lvl 3.
   */
  static calculateLevel(exp) {
    return Math.floor(Math.sqrt(exp / 100)) + 1;
  }

  static async awardExp(userId, tenantId, amount, options = {}) {
    let session = options.session;
    let createdSession = false;
    const mongoose = require('mongoose');
    const XPAuditLog = require('../models/XPAuditLog');

    try {
      if (!amount || Number(amount) <= 0) {
        return null;
      }

      if (!session) {
        session = await mongoose.startSession();
        session.startTransaction();
        createdSession = true;
      }

      const user = await User.findOne({ _id: userId }).session(session).setOptions({ tenantId });
      if (!user) {
        if (createdSession) {
          await session.abortTransaction();
          session.endSession();
        }
        return null;
      }

      user.exp = Number(user.exp) || 0;
      user.level = Number(user.level) || 1;

      const oldLevel = user.level;
      user.exp += Number(amount);
      user.level = this.calculateLevel(user.exp);

      await user.save({ session });

      if (user.level > oldLevel) {
        console.log(`User ${userId} leveled up to Level ${user.level}!`);
      }

      // Audit Log
      const auditLog = new XPAuditLog({
        userId,
        tenantId,
        actionType: options.actionType || 'UNKNOWN_XP_GAIN',
        amount: Number(amount),
        taskId: options.taskId || null,
        projectId: options.projectId || null,
        description: options.description || `Awarded ${amount} XP`
      });
      await auditLog.save({ session });

      if (createdSession) {
        await session.commitTransaction();
        session.endSession();
        session = null;
      }

      return { exp: user.exp, level: user.level, leveledUp: user.level > oldLevel };
    } catch (error) {
      if (createdSession && session) {
        try { await session.abortTransaction(); } catch (e) {}
        try { session.endSession(); } catch (e) {}
      }
      console.error('Gamification Service Error [awardExp]:', error);
      return null;
    }
  }

  /**
   * Progress a daily mission (e.g. COMPLETE_TASK)
   */
  static async progressMission(userId, tenantId, type, amount = 1) {
    try {
      const dateString = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      
      let mission = await DailyMission.findOne({ 
        userId, 
        type, 
        date: dateString 
      }).setOptions({ tenantId });

      if (!mission) {
        // Ensure missions exist for today before progressing
        await this.generateDailyMissions(userId, tenantId);
        mission = await DailyMission.findOne({ userId, type, date: dateString }).setOptions({ tenantId });
      }

      if (!mission) return null;
      if (mission.completed) return { mission, completed: true };

      mission.currentCount += amount;

      if (mission.currentCount >= mission.targetCount) {
        mission.currentCount = mission.targetCount;
        mission.completed = true;
        await mission.save();

        await this.awardExp(userId, tenantId, mission.expReward);
        return { mission, completed: true };
      }

      await mission.save();
      return { mission, completed: false };
    } catch (error) {
      console.error('Gamification Service Error [progressMission]:', error);
      return null;
    }
  }

  /**
   * Generate daily missions for a user (called via Cron or on login)
   */
  static async generateDailyMissions(userId, tenantId) {
    try {
      const dateString = new Date().toISOString().split('T')[0];

      // Check if missions already exist for today
      const existing = await DailyMission.countDocuments({ userId, date: dateString }).setOptions({ tenantId });
      if (existing > 0) return;

      const user = await User.findById(userId).setOptions({ tenantId });
      const role = user?.role || 'user';

      const roleMissionPools = {
        sales: [
          { title: 'Close 1 Lead', type: 'CLOSE_LEAD', targetCount: 1, expReward: 100 },
          { title: 'Update 3 Leads', type: 'UPDATE_LEAD', targetCount: 3, expReward: 60 },
          { title: 'Create 2 Follow-ups', type: 'CREATE_FOLLOWUP', targetCount: 2, expReward: 50 },
          { title: 'Log 2 Hours of Work', type: 'LOG_WORK', targetCount: 120, expReward: 75 }
        ],
        artist_management: [
          { title: 'Update 1 Artist Profile', type: 'UPDATE_ARTIST', targetCount: 1, expReward: 80 },
          { title: 'Create 1 Campaign', type: 'CREATE_CAMPAIGN', targetCount: 1, expReward: 100 },
          { title: 'Complete 3 Tasks', type: 'COMPLETE_TASK', targetCount: 3, expReward: 50 },
          { title: 'Log Daily Activity', type: 'DAILY_LOG', targetCount: 1, expReward: 30 }
        ],
        admin: [
          { title: 'Review Admin Logs', type: 'REVIEW_LOGS', targetCount: 1, expReward: 40 },
          { title: 'Create a New Project', type: 'CREATE_PROJECT', targetCount: 1, expReward: 50 },
          { title: 'Complete 2 Tasks', type: 'COMPLETE_TASK', targetCount: 2, expReward: 40 },
          { title: 'Update System Config', type: 'UPDATE_CONFIG', targetCount: 1, expReward: 100 }
        ],
        user: [
          { title: 'Complete 3 Tasks', type: 'COMPLETE_TASK', targetCount: 3, expReward: 50 },
          { title: 'Complete 5 Tasks', type: 'COMPLETE_TASK', targetCount: 5, expReward: 100 },
          { title: 'Log 2 Hours of Work', type: 'LOG_WORK', targetCount: 120, expReward: 75 },
          { title: 'Create 2 Tasks', type: 'CREATE_TASK', targetCount: 2, expReward: 40 },
          { title: 'Log Daily Activity', type: 'DAILY_LOG', targetCount: 1, expReward: 30 }
        ]
      };

      const basePool = roleMissionPools[role] || roleMissionPools['user'];
      const generalPool = [
        { title: 'Log Daily Activity', type: 'DAILY_LOG', targetCount: 1, expReward: 30 },
        { title: 'Complete 1 Task', type: 'COMPLETE_TASK', targetCount: 1, expReward: 20 },
      ];

      const combinedPool = [...basePool, ...generalPool];

      // Deduplicate by mission type and choose highest reward for duplicates
      const uniqueByType = new Map();
      for (const item of combinedPool) {
        if (!uniqueByType.has(item.type) || item.expReward > uniqueByType.get(item.type).expReward) {
          uniqueByType.set(item.type, item);
        }
      }

      const uniqueMissions = Array.from(uniqueByType.values());
      const shuffled = uniqueMissions.sort(() => 0.5 - Math.random());
      const selectedMissions = shuffled.slice(0, 3);

      const missionsToCreate = selectedMissions.map(m => ({
        ...m,
        userId,
        date: dateString
      }));

      for (const m of missionsToCreate) {
        const mission = new DailyMission(m);
        // Bypassing tenantPlugin automatic injection if using save, so we inject manually
        mission.tenantId = tenantId; 
        await mission.save();
      }
    } catch (error) {
      console.error('Gamification Service Error [generateDailyMissions]:', error);
    }
  }
}

module.exports = GamificationService;
