const Task = require('../models/Task');
const Phase = require('../models/Phase');

/**
 * Calculates weighted progress for a parent entity based on children.
 * Formula: Sum(Progress * Weight) / Sum(Weight)
 */
const calculateRollup = async (projectId, phaseId = null) => {
  try {
    const filter = { projectId };
    if (phaseId) filter.phaseId = phaseId;
    
    const tasks = await Task.find(filter);
    if (tasks.length === 0) return 0;

    const totalProgress = tasks.reduce((acc, task) => acc + (task.progress || 0), 0);
    const averageProgress = Math.round(totalProgress / tasks.length);

    if (phaseId) {
      await Phase.findByIdAndUpdate(phaseId, { progress: averageProgress });
    }
    
    return averageProgress;
  } catch (err) {
    console.error('Rollup calculation error:', err);
    return 0;
  }
};

module.exports = { calculateRollup };
