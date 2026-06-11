const Project = require('../models/Project');
const projectGoalsService = require('../services/projectGoalsService');
const { canAccessProject } = require('../../../utils/projectAccess');
const { getProjectRoleForUser } = require('../../../../shared/projectRoles');
const { isAdminUser } = require('../../../utils/departmentPermissions');

async function loadProjectWithAccess(req, projectId) {
  const project = await Project.findById(projectId);
  if (!project) {
    const err = new Error('Project not found');
    err.status = 404;
    throw err;
  }
  if (!canAccessProject(req.user, project)) {
    const err = new Error('Not authorized');
    err.status = 403;
    throw err;
  }
  return project;
}

async function canManageGoals(req, project) {
  if (isAdminUser(req.user)) return true;
  const role = getProjectRoleForUser(project, req.user._id);
  return role === 'admin' || role === 'manager';
}

exports.getProjectGoals = async (req, res) => {
  try {
    await loadProjectWithAccess(req, req.params.id);
    const data = await projectGoalsService.getGoalProgress(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

exports.updateProjectGoals = async (req, res) => {
  try {
    const project = await loadProjectWithAccess(req, req.params.id);
    const allowed = await canManageGoals(req, project);
    if (!allowed) return res.status(403).json({ error: 'Not authorized to update project goals' });
    const data = await projectGoalsService.updateGoal(req.params.id, req.body, req.user._id);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

exports.getProjectGoalsWeekly = async (req, res) => {
  try {
    await loadProjectWithAccess(req, req.params.id);
    const data = await projectGoalsService.getGoalProgress(req.params.id);
    res.json({ history: data.history, weekly: data.weekly });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};
