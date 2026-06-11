const Project = require('../models/Project');
const ProjectKRA = require('../models/ProjectKRA');
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

function canManageKra(req, project) {
  if (isAdminUser(req.user)) return true;
  const role = getProjectRoleForUser(project, req.user._id);
  return role === 'admin' || role === 'manager';
}

exports.getProjectKra = async (req, res) => {
  try {
    const project = await loadProjectWithAccess(req, req.params.id);
    const isManager = canManageKra(req, project);
    const selfId = req.user._id.toString();

    const filter = { projectId: project._id };
    if (!isManager) {
      filter.userId = req.user._id;
    }

    const rows = await ProjectKRA.find(filter)
      .populate('userId', 'name email avatar')
      .populate('assignedBy', 'name')
      .lean();

    res.json(rows);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

exports.getMyProjectKra = async (req, res) => {
  try {
    await loadProjectWithAccess(req, req.params.id);
    const row = await ProjectKRA.findOne({
      projectId: req.params.id,
      userId: req.user._id,
    }).lean();
    res.json(row || { closed: '', moved: '' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

exports.upsertProjectKra = async (req, res) => {
  try {
    const project = await loadProjectWithAccess(req, req.params.id);
    if (!canManageKra(req, project)) {
      return res.status(403).json({ error: 'Not authorized to assign KRA' });
    }

    const { userId } = req.params;
    const { closed = '', moved = '' } = req.body || {};

    const isMember = (project.members || []).some((m) => m.toString() === userId)
      || project.owner?.toString() === userId;
    if (!isMember) {
      return res.status(400).json({ error: 'User is not a project member' });
    }

    const row = await ProjectKRA.findOneAndUpdate(
      { projectId: project._id, userId },
      {
        closed: String(closed),
        moved: String(moved),
        assignedBy: req.user._id,
      },
      { upsert: true, new: true }
    )
      .populate('userId', 'name email avatar')
      .populate('assignedBy', 'name');

    res.json(row);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};
