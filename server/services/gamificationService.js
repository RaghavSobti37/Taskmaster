const User = require('../models/User');
const DailyMission = require('../models/DailyMission');
const XPAuditLog = require('../models/XPAuditLog');

const BASE_XP = 100;
const EXPONENT = 1.5;

class GamificationService {
  static getLevelFromExp(exp) {
    let level = 1;
    while (exp >= Math.floor(BASE_XP * Math.pow(level, EXPONENT))) {
      level++;
    }
    return level;
  }

  static getExpForLevel(level) {
    if (level <= 1) return 0;
    return Math.floor(BASE_XP * Math.pow(level - 1, EXPONENT));
  }

  static async awardExp(userId, amount, action, details = {}) {
    const user = await User.findById(userId);
    if (!user) return;

    user.exp = (user.exp || 0) + amount;
    const newLevel = this.getLevelFromExp(user.exp);
    
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
      details
    });

    const { broadcastRealtimeEvent } = require('../config/supabase');
    await broadcastRealtimeEvent(`user-${userId}`, 'xp_awarded', {
      amount,
      action,
      newTotal: user.exp,
      leveledUp
    });

    return { exp: user.exp, level: user.level, leveledUp };
  }

  static async generateDailyMissions(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await DailyMission.countDocuments({
      userId,
      date: { $gte: today }
    });

    if (existing > 0) return;

    const missions = [
      {
        userId,
        title: 'Task Conqueror',
        description: 'Complete 3 tasks today',
        targetCount: 3,
        expReward: 50,
        actionType: 'COMPLETE_TASK',
        date: today
      },
      {
        userId,
        title: 'Project Contributor',
        description: 'Update or create a project asset',
        targetCount: 1,
        expReward: 30,
        actionType: 'ASSET_ACTIVITY',
        date: today
      }
    ];

    await DailyMission.insertMany(missions);
  }

  static async progressMission(userId, actionType, count = 1) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const missions = await DailyMission.find({
      userId,
      actionType,
      completed: false,
      date: { $gte: today }
    });

    for (const mission of missions) {
      mission.currentCount += count;
      if (mission.currentCount >= mission.targetCount) {
        mission.completed = true;
        await this.awardExp(userId, mission.expReward, 'MISSION_COMPLETE', { missionId: mission._id, title: mission.title });
      }
      await mission.save();
    }
  }
}

module.exports = GamificationService;
