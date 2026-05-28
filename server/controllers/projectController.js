const Project = require('../models/Project');
const Workspace = require('../models/Workspace');
const User = require('../models/User');
const logger = require('../utils/logger');

const DEFAULT_WORKSPACES = [
  { name: 'TSC ACADEMY', color: '#3498db' },
  { name: 'TSC ARTISTS', color: '#9b59b6' },
  { name: 'TSC FILMS', color: '#e74c3c' },
  { name: 'TSC TECH', color: '#2ecc71' },
  { name: 'GENERAL', color: '#64748b' },
];

// 20 perceptually-spaced hues converted to saturated hex colors
const PALETTE = [
  '#e74c3c','#e67e22','#f1c40f','#2ecc71','#1abc9c',
  '#3498db','#9b59b6','#e91e63','#ff5722','#8bc34a',
  '#00bcd4','#673ab7','#ff9800','#4caf50','#03a9f4',
  '#ff4081','#7c4dff','#64dd17','#ffab00','#00e5ff',
];

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
    
    const providedMembers = members?.map(m => m.userId) || [];
    const providedRoles = members?.map(m => ({
      user: m.userId,
      role: m.role || 'member'
    })) || [];

    // Ensure owner is always in members and roles
    if (!providedMembers.includes(req.user._id.toString())) {
      providedMembers.push(req.user._id);
      providedRoles.push({ user: req.user._id, role: 'owner' });
    }

    // Ensure deepank@theshakticollective.in is automatically added to all new projects
    const deepank = await User.findOne({ email: 'deepank@theshakticollective.in' });
    if (deepank) {
      const deepankIdStr = deepank._id.toString();
      if (!providedMembers.some(m => m.toString() === deepankIdStr)) {
        providedMembers.push(deepank._id);
        providedRoles.push({ user: deepank._id, role: 'artist_management' });
      }
    }

    const assignedColor = color || await pickDistinctColor();

    const project = await Project.create({
      name,
      description,
      tags,
      color: assignedColor,
      workspace: workspace ? workspace.toUpperCase().trim() : 'General',
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

    res.status(201).json(project);
  } catch (error) {
    logger.error('projectController', 'Create Project ', { error: error.message || error });
    res.status(500).json({ error: 'Failed to create project' });
  }
};

exports.getProjects = async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : {
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

    // SECURITY: Only owner or admin can update
    if (req.user.role !== 'admin' && project.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to update this project' });
    }

    // SECURITY: Whitelist allowed update fields (prevent owner/member injection)
    const allowedFields = ['name', 'description', 'tags', 'members', 'memberRoles', 'status', 'color', 'starred', 'workspace'];
    const sanitizedUpdate = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        sanitizedUpdate[key] = key === 'workspace'
          ? req.body[key].toUpperCase().trim()
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

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update project' });
  }
};

exports.deleteProject = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'ADMIN CLEARANCE REQUIRED' });
    }

    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    await Project.findByIdAndDelete(req.params.id);

    // Log the purge
    const CRMAudit = require('../models/CRMAudit');
    await CRMAudit.create({
      userId: req.user._id,
      userRole: req.user.role,
      action: 'PROJECT_DELETE',
      fieldChanged: 'project',
      oldValue: project.name,
      newValue: 'PURGED',
      notes: `Project ${project.name} decommissioned by root administrator.`
    });

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
    if (req.user.role !== 'admin' && project.owner.toString() !== req.user._id.toString()) {
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

    res.json(updatedProject);
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove member' });
  }
};
exports.getWorkspaces = async (req, res) => {
  try {
    let workspaces = await Workspace.find().sort({ order: 1, name: 1 }).lean();

    if (workspaces.length === 0) {
      await Workspace.insertMany(
        DEFAULT_WORKSPACES.map((w, idx) => ({
          name: w.name,
          color: w.color,
          order: idx,
          createdBy: req.user._id,
        }))
      );
      workspaces = await Workspace.find().sort({ order: 1, name: 1 }).lean();
    }

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

    const workspace = await Workspace.create({
      name: name.toUpperCase().trim(),
      color: color || '#64748b',
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

    await Promise.all(
      order.map((name, index) => 
        Workspace.updateOne({ name }, { order: index })
      )
    );

    const workspaces = await Workspace.find().sort({ order: 1, name: 1 }).lean();
    res.json(workspaces);
  } catch (error) {
    logger.error('projectController', 'Reorder Workspaces', { error: error.message || error });
    res.status(500).json({ error: 'Failed to reorder workspaces' });
  }
};

exports.deleteWorkspace = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete workspaces' });
    }

    const { name } = req.params;
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
    const { userId } = req.body;

    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Only admin or project owner can add members
    if (req.user.role !== 'admin' && project.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to add members' });
    }

    // Check if already a member
    if (project.members.includes(userId)) {
      return res.status(400).json({ error: 'User is already a member of this project' });
    }

    project.members.push(userId);
    
    // Fetch user to get their current role
    const User = require('../models/User');
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    project.memberRoles.push({
      user: userId,
      role: user.role || 'member'
    });

    await project.save();

    const updatedProject = await Project.findById(id)
      .populate('owner', 'name email avatar teams')
      .populate('members', 'name email avatar teams online lastOnline')
      .populate('memberRoles.user', 'name email avatar');

    res.json(updatedProject);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add member' });
  }
};
