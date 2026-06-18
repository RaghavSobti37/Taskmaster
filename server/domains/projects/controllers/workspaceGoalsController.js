const Workspace = require('../../../models/Workspace');
const workspaceGoalsService = require('../services/workspaceGoalsService');
const { userCanAccessWorkspace } = require('../../../utils/projectAccess');
const { isAdminUser } = require('../../../utils/departmentPermissions');

async function loadWorkspaceWithAccess(req, workspaceName) {
  const normalized = decodeURIComponent(workspaceName || '').toUpperCase().trim();
  if (!normalized) {
    const err = new Error('Workspace name is required');
    err.status = 400;
    throw err;
  }
  const workspace = await Workspace.findOne({ name: normalized }).lean();
  if (!workspace) {
    const err = new Error('Workspace not found');
    err.status = 404;
    throw err;
  }
  if (!(await userCanAccessWorkspace(req.user, workspace))) {
    const err = new Error('Not authorized');
    err.status = 403;
    throw err;
  }
  return workspace;
}

exports.getWorkspaceGoals = async (req, res) => {
  try {
    await loadWorkspaceWithAccess(req, req.params.name);
    const data = await workspaceGoalsService.getWorkspaceGoalProgress(req.params.name);
    res.json({ ...data, canEdit: isAdminUser(req.user) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

exports.updateWorkspaceGoals = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ error: 'Admin access required to update workspace goals' });
    }
    await loadWorkspaceWithAccess(req, req.params.name);
    const data = await workspaceGoalsService.updateWorkspaceGoal(
      req.params.name,
      req.body,
      req.user._id,
    );
    res.json({ ...data, canEdit: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};
