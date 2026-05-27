const User = require('../models/User');
const Task = require('../models/Task');
const Project = require('../models/Project');
const { isAfter, subMinutes } = require('date-fns');
const logger = require('../utils/logger');

const isUserOnline = (u) => {
  if (!u.lastOnline) return false;
  const fiveMinAgo = subMinutes(new Date(), 5);
  return isAfter(u.lastOnline, fiveMinAgo);
};

exports.getTeam = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const query = {};
    const users = await User.find(query)
      .select('-password')
      .skip(skip)
      .limit(limit);
    
    const total = await User.countDocuments(query);

    const team = await Promise.all(
      users.map(async (u) => {
        const tasksDone = await Task.countDocuments({ assignees: u._id, status: 'done' });
        const projects = await Project.find({ $or: [{ owner: u._id }, { members: u._id }] }).select('_id name');
        return {
          _id: u._id,
          name: u.name,
          email: u.email,
          avatar: u.avatar,
          role: u.role,
          online: isUserOnline(u),
          lastOnline: u.lastOnline,
          tasksDone,
          projectsInvolved: projects.map(p => ({ _id: p._id, name: p.name })),
          teams: u.teams || [],
        };
      })
    );
    res.json({
      team,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    logger.error('User', 'getTeam error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
};

exports.updateUserTeams = async (req, res) => {
  try {
    const { teams } = req.body;
    const update = {};
    if (teams) update.teams = teams.map(t => t.toUpperCase());
    
    const user = await User.findByIdAndUpdate(req.params.id, { $set: update }, { new: true }).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  const { name, avatar, phone, role, currentPassword, newPassword, teams, teamName } = req.body;
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (name) user.name = name;
    if (avatar) user.avatar = avatar;
    if (phone) user.phone = phone;
    if (teams) user.teams = teams;
    if (role && req.user.role === 'admin') {
      // Protect root admin and ensure at least one admin exists
      if (user.email === 'test@example.com' && role !== 'admin') {
        return res.status(403).json({ error: 'Root Admin must retain administrative clearance.' });
      }
      user.role = role;
    }

    if (currentPassword && newPassword) {
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) return res.status(400).json({ error: 'Current password incorrect' });
      user.password = newPassword;
    }

    user.lastOnline = new Date();
    await user.save();

    const updatedUser = await User.findById(user._id).select('-password');
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getDirectory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const users = await User.find()
      .select('-password')
      .skip(skip)
      .limit(limit);
    
    const total = await User.countDocuments();
    
    const enriched = users.map(u => ({
      ...u._doc,
      online: isUserOnline(u)
    }));
    
    res.json({
      users: enriched,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;

    // SECURITY: Validate role enum
    const validRoles = ['user', 'admin', 'sales', 'artist_management', 'operations'];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    // SECURITY: Prevent self-demotion
    if (req.params.id === req.user._id.toString() && role !== 'admin') {
      return res.status(403).json({ error: 'Cannot demote yourself. Another admin must change your role.' });
    }

    // SECURITY: Protect root admin
    const targetUser = await User.findById(req.params.id);
    if (targetUser && targetUser.email === 'REDACTED_ADMIN@example.com' && role !== 'admin') {
      return res.status(403).json({ error: 'Root Admin must retain administrative clearance.' });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user role' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    // SECURITY: Prevent deleting self or root admin
    if (req.params.id === req.user._id.toString()) {
      return res.status(403).json({ error: 'Cannot delete your own account' });
    }
    const targetUser = await User.findById(req.params.id);
    if (targetUser && targetUser.email === 'REDACTED_ADMIN@example.com') {
      return res.status(403).json({ error: 'Root Admin cannot be deleted' });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User de-authenticated and purged from nexus.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

exports.updateUserAdmin = async (req, res) => {
  try {
    const { name, email, phone, role, teams } = req.body;
    
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    if (role && role !== targetUser.role) {
      const validRoles = ['user', 'admin', 'sales', 'artist_management', 'operations'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
      }
      if (req.params.id === req.user._id.toString() && role !== 'admin') {
        return res.status(403).json({ error: 'Cannot demote yourself.' });
      }
      if (targetUser.email === 'REDACTED_ADMIN@example.com' && role !== 'admin') {
        return res.status(403).json({ error: 'Root Admin must retain administrative clearance.' });
      }
    }

    const updateFields = {};
    if (name !== undefined) updateFields.name = name;
    if (email !== undefined) updateFields.email = email.toLowerCase().trim();
    if (phone !== undefined) updateFields.phone = phone;
    if (role !== undefined) updateFields.role = role;
    if (teams !== undefined) updateFields.teams = Array.isArray(teams) ? teams.map(t => t.toUpperCase()) : [];

    const updatedUser = await User.findByIdAndUpdate(req.params.id, { $set: updateFields }, { new: true }).select('-password');
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getSalesReps = async (req, res) => {
  try {
    const reps = await User.find({ role: 'sales' }).select('_id name email avatar role online lastOnline phone');
    res.json(reps);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sales representatives' });
  }
};