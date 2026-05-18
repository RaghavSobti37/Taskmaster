const Task = require('../models/Task');
const Phase = require('../models/Phase');

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
    console.error('Rollup calculation error:', err);
    return 0;
  }
};

module.exports = { calculateRollup };
