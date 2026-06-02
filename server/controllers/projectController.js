const Project = require('../models/Project');
const Workspace = require('../models/Workspace');
const WorkspacePreference = require('../models/WorkspacePreference');
const User = require('../models/User');
const logger = require('../utils/logger');
const { formatProjectName } = require('../utils/formatProjectName');
const { broadcastRealtimeEvent } = require('../config/realtime');
const { isAdminUser } = require('../utils/departmentPermissions');
const { normalizeStoredProjectRole } = require('../../shared/projectRoles');
const { parseTimeSpentToHours } = require('../../shared/timeSpent');

const DEFAULT_WORKSPACES = [
  { name: 'TSC ACADEMY', color: '#3498db' },
  { name: 'TSC ARTISTS', color: '#9b59b6' },
  { name: 'TSC FILMS', color: '#e74c3c' },
  { name: 'TSC TECH', color: '#2ecc71' },
  { name: 'GENERAL', color: '#64748b' },
];

const normalizeWorkspaceName = (name) => String(name || '').toUpperCase().trim();

const HEX_COLOR_RE = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/;

const normalizeHexColor = (value) => {
  const raw = String(value ?? '').trim();
  if (!HEX_COLOR_RE.test(raw)) return null;
  if (raw.length === 4) {
    const [, r, g, b] = raw;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return raw.toLowerCase();
};

/** Default tenant order, then name */
const sortWorkspacesGlobal = (workspaces) =>
  [...workspaces].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name)
  );

/** Per-user order with fallback for workspaces missing from saved prefs */
const sortWorkspacesForUser = (workspaces, userOrder) => {
  const list = [...workspaces];
  if (!Array.isArray(userOrder) || userOrder.length === 0) {
    return sortWorkspacesGlobal(list);
  }

  const byName = new Map(list.map((w) => [normalizeWorkspaceName(w.name), w]));
  const result = [];
  const seen = new Set();

  for (const raw of userOrder) {
    const name = normalizeWorkspaceName(raw);
    if (!name || seen.has(name)) continue;
    const ws = byName.get(name);
    if (ws) {
      result.push(ws);
      seen.add(name);
    }
  }

  const remainder = list
    .filter((w) => !seen.has(normalizeWorkspaceName(w.name)))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));

  return [...result, ...remainder].map((w, idx) => ({ ...w, order: idx }));
};

async function getSortedWorkspacesForUser(userId) {
  let workspaces = await Workspace.find().lean();
  if (workspaces.length === 0) {
    await Workspace.insertMany(
      DEFAULT_WORKSPACES.map((w, idx) => ({
        name: w.name,
        color: w.color,
        order: idx,
        createdBy: userId,
      }))
    );
    workspaces = await Workspace.find().lean();
  }

  const pref = await WorkspacePreference.findOne({ userId }).lean();
  return sortWorkspacesForUser(workspaces, pref?.order);
}

// 20 perceptually-spaced hues converted to saturated hex colors
const PALETTE = [
  '#e74c3c','#e67e22','#f1c40f','#2ecc71','#1abc9c',
  '#3498db','#9b59b6','#e91e63','#ff5722','#8bc34a',
  '#00bcd4','#673ab7','#ff9800','#4caf50','#03a9f4',
  '#ff4081','#7c4dff','#64dd17','#ffab00','#00e5ff',
];

const VALID_PROJECT_ROLES = ['admin', 'manager', 'member'];

const memberIdStr = (value) => (value?._id || value)?.toString?.() || '';

function mergeMemberEntry(members, memberRoles, userId, role) {
  const uid = memberIdStr(userId);
  if (!uid) return;
  const normalizedRole = normalizeStoredProjectRole(role);
  if (!members.some((m) => memberIdStr(m) === uid)) {
    members.push(userId);
    memberRoles.push({ user: userId, role: normalizedRole });
    return;
  }
  const idx = memberRoles.findIndex((r) => memberIdStr(r.user) === uid);
  if (idx >= 0) memberRoles[idx].role = normalizedRole;
  else memberRoles.push({ user: userId, role: normalizedRole });
}

async function syncWorkspaceDefaultsToProjects(workspaceName, defaultMembers, previousDefaults = []) {
  const projects = await Project.find({ workspace: workspaceName.toUpperCase() });
  const newMap = new Map(
    (defaultMembers || []).map((d) => [memberIdStr(d.user), normalizeStoredProjectRole(d.role)])
  );
  const prevMap = new Map(
    (previousDefaults || []).map((d) => [memberIdStr(d.user), normalizeStoredProjectRole(d.role)])
  );

  for (const project of projects) {
    let changed = false;
    const ownerId = memberIdStr(project.owner);

    for (const [userId, role] of newMap) {
      if (userId === ownerId) continue;
      const wasMember = project.members.some((m) => memberIdStr(m) === userId);
      const roleEntry = (project.memberRoles || []).find((r) => memberIdStr(r.user) === userId);
      const hadRole = roleEntry ? normalizeStoredProjectRole(roleEntry.role) : null;
      mergeMemberEntry(project.members, project.memberRoles || [], userId, role);
      if (!wasMember || hadRole !== role) changed = true;
    }

    for (const userId of prevMap.keys()) {
      if (newMap.has(userId) || userId === ownerId) continue;
      const beforeLen = project.members.length;
      project.members = project.members.filter((m) => memberIdStr(m) !== userId);
      project.memberRoles = (project.memberRoles || []).filter((r) => memberIdStr(r.user) !== userId);
      if (project.members.length !== beforeLen) changed = true;
    }

    if (changed) {
      await project.save();
      broadcastRealtimeEvent('projects', 'project_change', { projectId: project._id, action: 'update' });
    }
  }
}

async function pickDistinctColor() {
  try {
    const existing = await Project.find({}, 'color').lean();
    const usedColors = new Set(existing.map(p => p.color?.toLowerCase()).filter(Boolean));
    const available = PALETTE.filter(c => !usedColors.has(c.toLowerCase()));
    const pool = available.length > 0 ? available : PALETTE;
    return pool[Math.floor(Math.random() * pool.length)];
  } catch {
    return PALETTE[Math.floor(Math.random() * PALETTE.length)];
  }
}

exports.createProject = async (req, res) => {
  try {
    const { name, description, tags, members, color, starred, workspace } = req.body;
    const workspaceName = workspace ? workspace.toUpperCase().trim() : 'GENERAL';

    const providedMembers = [];
    const providedRoles = [];

    (members || []).forEach((m) => {
      if (!m?.userId) return;
      mergeMemberEntry(providedMembers, providedRoles, m.userId, m.role || 'member');
    });

    const ws = await Workspace.findOne({ name: workspaceName }).lean();
    (ws?.defaultMembers || []).forEach((entry) => {
      mergeMemberEntry(providedMembers, providedRoles, entry.user, entry.role || 'member');
    });

    // Ensure owner is always in members and roles
    if (!providedMembers.some((m) => memberIdStr(m) === req.user._id.toString())) {
      mergeMemberEntry(providedMembers, providedRoles, req.user._id, 'admin');
    }

    // Ensure redacted-staff@example.com is automatically added to all new projects
    const deepank = await User.findOne({ email: 'redacted-staff@example.com' });
    if (deepank) {
      const deepankIdStr = deepank._id.toString();
      if (!providedMembers.some((m) => memberIdStr(m) === deepankIdStr)) {
        mergeMemberEntry(providedMembers, providedRoles, deepank._id, 'artist_management');
      }
    }

    const assignedColor = color || '#64748b';

    const project = await Project.create({
      name: formatProjectName(name),
      description,
      tags,
      color: assignedColor,
      workspace: workspaceName,
      starred: starred || false,
      outletId: req.user.currentOutletId || 'main',
      owner: req.user._id,
      members: providedMembers,
      memberRoles: providedRoles
    });

    const { queueGamificationEvent } = require('../services/backgroundQueue');
    queueGamificationEvent('PROJECT_CREATED', {
      userId: req.user._id,
      project
    });

    broadcastRealtimeEvent('projects', 'project_change', { projectId: project._id, action: 'create' });
    res.status(201).json(project);
  } catch (error) {
    logger.error('projectController', 'Create Project ', { error: error.message || error });
    res.status(500).json({ error: 'Failed to create project' });
  }
};

exports.getProjects = async (req, res) => {
  try {
    const filter = isAdminUser(req.user) ? {} : {
      $or: [
        { owner: req.user._id },
        { members: req.user._id }
      ]
    };
    const projects = await Project.find(filter)
    .populate('members', 'name avatar teams')
    .sort({ createdAt: -1 })
    .lean();

    const Task = require('../models/Task');
    
    // Aggregation for counts is faster than individual countDocuments calls
    const taskCounts = await Task.aggregate([
      { $match: { projectId: { $in: projects.map(p => p._id) } } },
      { $group: {
        _id: '$projectId',
        total: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } }
      }}
    ]);

    const countMap = taskCounts.reduce((acc, curr) => {
      acc[curr._id.toString()] = curr;
      return acc;
    }, {});

    const projectsWithProgress = projects.map((project) => {
      const counts = countMap[project._id.toString()] || { total: 0, completed: 0 };
      const progress = counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0;
      return { 
        ...project, 
        progress, 
        totalTasks: counts.total, 
        completedTasks: counts.completed 
      };
    });

    // Background backfill: assign distinct colors to projects still using the default blue
    const defaultBlue = '#3b82f6';
    const needsColor = projects.filter(p => !p.color || p.color.toLowerCase() === defaultBlue);
    if (needsColor.length > 0) {
      const usedColors = new Set(projects.filter(p => p.color && p.color.toLowerCase() !== defaultBlue).map(p => p.color.toLowerCase()));
      let palettePool = [...PALETTE];
      (async () => {
        for (const proj of needsColor) {
          const available = palettePool.filter(c => !usedColors.has(c.toLowerCase()));
          const chosen = available.length > 0 ? available[Math.floor(Math.random() * available.length)] : palettePool[Math.floor(Math.random() * palettePool.length)];
          usedColors.add(chosen.toLowerCase());
          await Project.findByIdAndUpdate(proj._id, { color: chosen });
        }
      })().catch(() => {});
    }

    res.json(projectsWithProgress);
  } catch (error) {
    logger.error('projectController', 'Get Projects ', { error: error.message || error });
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
};

exports.getProjectById = async (req, res) => {
  try {
    const Phase = require('../models/Phase');
    const Task = require('../models/Task');
    const Asset = require('../models/Asset');

    const projectId = req.params.id;

    // Fetch everything in parallel
    const [project, phases, tasks, assets] = await Promise.all([
      Project.findById(projectId)
        .populate('owner', 'name email avatar teams')
        .populate('members', 'name email avatar teams online lastOnline')
        .populate('memberRoles.user', 'name email avatar')
        .lean(),
      Phase.find({ projectId }).sort({ order: 1 }).lean(),
      Task.find({ projectId }).lean(),
      Asset.find({ projectId }).sort({ createdAt: -1 }).lean()
    ]);
    
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    res.json({
      ...project,
      phases,
      tasks,
      assets
    });
  } catch (error) {
    logger.error('projectController', 'Get Project Detail ', { error: error.message || error });
    res.status(500).json({ error: 'Failed to fetch project details' });
  }
};

exports.updateProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const isOwner = project.owner.toString() === req.user._id.toString();
    const isAdmin = isAdminUser(req.user);
    const isMember = project.members.some((m) => m.toString() === req.user._id.toString());
    const canFullUpdate = isAdmin || isOwner;

    if (!canFullUpdate) {
      if (!isMember) {
        return res.status(403).json({ error: 'Not authorized to update this project' });
      }
      if (req.body.workspace === undefined) {
        return res.status(403).json({ error: 'Not authorized to update this project' });
      }
      const updated = await Project.findByIdAndUpdate(
        req.params.id,
        { workspace: req.body.workspace.toUpperCase().trim() },
        { new: true, runValidators: true }
      );
      broadcastRealtimeEvent('projects', 'project_change', { projectId: updated._id, action: 'update' });
      return res.json(updated);
    }

    // SECURITY: Whitelist allowed update fields (prevent owner/member injection)
    const allowedFields = ['name', 'description', 'tags', 'members', 'memberRoles', 'status', 'color', 'starred', 'workspace'];
    const sanitizedUpdate = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        sanitizedUpdate[key] = key === 'workspace'
          ? req.body[key].toUpperCase().trim()
          : key === 'name'
            ? formatProjectName(req.body[key])
            : req.body[key];
      }
    }

    const updated = await Project.findByIdAndUpdate(req.params.id, sanitizedUpdate, { new: true, runValidators: true });

    // Handle Event Dispatch for Gamification
    if (sanitizedUpdate.status === 'completed' && project.status !== 'completed') {
      const eventDispatcher = require('../services/eventDispatcher');
      const tenantId = req.tenantId || project.tenantId;
      eventDispatcher.emit('PROJECT_CLOSED', {
        userId: req.user._id,
        tenantId,
        projectId: project._id
      });
    } else if (sanitizedUpdate.status === 'archived' && project.status !== 'archived') {
      const eventDispatcher = require('../services/eventDispatcher');
      const tenantId = req.tenantId || project.tenantId;
      eventDispatcher.emit('PROJECT_ARCHIVED', {
        userId: req.user._id,
        tenantId,
        projectId: project._id
      });
    }

    broadcastRealtimeEvent('projects', 'project_change', { projectId: updated._id, action: 'update' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update project' });
  }
};

exports.deleteProject = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ error: 'ADMIN CLEARANCE REQUIRED' });
    }

    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    await Project.findByIdAndDelete(req.params.id);

    // Log the purge
    const CRMAudit = require('../models/CRMAudit');
    await CRMAudit.create({
      userId: req.user._id,
      userRole: req.user.departmentId?.slug || null,
      action: 'PROJECT_DELETE',
      fieldChanged: 'project',
      oldValue: project.name,
      newValue: 'PURGED',
      notes: `Project ${project.name} decommissioned by root administrator.`
    });

    broadcastRealtimeEvent('projects', 'project_change', { projectId: req.params.id, action: 'delete' });
    res.json({ message: 'Project successfully purged from system deck.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete project' });
  }
};

exports.removeMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Only admin or project owner can remove members
    if (!isAdminUser(req.user) && project.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to remove members' });
    }

    // Cannot remove the owner
    if (project.owner.toString() === userId) {
      return res.status(400).json({ error: 'Cannot remove the project owner' });
    }

    project.members = project.members.filter(m => m.toString() !== userId);
    project.memberRoles = (project.memberRoles || []).filter(r => {
      const rUserId = r.user?._id ? r.user._id.toString() : r.user?.toString();
      return rUserId !== userId;
    });

    await project.save();

    const updatedProject = await Project.findById(id)
      .populate('owner', 'name email avatar teams')
      .populate('members', 'name email avatar teams online lastOnline')
      .populate('memberRoles.user', 'name email avatar');

    broadcastRealtimeEvent('projects', 'project_change', { projectId: id, action: 'update' });
    res.json(updatedProject);
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove member' });
  }
};
exports.getWorkspaces = async (req, res) => {
  try {
    const workspaces = await getSortedWorkspacesForUser(req.user._id);
    res.json(workspaces);
  } catch (error) {
    logger.error('projectController', 'Get Workspaces ', { error: error.message || error });
    res.status(500).json({ error: 'Failed to fetch workspaces' });
  }
};

exports.createWorkspace = async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Workspace name is required' });
    }

    const normalizedColor = color ? normalizeHexColor(color) : null;
    if (color && !normalizedColor) {
      return res.status(400).json({ error: 'Invalid workspace color. Use a hex value like #3498db.' });
    }

    const workspace = await Workspace.create({
      name: name.toUpperCase().trim(),
      color: normalizedColor || '#64748b',
      createdBy: req.user._id,
    });

    res.status(201).json(workspace);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Workspace already exists' });
    }
    logger.error('projectController', 'Create Workspace ', { error: error.message || error });
    res.status(500).json({ error: 'Failed to create workspace' });
  }
};

exports.reorderWorkspaces = async (req, res) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) {
      return res.status(400).json({ error: 'Order must be an array of workspace names' });
    }

    const normalizedOrder = order
      .map((name) => normalizeWorkspaceName(name))
      .filter(Boolean);

    const existing = await Workspace.find().select('name').lean();
    const validNames = new Set(existing.map((w) => normalizeWorkspaceName(w.name)));
    const savedOrder = normalizedOrder.filter((name) => validNames.has(name));

    for (const name of existing.map((w) => normalizeWorkspaceName(w.name))) {
      if (!savedOrder.includes(name)) savedOrder.push(name);
    }

    await WorkspacePreference.findOneAndUpdate(
      { userId: req.user._id },
      { order: savedOrder, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    const workspaces = await getSortedWorkspacesForUser(req.user._id);
    res.json(workspaces);
  } catch (error) {
    logger.error('projectController', 'Reorder Workspaces', { error: error.message || error });
    res.status(500).json({ error: 'Failed to reorder workspaces' });
  }
};

exports.getWorkspaceByName = async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name || '').toUpperCase().trim();
    if (!name) return res.status(400).json({ error: 'Workspace name is required' });

    const workspace = await Workspace.findOne({ name })
      .populate('defaultMembers.user', 'name email avatar teams departmentId')
      .lean();

    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    const projects = await Project.find({ workspace: name })
      .select('name status progress totalTasks starred createdAt')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ ...workspace, projects });
  } catch (error) {
    logger.error('projectController', 'Get Workspace', { error: error.message || error });
    res.status(500).json({ error: 'Failed to fetch workspace' });
  }
};

exports.updateWorkspace = async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name || '').toUpperCase().trim();
    if (!name) return res.status(400).json({ error: 'Workspace name is required' });

    const workspace = await Workspace.findOne({ name });
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    const isAdmin = isAdminUser(req.user);
    const isCreator = workspace.createdBy?.toString() === req.user._id.toString();
    const canManageMembers = isAdmin || isCreator;

    const previousDefaults = (workspace.defaultMembers || []).map((d) => ({
      user: d.user,
      role: d.role,
    }));

    const { color, defaultMembers } = req.body;

    if (color !== undefined && color !== null && String(color).trim() !== '') {
      if (!isAdmin) {
        return res.status(403).json({ error: 'Only admins can change workspace color' });
      }
      const normalizedColor = normalizeHexColor(color);
      if (!normalizedColor) {
        return res.status(400).json({ error: 'Invalid workspace color. Use a hex value like #3498db.' });
      }
      workspace.color = normalizedColor;
    }

    if (Array.isArray(defaultMembers)) {
      if (!canManageMembers) {
        return res.status(403).json({ error: 'Not authorized to update this workspace' });
      }
      const sanitized = defaultMembers
        .filter((entry) => entry?.userId || entry?.user)
        .map((entry) => {
          const userId = entry.userId || entry.user;
          const role = entry.role || 'member';
          if (!VALID_PROJECT_ROLES.includes(role)) {
            throw Object.assign(new Error('Invalid project role in default members'), { status: 400 });
          }
          return { user: userId, role };
        });
      workspace.defaultMembers = sanitized;
    }

    await workspace.save();
    await syncWorkspaceDefaultsToProjects(name, workspace.defaultMembers, previousDefaults);

    const updated = await Workspace.findOne({ name })
      .populate('defaultMembers.user', 'name email avatar teams departmentId')
      .lean();

    res.json(updated);
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({ error: error.message });
    }
    logger.error('projectController', 'Update Workspace', { error: error.message || error });
    res.status(500).json({ error: 'Failed to update workspace' });
  }
};

exports.deleteWorkspace = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ error: 'Only admins can delete workspaces' });
    }

    const { name: rawName } = req.params;
    const name = decodeURIComponent(rawName || '').toUpperCase().trim();
    if (!name) {
      return res.status(400).json({ error: 'Workspace name is required' });
    }

    // Check if workspace exists
    const workspace = await Workspace.findOne({ name });
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Prevent deletion of default workspaces
    const DEFAULT_WORKSPACES = ['TSC ACADEMY', 'TSC ARTISTS', 'TSC FILMS', 'TSC TECH', 'GENERAL'];
    if (DEFAULT_WORKSPACES.includes(name)) {
      return res.status(403).json({ error: 'Cannot delete default workspaces' });
    }

    // Count projects in this workspace
    const projectCount = await Project.countDocuments({ workspace: name });

    if (projectCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete workspace with ${projectCount} project(s). Move or delete projects first.` 
      });
    }

    // Delete the workspace
    await Workspace.deleteOne({ name });

    logger.info('projectController', `Deleted workspace: ${name}`, { user: req.user._id });
    res.json({ success: true, message: `Workspace "${name}" deleted successfully` });
  } catch (error) {
    logger.error('projectController', 'Delete Workspace', { error: error.message || error });
    res.status(500).json({ error: 'Failed to delete workspace' });
  }
};

exports.addMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, role = 'member' } = req.body;

    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const callerRole = isAdminUser(req.user) ? 'admin' : (
      project.owner.toString() === req.user._id.toString() ? 'admin' :
      normalizeStoredProjectRole(
        project.memberRoles?.find((r) => r.user?.toString() === req.user._id.toString())?.role
      )
    );

    if (!['admin', 'manager'].includes(callerRole) && !isAdminUser(req.user)) {
      return res.status(403).json({ error: 'Not authorized to add members' });
    }

    if (project.members.includes(userId)) {
      return res.status(400).json({ error: 'User is already a member of this project' });
    }

    const user = await User.findById(userId).populate('departmentId');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const deptSlug = user.departmentId?.slug || '';
    let autoRole = 'member';
    if (deptSlug === 'admin') autoRole = 'admin';
    else if (['sales', 'artist-management'].includes(deptSlug)) autoRole = 'manager';

    project.members.push(userId);
    project.memberRoles.push({ user: userId, role: autoRole });
    await project.save();

    const updatedProject = await Project.findById(id)
      .populate('owner', 'name email avatar teams departmentId')
      .populate('members', 'name email avatar teams online lastOnline departmentId')
      .populate('memberRoles.user', 'name email avatar');

    broadcastRealtimeEvent('projects', 'project_change', { projectId: id, action: 'update' });
    res.json(updatedProject);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add member' });
  }
};

function getCallerProjectRole(req, project) {
  if (isAdminUser(req.user)) return 'admin';
  if (project.owner.toString() === req.user._id.toString()) return 'admin';
  const raw = project.memberRoles?.find((r) => r.user?.toString() === req.user._id.toString())?.role;
  return normalizeStoredProjectRole(raw);
}

exports.updateMemberRole = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const { role } = req.body;

    if (!role || !VALID_PROJECT_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid project role' });
    }

    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const callerRole = getCallerProjectRole(req, project);
    if (!['admin', 'manager'].includes(callerRole) && !isAdminUser(req.user)) {
      return res.status(403).json({ error: 'Not authorized to update member roles' });
    }

    if (project.owner.toString() === userId) {
      return res.status(400).json({ error: 'Cannot change the project owner role' });
    }

    if (!project.members.some((m) => m.toString() === userId)) {
      return res.status(404).json({ error: 'User is not a member of this project' });
    }

    const roles = project.memberRoles || [];
    const idx = roles.findIndex((r) => {
      const rUserId = r.user?._id ? r.user._id.toString() : r.user?.toString();
      return rUserId === userId;
    });

    if (idx >= 0) {
      roles[idx].role = role;
    } else {
      roles.push({ user: userId, role });
    }
    project.memberRoles = roles;
    await project.save();

    const updatedProject = await Project.findById(id)
      .populate('owner', 'name email avatar teams departmentId')
      .populate('members', 'name email avatar teams online lastOnline departmentId')
      .populate('memberRoles.user', 'name email avatar');

    broadcastRealtimeEvent('projects', 'project_change', { projectId: id, action: 'update' });
    res.json(updatedProject);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update member role' });
  }
};

exports.getProjectWorkload = async (req, res) => {
  try {
    const Task = require('../models/Task');
    const TaskAssignment = require('../models/TaskAssignment');
    const { start, end } = req.query;
    const { parseISO, startOfDay, endOfDay, addDays, format } = require('date-fns');

    const project = await Project.findById(req.params.id).lean();
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const startDate = start ? startOfDay(parseISO(start)) : startOfDay(new Date());
    const endDate = end ? endOfDay(parseISO(end)) : endOfDay(addDays(new Date(), 1));

    const memberIds = [...(project.members || []), project.owner].filter(Boolean);
    const tasks = await Task.find({ projectId: project._id }).select('scheduleDate dueDate startDate scheduleSlot plannedHours title').lean();
    const assignments = await TaskAssignment.find({ taskId: { $in: tasks.map((t) => t._id) }, userId: { $in: memberIds } }).lean();

    const taskMap = Object.fromEntries(tasks.map((t) => [t._id.toString(), t]));
    const workload = {};

    for (const memberId of memberIds) {
      const uid = memberId.toString();
      workload[uid] = {};
      let cursor = startOfDay(startDate);
      while (cursor <= endDate) {
        workload[uid][format(cursor, 'yyyy-MM-dd')] = { amCount: 0, pmCount: 0, fullCount: 0, totalTasks: 0, plannedHours: 0 };
        cursor = addDays(cursor, 1);
      }
    }

    for (const a of assignments) {
      const task = taskMap[a.taskId.toString()];
      if (!task) continue;
      const sched = task.scheduleDate || task.startDate || task.dueDate;
      if (!sched) continue;
      const d = new Date(sched);
      if (d < startDate || d > endDate) continue;
      const key = format(d, 'yyyy-MM-dd');
      const uid = a.userId.toString();
      if (!workload[uid]?.[key]) continue;
      workload[uid][key].totalTasks += 1;
      workload[uid][key].plannedHours += task.plannedHours || 0;
      const slot = task.scheduleSlot || 'FULL';
      if (slot === 'AM') workload[uid][key].amCount += 1;
      else if (slot === 'PM') workload[uid][key].pmCount += 1;
      else workload[uid][key].fullCount += 1;
    }

    res.json({ projectId: project._id, start: format(startDate, 'yyyy-MM-dd'), end: format(endDate, 'yyyy-MM-dd'), workload });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getProjectHoursSummary = async (req, res) => {
  try {
    const Task = require('../models/Task');
    const Log = require('../models/Log');

    const project = await Project.findById(req.params.id).lean();
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const tasks = await Task.find({ projectId: project._id }).select('actualHours plannedHours').lean();
    const taskHours = tasks.reduce((sum, t) => sum + (t.actualHours || 0), 0);
    const plannedHours = tasks.reduce((sum, t) => sum + (t.plannedHours || 0), 0);

    const logs = await Log.find({
      action: 'DAILY_LOG',
      'details.type': { $nin: ['TASK_COMPLETION', 'TASK_REVIEW'] },
      $or: [
        { 'details.projectId': project._id },
        { 'details.project': project.name }
      ]
    }).select('details').lean();

    const manualLogHours = logs.reduce(
      (sum, l) => sum + parseTimeSpentToHours(l.details?.timeSpent),
      0
    );

    res.json({
      projectId: project._id,
      projectName: project.name,
      taskHours,
      plannedHours,
      manualLogHours,
      totalHours: taskHours + manualLogHours
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
