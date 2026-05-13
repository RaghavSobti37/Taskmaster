const Project = require('../models/Project');

exports.createProject = async (req, res) => {
  try {
    const { name, description, tags, members } = req.body;
    
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

    const project = await Project.create({
      name,
      description,
      tags,
      outletId: req.user.currentOutletId || 'main',
      owner: req.user._id,
      members: providedMembers,
      memberRoles: providedRoles
    });
    res.status(201).json(project);
  } catch (error) {
    console.error('Create Project Error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
};

exports.getProjects = async (req, res) => {
  try {
    const projects = await Project.find({
      $or: [
        { owner: req.user._id },
        { members: req.user._id }
      ]
    })
    .populate('members', 'name avatar teams')
    .sort({ createdAt: -1 });

    const Task = require('../models/Task');
    const projectsWithProgress = await Promise.all(projects.map(async (project) => {
      const totalTasks = await Task.countDocuments({ projectId: project._id });
      const completedTasks = await Task.countDocuments({ projectId: project._id, status: 'done' });
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      return { ...project._doc, progress, totalTasks, completedTasks };
    }));

    res.json(projectsWithProgress);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
};

exports.getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('owner', 'name email avatar teams')
      .populate('members', 'name email avatar teams online lastOnline')
      .populate('memberRoles.user', 'name email avatar');
    
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch project' });
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
    const allowedFields = ['name', 'description', 'tags', 'members', 'memberRoles', 'status'];
    const sanitizedUpdate = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        sanitizedUpdate[key] = req.body[key];
      }
    }

    const updated = await Project.findByIdAndUpdate(req.params.id, sanitizedUpdate, { new: true, runValidators: true });
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
