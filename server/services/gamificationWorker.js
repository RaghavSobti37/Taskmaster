const eventDispatcher = require('./eventDispatcher');
const GamificationService = require('./gamificationService');
const Project = require('../models/Project');
const Task = require('../models/Task');

// Simple in-memory rate limiter for anti-farming
const rateLimitCache = new Map();

const checkRateLimit = (userId) => {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxActions = 50;

  if (!rateLimitCache.has(userId)) {
    rateLimitCache.set(userId, { count: 1, resetTime: now + windowMs });
    return true; // Allowed
  }

  const record = rateLimitCache.get(userId);
  if (now > record.resetTime) {
    // Reset window
    rateLimitCache.set(userId, { count: 1, resetTime: now + windowMs });
    return true; // Allowed
  }

  if (record.count >= maxActions) {
    return false; // Rate limited
  }

  record.count += 1;
  return true; // Allowed
};

const initializeWorker = () => {
  console.log('[GAMIFICATION WORKER] Initializing Event Subscribers...');

  eventDispatcher.on('TASK_COMPLETED', async ({ userId, tenantId, task }) => {
    try {
      if (!checkRateLimit(userId)) {
        console.warn(`[ANTI-FARMING] User ${userId} exceeded task completion rate limit.`);
        return;
      }

      if (!task.title || task.title.trim().length < 2) {
        console.log(`[ANTI-FARMING] Task ${task._id} lacks sufficient title. No XP awarded.`);
        return;
      }

      const { queueGamificationEvent } = require('./backgroundQueue');
      
      await queueGamificationEvent('TASK_COMPLETED', {
        userId,
        tenantId,
        task
      });

    } catch (error) {
      console.error('[GAMIFICATION WORKER] Error enqueueing TASK_COMPLETED:', error);
    }
  });

  eventDispatcher.on('PROJECT_CLOSED', async ({ userId, tenantId, projectId }) => {
    try {
      const project = await Project.findById(projectId).setOptions({ tenantId });
      if (!project) return;

      console.log(`[GAMIFICATION WORKER] Processing PROJECT_CLOSED for ${projectId}`);

      // 1. Mark all pending tasks in project as complete
      await Task.updateMany(
        { projectId: projectId, status: { $ne: 'done' } },
        { $set: { status: 'done', completedAt: new Date() } }
      ).setOptions({ tenantId });

      // 2. Fetch all team members and batch award XP (Project Bonus)
      const PROJECT_BONUS = 500;
      const members = project.members || [];
      if (project.owner) members.push(project.owner);

      const uniqueMembers = [...new Set(members.map(m => m.toString()))];

      for (const uid of uniqueMembers) {
        await GamificationService.awardExp(uid, tenantId, PROJECT_BONUS);
      }
      console.log(`[GAMIFICATION WORKER] Awarded ${PROJECT_BONUS} XP to ${uniqueMembers.length} members for Project ${projectId}`);

    } catch (error) {
      console.error('[GAMIFICATION WORKER] Error processing PROJECT_CLOSED:', error);
    }
  });
};

module.exports = { initializeWorker };
