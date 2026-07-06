const Project = require('../models/Project');
const Phase = require('../models/Phase');
const Workspace = require('../../../models/Workspace');
const WorkspacePreference = require('../../../models/WorkspacePreference');
const User = require('../../../models/User');
const Asset = require('../../../models/Asset');
const Log = require('../../../models/Log');
const logger = require('../../../utils/logger');
const { formatProjectName } = require('../../../utils/formatProjectName');
const { broadcastRealtimeEvent } = require('../../../config/realtime');
const { isAdminUser } = require('../../../utils/departmentPermissions');
const {
  canAccessProject,
  getAccessibleProjectsFilter,
  userCanAccessWorkspace,
  filterWorkspacesForUser,
  memberIdStr: accessMemberIdStr,
} = require('../../../utils/projectAccess');
const { normalizeStoredProjectRole } = require('../../../../shared/projectRoles');
const { parseTimeSpentToHours } = require('../../../../shared/timeSpent');
const taskProjectQueryService = require('../../tasks/services/taskProjectQueryService');
const { ACTIVE_LOG_FILTER } = require('../../../utils/taskDailyLogs');
const auditService = require('../../crm/services/auditService');
const { getTenantId, runWithContext, resolveTenantIdForRequest } = require('../../../utils/tenantContext');

function buildTaskCountMap(taskCounts) {
  return taskCounts.reduce((acc, curr) => {
    acc[curr._id.toString()] = curr;
    return acc;
  }, {});
}

/** Live task aggregation is source of truth for list APIs (stored counters may drift). */
function attachTaskCountsToProject(project, countMap) {
  const counts = countMap[project._id.toString()] || { total: 0, completed: 0 };
  const progress = counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0;
  return {
    ...project,
    progress,
    totalTasks: counts.total,
    completedTasks: counts.completed,
    totalTasksCount: counts.total,
    completedTasksCount: counts.completed,
  };
}

async function attachAggregatedTaskCounts(projects) {
  if (!projects?.length) return projects || [];
  const taskCounts = await taskProjectQueryService.aggregateTaskCountsByProjectIds(
    projects.map((p) => p._id)
  );
  const countMap = buildTaskCountMap(taskCounts);
  return projects.map((p) => attachTaskCountsToProject(p, countMap));
}

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

async function findWorkspacePreferenceForUser(userId) {
  return WorkspacePreference.findOne({ userId }).lean();
}

async function upsertWorkspacePreferenceOrder(userId, order) {
  const tenantId = getTenantId();
  const update = { order, updatedAt: new Date() };

  const existing = await WorkspacePreference.findOneAndUpdate(
    { userId },
    { $set: update },
    { new: true }
  );
  if (existing) return existing;

  if (tenantId) {
    return WorkspacePreference.findOneAndUpdate(
      { userId },
      {
        $set: update,
        $setOnInsert: { userId, tenantId },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  return WorkspacePreference.findOneAndUpdate(
    { userId },
    { $set: update, $setOnInsert: { userId } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function loadWorkspacesForContext() {
  return Workspace.find().lean();
}

async function getSortedWorkspacesForUser(userId) {
  let workspaces = await loadWorkspacesForContext();
  if (workspaces.length === 0) {
    try {
      await Workspace.insertMany(
        DEFAULT_WORKSPACES.map((w, idx) => ({
          name: w.name,
          color: w.color,
          order: idx,
          createdBy: userId,
        }))
      );
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
    workspaces = await loadWorkspacesForContext();
  }

  const pref = await findWorkspacePreferenceForUser(userId);
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

function buildAllMembersFromProjects(projects, workspace) {
  const byUser = new Map();
  const defaultMemberIds = new Set(
    (workspace.defaultMembers || []).map((d) => accessMemberIdStr(d.user))
  );
  const defaultRoleByUser = new Map(
    (workspace.defaultMembers || []).map((d) => [
      accessMemberIdStr(d.user),
      normalizeStoredProjectRole(d.role),
    ])
  );

  const addProjectToEntry = (entry, projectId, projectName, role) => {
    const pid = projectId.toString();
    if (!entry.projects.some((p) => p._id.toString() === pid)) {
      entry.projects.push({ _id: projectId, name: projectName, role });
    }
  };

  const ensureEntry = (userDoc) => {
    const uid = accessMemberIdStr(userDoc?._id || userDoc);
    if (!uid) return null;
    let entry = byUser.get(uid);
    if (!entry) {
      entry = {
        userId: uid,
        name: userDoc?.name || 'Unknown',
        email: userDoc?.email || '',
        avatar: userDoc?.avatar,
        departmentId: userDoc?.departmentId,
        projects: [],
        isDefaultMember: defaultMemberIds.has(uid),
        defaultRole: defaultRoleByUser.get(uid) || null,
      };
      byUser.set(uid, entry);
    }
    return entry;
  };

  for (const project of projects) {
    const projectId = project._id;
    const projectName = project.name;

    if (project.owner) {
      const owner = typeof project.owner === 'object' ? project.owner : { _id: project.owner };
      const entry = ensureEntry(owner);
      if (entry) addProjectToEntry(entry, projectId, projectName, 'owner');
    }

    for (const m of project.members || []) {
      const member = typeof m === 'object' ? m : { _id: m };
      const uid = accessMemberIdStr(member);
      if (uid === accessMemberIdStr(project.owner)) continue;
      const roleEntry = (project.memberRoles || []).find(
        (r) => accessMemberIdStr(r.user) === uid
      );
      const role = roleEntry ? normalizeStoredProjectRole(roleEntry.role) : 'member';
      const entry = ensureEntry(member);
      if (entry) addProjectToEntry(entry, projectId, projectName, role);
    }
  }

  for (const d of workspace.defaultMembers || []) {
    const u = d.user;
    const uid = accessMemberIdStr(u?._id || u);
    if (!uid || byUser.has(uid)) continue;
    const userDoc = typeof u === 'object' ? u : null;
    byUser.set(uid, {
      userId: uid,
      name: userDoc?.name || 'Unknown',
      email: userDoc?.email || '',
      avatar: userDoc?.avatar,
      departmentId: userDoc?.departmentId,
      projects: [],
      isDefaultMember: true,
      defaultRole: normalizeStoredProjectRole(d.role),
    });
  }

  return [...byUser.values()].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
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
      const userId = memberIdStr(m?.userId);
      if (!userId) return;
      mergeMemberEntry(providedMembers, providedRoles, userId, m.role || 'member');
    });

    const ws = await Workspace.findOne({ name: workspaceName }).lean();
    (ws?.defaultMembers || []).forEach((entry) => {
      mergeMemberEntry(providedMembers, providedRoles, entry.user, entry.role || 'member');
    });

    // Ensure owner is always in members and roles
    if (!providedMembers.some((m) => memberIdStr(m) === req.user._id.toString())) {
      mergeMemberEntry(providedMembers, providedRoles, req.user._id, 'admin');
    }

    // Auto project members from PlatformSettings (fallback: env AUTO_PROJECT_MEMBER_USER_IDS)
    const { getAutoProjectMemberUserIds } = require('../../../../shared/platformUserIds');
    const { loadPlatformSettings } = require('../../../services/platformSettingsService');
    await loadPlatformSettings();
    const autoMemberIds = getAutoProjectMemberUserIds();
    for (const memberId of autoMemberIds) {
      if (!providedMembers.some((m) => memberIdStr(m) === String(memberId))) {
        mergeMemberEntry(providedMembers, providedRoles, memberId, 'artist_management');
      }
    }

    const assignedColor = color || '#64748b';
    const tenantId = await resolveTenantIdForRequest(req);

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
      memberRoles: providedRoles,
      tenantId,
    });

    const { queueGamificationEvent } = require('../../../services/backgroundQueue');
    queueGamificationEvent('PROJECT_CREATED', {
      userId: req.user._id,
      project
    });

    broadcastRealtimeEvent('projects', 'project_change', { projectId: project._id, action: 'create' });
    const { emitOnboardingEvent } = require('../../../services/onboardingEvents');
    emitOnboardingEvent('project.created', { tenantId });
    res.status(201).json(project);
  } catch (error) {
    logger.error('projectController', 'Create Project ', { error: error.message || error });
    res.status(500).json({ error: 'Failed to create project' });
  }
};

exports.getProjects = async (req, res) => {
  try {
    const tenantId = await resolveTenantIdForRequest(req);
    const loadProjects = async () => {
      const filter = isAdminUser(req.user) ? {} : {
        $or: [
          { owner: req.user._id },
          { members: req.user._id },
        ],
      };
      const projects = await Project.find(filter)
        .populate('members', 'name avatar teams')
        .sort({ createdAt: -1 })
        .lean();
      return attachAggregatedTaskCounts(projects);
    };

    const projectsWithProgress = getTenantId()
      ? await loadProjects()
      : await runWithContext({
        tenantId,
        userId: req.user._id?.toString?.(),
        traceId: req.traceId,
      }, loadProjects);

    // Background backfill: assign distinct colors to projects still using the default blue
    const defaultBlue = '#3b82f6';
    const needsColor = projectsWithProgress.filter(p => !p.color || p.color.toLowerCase() === defaultBlue);
    if (needsColor.length > 0) {
      const usedColors = new Set(projectsWithProgress.filter(p => p.color && p.color.toLowerCase() !== defaultBlue).map(p => p.color.toLowerCase()));
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
    const projectId = req.params.id;

    const project = await Project.findById(projectId)
      .populate('owner', 'name email avatar teams')
      .populate('members', 'name email avatar teams online lastOnline')
      .populate('memberRoles.user', 'name email avatar')
      .lean();

    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!canAccessProject(req.user, project)) {
      return res.status(403).json({ error: 'Not authorized to view this project' });
    }

    const [phases, tasks, assets] = await Promise.all([
      Phase.find({ projectId }).sort({ order: 1 }).lean(),
      taskProjectQueryService.findTasksByProjectId(projectId),
      Asset.find({ projectId }).sort({ createdAt: -1 }).lean()
    ]);

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
      // P2-5: validate workspace exists before member-level workspace move
      const targetWsName = req.body.workspace.toUpperCase().trim();
      const targetWs = await Workspace.findOne({ name: targetWsName }).lean();
      if (!targetWs) {
        return res.status(400).json({ error: `Workspace "${targetWsName}" does not exist` });
      }
      const expectedVersion =
        typeof req.body.__v === 'number' ? req.body.__v : project.__v;
      const updated = await Project.findOneAndUpdate(
        { _id: req.params.id, __v: expectedVersion },
        {
          $set: { workspace: targetWsName },
          $inc: { __v: 1 },
        },
        { new: true, runValidators: true }
      );
      if (!updated) {
        return res.status(409).json({ error: 'Version conflict — refresh and retry' });
      }
      broadcastRealtimeEvent('projects', 'project_change', { projectId: updated._id, action: 'update' });
      return res.json(updated);
    }

    // P2-5: validate workspace exists if being changed (admin/owner path)
    if (req.body.workspace !== undefined) {
      const targetWsName = req.body.workspace.toUpperCase().trim();
      const targetWs = await Workspace.findOne({ name: targetWsName }).lean();
      if (!targetWs) {
        return res.status(400).json({ error: `Workspace "${targetWsName}" does not exist` });
      }
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

    const expectedVersion =
      typeof req.body.__v === 'number' ? req.body.__v : project.__v;
    const updated = await Project.findOneAndUpdate(
      { _id: req.params.id, __v: expectedVersion },
      { $set: sanitizedUpdate, $inc: { __v: 1 } },
      { new: true, runValidators: true }
    );
    if (!updated) {
      return res.status(409).json({ error: 'Version conflict — refresh and retry' });
    }

    // Handle Event Dispatch for Gamification
    if (sanitizedUpdate.status === 'completed' && project.status !== 'completed') {
      const eventDispatcher = require('../../../services/eventDispatcher');
      const tenantId = req.tenantId || project.tenantId;
      eventDispatcher.emit('PROJECT_CLOSED', {
        userId: req.user._id,
        tenantId,
        projectId: project._id
      });
    } else if (sanitizedUpdate.status === 'archived' && project.status !== 'archived') {
      const eventDispatcher = require('../../../services/eventDispatcher');
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

    await auditService.logProjectDeletion(req.user, project);

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
    let workspaces = await getSortedWorkspacesForUser(req.user._id);
    workspaces = await filterWorkspacesForUser(req.user, workspaces);
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

    await upsertWorkspacePreferenceOrder(req.user._id, savedOrder);

    let workspaces = await getSortedWorkspacesForUser(req.user._id);
    workspaces = await filterWorkspacesForUser(req.user, workspaces);
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

    if (!(await userCanAccessWorkspace(req.user, workspace))) {
      return res.status(403).json({ error: 'Not authorized to view this workspace' });
    }

    const isAdmin = isAdminUser(req.user);
    const projectFilter = isAdmin
      ? { workspace: name }
      : { workspace: name, ...getAccessibleProjectsFilter(req.user) };

    const [projectsForList, projectsForMembers] = await Promise.all([
      Project.find(projectFilter)
        .select('name status progress totalTasksCount completedTasksCount starred createdAt')
        .sort({ createdAt: -1 })
        .lean(),
      Project.find(projectFilter)
        .populate('owner', 'name email avatar departmentId')
        .populate('members', 'name email avatar departmentId')
        .populate('memberRoles.user', 'name email avatar')
        .select('name owner members memberRoles')
        .lean(),
    ]);

    const projectsWithCounts = await attachAggregatedTaskCounts(projectsForList);
    const allMembers = buildAllMembersFromProjects(projectsForMembers, workspace);

    res.json({ ...workspace, projects: projectsWithCounts, allMembers });
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

    if (!(await userCanAccessWorkspace(req.user, workspace))) {
      return res.status(403).json({ error: 'Not authorized to view this workspace' });
    }

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
    const { start, end } = req.query;
    const { parseISO, startOfDay, endOfDay, addDays, format } = require('date-fns');

    const project = await Project.findById(req.params.id).lean();
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!canAccessProject(req.user, project)) {
      return res.status(403).json({ error: 'Not authorized to view this project' });
    }

    const startDate = start ? startOfDay(parseISO(start)) : startOfDay(new Date());
    const endDate = end ? endOfDay(parseISO(end)) : endOfDay(addDays(new Date(), 1));

    const memberIds = [...(project.members || []), project.owner].filter(Boolean);
    const tasks = await taskProjectQueryService.findTasksByProjectId(
      project._id,
      'scheduleDate dueDate startDate scheduleSlot plannedHours title'
    );
    const assignments = await taskProjectQueryService.findAssignmentsByTaskIds(
      tasks.map((t) => t._id),
      { userId: { $in: memberIds } }
    );

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

/** Dev-only plain-text export: workspaces and projects (localhost). */
exports.exportWorkspacesPlainText = async (req, res) => {
  try {
    let workspaces = await Workspace.find().lean();
    workspaces = sortWorkspacesGlobal(workspaces);

    const projects = await Project.find({ status: { $ne: 'archived' } })
      .select('name workspace')
      .sort({ name: 1 })
      .lean();

    const byWs = {};
    for (const p of projects) {
      const w = normalizeWorkspaceName(p.workspace || 'GENERAL');
      if (!byWs[w]) byWs[w] = [];
      byWs[w].push(p.name);
    }

    const lines = [];
    const seen = new Set();

    for (const ws of workspaces) {
      const name = normalizeWorkspaceName(ws.name);
      seen.add(name);
      lines.push(name);
      const list = byWs[name] || [];
      if (!list.length) lines.push('  (no projects)');
      else list.forEach((n) => lines.push(`  - ${n}`));
      lines.push('');
    }

    for (const w of Object.keys(byWs).sort()) {
      if (seen.has(w)) continue;
      lines.push(w);
      byWs[w].forEach((n) => lines.push(`  - ${n}`));
      lines.push('');
    }

    res.type('text/plain; charset=utf-8').send(lines.join('\n').trim() + '\n');
  } catch (error) {
    logger.error('projectController', 'Export workspaces plain text', { error: error.message || error });
    res.status(500).type('text/plain').send(`Error: ${error.message}\n`);
  }
};

const {
  buildProjectAnalytics,
  buildProjectsAnalyticsSummary,
} = require('../services/projectAnalyticsService');

exports.getProjectsAnalyticsSummary = async (req, res) => {
  try {
    const data = await buildProjectsAnalyticsSummary(req.user, req.query);
    res.json(data);
  } catch (error) {
    logger.error('projectController', 'getProjectsAnalyticsSummary', { error: error.message });
    res.status(500).json({ error: error.message });
  }
};

exports.getProjectAnalytics = async (req, res) => {
  try {
    const data = await buildProjectAnalytics(req.params.id, req.user, req.query);
    res.json(data);
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) {
      logger.error('projectController', 'getProjectAnalytics', { error: error.message, projectId: req.params.id });
    }
    res.status(status).json({ error: error.message });
  }
};

exports.getProjectHoursSummary = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id).lean();
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!canAccessProject(req.user, project)) {
      return res.status(403).json({ error: 'Not authorized to view this project' });
    }

    const { buildProjectHoursSummary } = require('../services/projectAnalyticsService');
    const summary = await buildProjectHoursSummary(project);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
