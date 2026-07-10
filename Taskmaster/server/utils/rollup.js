const Task = require('../models/Task');
const Phase = require('../models/Phase');
const logger = require('../utils/logger');

const rollupTimers = new Map();
const ROLLUP_DEBOUNCE_MS = 500;

/**
 * Calculates weighted progress for a parent entity based on children.
 * Formula: Sum(Progress * Weight) / Sum(Weight)
 * @param {string} projectId - The associated project ID
 * @param {string} [phaseId=null] - The optional phase ID
 * @param {Object} [session=null] - Optional Mongoose transaction session
 * @returns {Promise<number>} Calculated average progress percentage
 */
const calculateRollup = async (projectId, phaseId = null, session = null) => {
  try {
    const filter = { projectId };
    if (phaseId) filter.phaseId = phaseId;
    
    const queryOpts = session ? { session } : {};
    const tasks = await Task.find(filter, null, queryOpts).select('progress');
    if (tasks.length === 0) return 0;

    const totalProgress = tasks.reduce((acc, task) => acc + (task.progress || 0), 0);
    const averageProgress = Math.round(totalProgress / tasks.length);

    if (phaseId) {
      await Phase.findByIdAndUpdate(phaseId, { progress: averageProgress }, queryOpts);
    }
    
    // Update project progress
    if (projectId) {
      const Project = require('../models/Project');
      await Project.findByIdAndUpdate(projectId, { progress: averageProgress }, queryOpts);
    }
    
    return averageProgress;
  } catch (err) {
    logger.error('rollup', 'Rollup calculation ', { error: err.message || err });
    return 0;
  }
};

const scheduleRollup = (projectId, phaseId = null, session = null) => {
  if (session) return calculateRollup(projectId, phaseId, session);

  const key = `${projectId}:${phaseId || ''}`;
  if (rollupTimers.has(key)) clearTimeout(rollupTimers.get(key));
  rollupTimers.set(
    key,
    setTimeout(() => {
      rollupTimers.delete(key);
      calculateRollup(projectId, phaseId, null).catch(() => {});
    }, ROLLUP_DEBOUNCE_MS)
  );
  return Promise.resolve();
};

module.exports = { calculateRollup, scheduleRollup };
