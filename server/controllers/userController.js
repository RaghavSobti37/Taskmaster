const User = require('../models/User');
const Department = require('../models/Department');
const Task = require('../models/Task');
const Project = require('../models/Project');
const { isAfter, subMinutes } = require('date-fns');
const logger = require('../utils/logger');
const { isAdminUser, ADMIN_SLUG, SALES_SLUG } = require('../utils/departmentPermissions');

const isUserOnline = (u) => {
  if (!u.lastOnline) return false;
  const fiveMinAgo = subMinutes(new Date(), 5);
  return isAfter(u.lastOnline, fiveMinAgo);
};

const WEAK_PASSWORDS = new Set([
  '1234', '12345', '123456', '1234567', '12345678', '123456789', '1234567890',
  'password', 'password1', 'password123', 'qwerty', 'qwerty123', 'admin', 'admin123',
  'letmein', 'welcome', 'monkey', 'dragon', 'master', 'abc123', 'iloveyou',
  'sunshine', 'princess', 'football', 'baseball', 'trustno1', '111111', '000000',
]);

const validatePasswordStrength = (password) => {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters long';
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return 'Password must contain at least one letter and one number';
  }
  const normalized = password.toLowerCase().trim();
  if (WEAK_PASSWORDS.has(normalized)) {
    return 'Password is too weak. Please choose a stronger password';
  }
  if (/^(.)\1+$/.test(password) || /^(\d+)$/.test(password)) {
    return 'Password is too weak. Please choose a stronger password';
  }
  return null;
};

const ROOT_ADMIN_EMAILS = new Set([
  'test@example.com',
  'REDACTED_ADMIN@example.com',
]);

async function validateDepartmentAssignment(departmentId, requester) {
  if (departmentId === null || departmentId === '' || departmentId === undefined) {
    return { ok: true, value: null };
  }
  const dept = await Department.findById(departmentId);
  if (!dept) return { ok: false, error: 'Department not found' };
  if (!isAdminUser(requester) && dept.signupAllowed === false) {
    return { ok: false, error: 'Cannot assign this department' };
  }
  return { ok: true, value: departmentId };
}

async function ensureRootAdminDepartment(user, departmentId) {
  if (!ROOT_ADMIN_EMAILS.has(user.email)) return null;
  const adminDept = await Department.findOne({ slug: ADMIN_SLUG });
  if (!adminDept) return 'Admin department not configured';
  if (departmentId && departmentId.toString() !== adminDept._id.toString()) {
    return 'Root Admin must retain Admin department.';
  }
  return null;
}

exports.getTeam = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const query = {};
    const users = await User.find(query)
      .select('-password')
      .populate('departmentId', 'name slug color')
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
          departmentId: u.departmentId,
          online: isUserOnline(u),
          lastOnline: u.lastOnline,
          tasksDone,
          projectsInvolved: projects.map((p) => ({ _id: p._id, name: p.name })),
          teams: u.teams || [],
        };
      })
    );
    res.json({
      team,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
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
    if (teams) update.teams = teams.map((t) => t.toUpperCase());

    const user = await User.findByIdAndUpdate(req.params.id, { $set: update }, { new: true })
      .select('-password')
      .populate('departmentId', 'name slug color');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  const { name, avatar, phone, departmentId, currentPassword, newPassword, teams, dateOfBirth } = req.body;
  try {
    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (name) user.name = name;
    if (avatar) user.avatar = avatar;
    if (phone) user.phone = phone;
    if (teams) user.teams = teams;
    if (dateOfBirth !== undefined) {
      user.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    }

    if (departmentId !== undefined) {
      const rootErr = await ensureRootAdminDepartment(user, departmentId);
      if (rootErr) return res.status(403).json({ error: rootErr });
      const check = await validateDepartmentAssignment(departmentId, req.user);
      if (!check.ok) return res.status(400).json({ error: check.error });
      user.departmentId = check.value;
    }

    if (currentPassword && newPassword) {
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) return res.status(400).json({ error: 'Current password incorrect' });
      const passwordError = validatePasswordStrength(newPassword);
      if (passwordError) return res.status(400).json({ error: passwordError });
      user.password = newPassword;
    }

    user.lastOnline = new Date();
    await user.save();

    const updatedUser = await User.findById(user._id)
      .select('-password')
      .populate('departmentId', 'name slug color signupAllowed');
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
      .populate('departmentId', 'name slug color')
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments();

    const enriched = users.map((u) => ({
      ...u._doc,
      online: isUserOnline(u),
    }));

    res.json({
      users: enriched,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(403).json({ error: 'Cannot delete your own account' });
    }
    const targetUser = await User.findById(req.params.id);
    if (targetUser && ROOT_ADMIN_EMAILS.has(targetUser.email)) {
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
    const { name, email, phone, departmentId, teams } = req.body;

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    if (departmentId !== undefined) {
      const rootErr = await ensureRootAdminDepartment(targetUser, departmentId);
      if (rootErr) return res.status(403).json({ error: rootErr });
      if (req.params.id === req.user._id.toString()) {
        const adminDept = await Department.findOne({ slug: ADMIN_SLUG });
        if (adminDept && departmentId && departmentId.toString() !== adminDept._id.toString()) {
          return res.status(403).json({ error: 'Cannot remove yourself from Admin department.' });
        }
      }
      const check = await validateDepartmentAssignment(departmentId, req.user);
      if (!check.ok) return res.status(400).json({ error: check.error });
    }

    const updateFields = {};
    if (name !== undefined) updateFields.name = name;
    if (email !== undefined) updateFields.email = email.toLowerCase().trim();
    if (phone !== undefined) updateFields.phone = phone;
    if (departmentId !== undefined) updateFields.departmentId = departmentId || null;
    if (teams !== undefined) updateFields.teams = Array.isArray(teams) ? teams.map((t) => t.toUpperCase()) : [];

    const updatedUser = await User.findByIdAndUpdate(req.params.id, { $set: updateFields }, { new: true })
      .select('-password')
      .populate('departmentId', 'name slug color signupAllowed');
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getSalesReps = async (req, res) => {
  try {
    const salesDept = await Department.findOne({ slug: SALES_SLUG });
    const filter = salesDept ? { departmentId: salesDept._id } : { _id: null };
    const reps = await User.find(filter)
      .select('_id name email avatar online lastOnline phone departmentId')
      .populate('departmentId', 'name slug color');
    res.json(reps);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sales representatives' });
  }
};
