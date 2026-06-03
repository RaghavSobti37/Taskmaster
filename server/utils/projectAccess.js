const Project = require('../models/Project');
const Workspace = require('../models/Workspace');
const { isAdminUser } = require('./departmentPermissions');

const normalizeWorkspaceName = (name) => String(name || '').toUpperCase().trim();

const memberIdStr = (value) => (value?._id || value)?.toString?.() || '';

const canAccessProject = (user, project) => {
  if (!user || !project) return false;
  if (isAdminUser(user)) return true;
  const uid = user._id.toString();
  if (project.owner?.toString?.() === uid || project.owner?.toString() === uid) return true;
  return (project.members || []).some((m) => m.toString() === uid);
};

const getAccessibleProjectsFilter = (user) => {
  if (isAdminUser(user)) return {};
  return {
    $or: [{ owner: user._id }, { members: user._id }],
  };
};

async function userCanAccessWorkspace(user, workspaceOrName) {
  if (!user) return false;
  if (isAdminUser(user)) return true;

  let workspace = workspaceOrName;
  const needsLoad =
    typeof workspaceOrName === 'string'
    || !workspaceOrName
    || workspaceOrName.createdBy === undefined;

  if (needsLoad) {
    const name = normalizeWorkspaceName(
      typeof workspaceOrName === 'string' ? workspaceOrName : workspaceOrName?.name
    );
    if (!name) return false;
    workspace = await Workspace.findOne({ name })
      .select('name createdBy defaultMembers')
      .lean();
  }

  if (!workspace) return false;

  const uid = user._id.toString();
  if (workspace.createdBy?.toString() === uid) return true;
  if ((workspace.defaultMembers || []).some((d) => memberIdStr(d.user) === uid)) return true;

  const count = await Project.countDocuments({
    workspace: normalizeWorkspaceName(workspace.name),
    $or: [{ owner: user._id }, { members: user._id }],
  });
  return count > 0;
}

async function filterWorkspacesForUser(user, workspaces) {
  if (isAdminUser(user)) return workspaces;
  const filtered = [];
  for (const ws of workspaces) {
    if (await userCanAccessWorkspace(user, ws)) filtered.push(ws);
  }
  return filtered;
}

module.exports = {
  canAccessProject,
  getAccessibleProjectsFilter,
  userCanAccessWorkspace,
  filterWorkspacesForUser,
  memberIdStr,
  normalizeWorkspaceName,
};
