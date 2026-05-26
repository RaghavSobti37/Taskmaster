const Project = require('../models/Project');
const User = require('../models/User');
const logger = require('../utils/logger');

exports.createProject = async (req, res) => {
  try {
    const { name, description, tags, members, color, starred } = req.body;
    
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

    const project = await Project.create({
      name,
      description,
      tags,
      color: color || '#3b82f6',
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
    const allowedFields = ['name', 'description', 'tags', 'members', 'memberRoles', 'status', 'color', 'starred'];
    const sanitizedUpdate = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        sanitizedUpdate[key] = req.body[key];
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
