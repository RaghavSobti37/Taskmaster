import Project from '../models/Project.js';
import User from '../models/User.js';
import Task from '../models/Task.js';
import { logger } from '../utils/logger.js';

// @desc    Create a new project
// @route   POST /api/projects
// @access  Private
export const createProject = async (req, res) => {
  try {
    const { name, description, visibility } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ message: 'Project name is required' });
    }

    const project = new Project({
      name,
      description: description || '',
      creator: req.user.id,
      visibility: visibility || 'private',
      members: [
        {
          userId: req.user.id,
          role: 'admin'
        }
      ]
    });

    await project.save();
    await project.populate('creator', 'username email firstName lastName');
    await project.populate('members.userId', 'username email firstName lastName');

    logger.info(`Project created: ${name}`, 'PROJECT_CREATE', {
      projectId: project._id,
      creator: req.user.id
    });

    res.status(201).json(project);
  } catch (error) {
    console.error(error.message);
    logger.error('Failed to create project', 'PROJECT_CREATE', error);
    res.status(500).json({ message: 'Failed to create project' });
  }
};

// @desc    Get all projects for user
// @route   GET /api/projects
// @access  Private
export const getUserProjects = async (req, res) => {
  try {
    const projects = await Project.find({
      $or: [
        { creator: req.user.id },
        { 'members.userId': req.user.id }
      ]
    })
      .populate('creator', 'username email firstName lastName')
      .populate('members.userId', 'username email firstName lastName')
      .populate('clusters.lead', 'username email firstName lastName')
      .populate('clusters.members.userId', 'username email firstName lastName')
      .sort({ createdAt: -1 });

    res.json(projects);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Failed to fetch projects' });
  }
};

// @desc    Get single project
// @route   GET /api/projects/:projectId
// @access  Private
export const getProject = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId)
      .populate('creator', 'username email firstName lastName')
      .populate('members.userId', 'username email firstName lastName')
      .populate('clusters.lead', 'username email firstName lastName')
      .populate('clusters.members.userId', 'username email firstName lastName')
      .populate('tasks');

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check if user is member or creator
    const isMember = project.creator.toString() === req.user.id || 
      project.members.some(m => m.userId._id.toString() === req.user.id);

    if (project.visibility === 'private' && !isMember) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(project);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Failed to fetch project' });
  }
};

// @desc    Update project
// @route   PUT /api/projects/:projectId
// @access  Private (Project admin only)
export const updateProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name, description, status, visibility, settings } = req.body;

    let project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check authorization
    if (project.creator.toString() !== req.user.id) {
      const adminMember = project.members.find(
        m => m.userId.toString() === req.user.id && m.role === 'admin'
      );
      if (!adminMember) {
        return res.status(403).json({ message: 'Not authorized to update this project' });
      }
    }

    if (name) project.name = name;
    if (description !== undefined) project.description = description;
    if (status) project.status = status;
    if (visibility) project.visibility = visibility;
    if (settings) project.settings = { ...project.settings, ...settings };

    await project.save();
    await project.populate('creator', 'username email firstName lastName');
    await project.populate('members.userId', 'username email firstName lastName');

    logger.info(`Project updated: ${name}`, 'PROJECT_UPDATE', {
      projectId: project._id,
      updatedBy: req.user.id
    });

    res.json(project);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Failed to update project' });
  }
};

// @desc    Add member to project
// @route   POST /api/projects/:projectId/members
// @access  Private
export const addProjectMember = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { userId, role } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check if user is already a member
    const existingMember = project.members.find(
      m => m.userId.toString() === userId
    );

    if (existingMember) {
      return res.status(400).json({ message: 'User is already a member' });
    }

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    project.members.push({
      userId,
      role: role || 'tech'
    });

    await project.save();
    await project.populate('members.userId', 'username email firstName lastName');

    logger.info(`Member added to project: ${user.username}`, 'PROJECT_MEMBER_ADD', {
      projectId,
      userId
    });

    res.json(project);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Failed to add member' });
  }
};

// @desc    Remove member from project
// @route   DELETE /api/projects/:projectId/members/:userId
// @access  Private (Project admin only)
export const removeProjectMember = async (req, res) => {
  try {
    const { projectId, userId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    project.members = project.members.filter(
      m => m.userId.toString() !== userId
    );

    await project.save();

    res.json({ message: 'Member removed from project' });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Failed to remove member' });
  }
};

// @desc    Update project member role
// @route   PUT /api/projects/:projectId/members/:userId
// @access  Private (Project admin only)
export const updateProjectMemberRole = async (req, res) => {
  try {
    const { projectId, userId } = req.params;
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({ message: 'Role is required' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Find and update the member's role
    const memberIndex = project.members.findIndex(
      m => m.userId.toString() === userId
    );

    if (memberIndex === -1) {
      return res.status(404).json({ message: 'Member not found in project' });
    }

    project.members[memberIndex].role = role;
    await project.save();

    res.json({ 
      message: 'Member role updated', 
      member: project.members[memberIndex] 
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Failed to update member role' });
  }
};

// @desc    Create cluster within project
// @route   POST /api/projects/:projectId/clusters
// @access  Private (Project admin only)
export const createCluster = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name, description, lead, members = [] } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Cluster name is required' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const projectMemberIds = new Set(project.members.map(m => m.userId.toString()));
    projectMemberIds.add(project.creator.toString());

    const normalizedMembers = Array.isArray(members)
      ? [...new Set(members.map(id => id?.toString()).filter(Boolean))]
      : [];

    const validMembers = normalizedMembers.filter(id => projectMemberIds.has(id));

    const leadId = (lead && projectMemberIds.has(lead.toString()))
      ? lead.toString()
      : req.user.id;

    const clusterMembers = [
      {
        userId: leadId,
        role: 'lead'
      },
      ...validMembers
        .filter(id => id !== leadId)
        .map(id => ({ userId: id, role: 'member' }))
    ];

    const cluster = {
      name: name.trim(),
      description: description || '',
      lead: leadId,
      members: clusterMembers
    };

    project.clusters.push(cluster);
    await project.save();

    const createdCluster = project.clusters[project.clusters.length - 1];

    await project.populate('clusters.lead', 'username email firstName lastName');
    await project.populate('clusters.members.userId', 'username email firstName lastName');

    logger.info(`Cluster created: ${name}`, 'CLUSTER_CREATE', {
      projectId,
      clusterId: createdCluster._id
    });

    const populatedCluster = project.clusters.id(createdCluster._id);

    res.json({
      message: 'Cluster created successfully',
      cluster: populatedCluster,
      project
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Failed to create cluster' });
  }
};

// @desc    Add member to cluster
// @route   POST /api/projects/:projectId/clusters/:clusterId/members
// @access  Private
export const addClusterMember = async (req, res) => {
  try {
    const { projectId, clusterId } = req.params;
    const { userId, role } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const cluster = project.clusters.id(clusterId);
    if (!cluster) {
      return res.status(404).json({ message: 'Cluster not found' });
    }

    // Check if already a member
    const existingMember = cluster.members.find(
      m => m.userId.toString() === userId
    );

    if (existingMember) {
      return res.status(400).json({ message: 'User is already in this cluster' });
    }

    cluster.members.push({
      userId,
      role: role || 'member'
    });

    await project.save();
    await project.populate('clusters.members.userId', 'username email firstName lastName');

    const updatedCluster = project.clusters.id(clusterId);

    res.json({
      message: 'Member added to cluster',
      cluster: updatedCluster,
      project
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Failed to add member to cluster' });
  }
};

// @desc    Update cluster details
// @route   PUT /api/projects/:projectId/clusters/:clusterId
// @access  Private
export const updateCluster = async (req, res) => {
  try {
    const { projectId, clusterId } = req.params;
    const { name, description } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const cluster = project.clusters.id(clusterId);
    if (!cluster) {
      return res.status(404).json({ message: 'Cluster not found' });
    }

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ message: 'Cluster name cannot be empty' });
      }
      cluster.name = name.trim();
    }

    if (description !== undefined) {
      cluster.description = description;
    }

    await project.save();
    await project.populate('clusters.members.userId', 'username email firstName lastName');
    await project.populate('clusters.lead', 'username email firstName lastName');

    res.json({
      message: 'Cluster updated successfully',
      cluster: project.clusters.id(clusterId),
      project
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Failed to update cluster' });
  }
};

// @desc    Replace cluster member list
// @route   PUT /api/projects/:projectId/clusters/:clusterId/members
// @access  Private
export const updateClusterMembers = async (req, res) => {
  try {
    const { projectId, clusterId } = req.params;
    const { memberIds } = req.body;

    if (!Array.isArray(memberIds)) {
      return res.status(400).json({ message: 'memberIds must be an array' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const cluster = project.clusters.id(clusterId);
    if (!cluster) {
      return res.status(404).json({ message: 'Cluster not found' });
    }

    const projectMemberIds = new Set(project.members.map(m => m.userId.toString()));
    projectMemberIds.add(project.creator.toString());

    const uniqueRequested = [...new Set(memberIds.map(id => id?.toString()).filter(Boolean))];
    const validRequested = uniqueRequested.filter(id => projectMemberIds.has(id));

    const leadId = cluster.lead?.toString();
    if (leadId && !validRequested.includes(leadId)) {
      validRequested.unshift(leadId);
    }

    cluster.members = validRequested.map(userId => {
      const existingMember = cluster.members.find(m => m.userId.toString() === userId);
      const role = existingMember?.role || (leadId === userId ? 'lead' : 'member');
      return { userId, role };
    });

    await project.save();
    await project.populate('clusters.members.userId', 'username email firstName lastName');
    await project.populate('clusters.lead', 'username email firstName lastName');

    res.json({
      message: 'Cluster members updated successfully',
      cluster: project.clusters.id(clusterId),
      project
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Failed to update cluster members' });
  }
};

// @desc    Delete a cluster
// @route   DELETE /api/projects/:projectId/clusters/:clusterId
// @access  Private
export const deleteCluster = async (req, res) => {
  try {
    const { projectId, clusterId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const cluster = project.clusters.id(clusterId);
    if (!cluster) {
      return res.status(404).json({ message: 'Cluster not found' });
    }

    cluster.deleteOne();
    await project.save();
    await project.populate('clusters.members.userId', 'username email firstName lastName');
    await project.populate('clusters.lead', 'username email firstName lastName');

    res.json({
      message: 'Cluster deleted successfully',
      project
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Failed to delete cluster' });
  }
};

// @desc    Delete project
// @route   DELETE /api/projects/:projectId
// @access  Private (Project creator only)
export const deleteProject = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (project.creator.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this project' });
    }

    // Delete all tasks in project
    await Task.deleteMany({ _id: { $in: project.tasks } });

    // Delete project
    await Project.findByIdAndDelete(projectId);

    logger.info(`Project deleted: ${project.name}`, 'PROJECT_DELETE', {
      projectId,
      deletedBy: req.user.id
    });

    res.json({ message: 'Project deleted' });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Failed to delete project' });
  }
};
