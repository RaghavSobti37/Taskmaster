const User = require('../models/User');
const Department = require('../models/Department');
const Task = require('../models/Task');
const TaskAssignment = require('../models/TaskAssignment');
const Project = require('../models/Project');
const { isAfter, subMinutes } = require('date-fns');
const logger = require('../utils/logger');
const { isAdminUser, ADMIN_SLUG, SALES_SLUG } = require('../utils/departmentPermissions');
const { buildUserMonthlyReport } = require('../services/monthlyReportService');
const { validatePasswordStrength } = require('../utils/passwordValidation');
const { isRootAdminEmail } = require('../../shared/rootAdminEmails');

const isUserOnline = (u) => {
  if (!u.lastOnline) return false;
  const fiveMinAgo = subMinutes(new Date(), 5);
  return isAfter(u.lastOnline, fiveMinAgo);
};

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
  if (!isRootAdminEmail(user.email)) return null;
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
    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .populate('departmentId', 'name slug permissionPreset pagePermissions')
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
    ]);

    const userIds = users.map((u) => u._id);

    const [taskStats, projects] = await Promise.all([
      userIds.length
        ? TaskAssignment.aggregate([
            { $match: { userId: { $in: userIds } } },
            {
              $lookup: {
                from: 'tasks',
                localField: 'taskId',
                foreignField: '_id',
                as: 'task',
              },
            },
            { $unwind: '$task' },
            { $match: { 'task.status': 'done' } },
            { $group: { _id: '$userId', tasksDone: { $sum: 1 } } },
          ])
        : [],
      userIds.length
        ? Project.find({
            $or: [{ owner: { $in: userIds } }, { members: { $in: userIds } }],
          })
            .select('_id name owner members')
            .lean()
        : [],
    ]);

    const tasksDoneByUser = Object.fromEntries(
      taskStats.map((row) => [row._id.toString(), row.tasksDone])
    );
    const userIdSet = new Set(userIds.map((id) => id.toString()));
    const projectsByUser = {};
    for (const project of projects) {
      const involved = new Set();
      if (project.owner) involved.add(project.owner.toString());
      (project.members || []).forEach((memberId) => involved.add(memberId.toString()));
      for (const uid of involved) {
        if (!userIdSet.has(uid)) continue;
        if (!projectsByUser[uid]) projectsByUser[uid] = [];
        projectsByUser[uid].push({ _id: project._id, name: project.name });
      }
    }

    const team = users.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      avatar: u.avatar,
      departmentId: u.departmentId,
      online: isUserOnline(u),
      lastOnline: u.lastOnline,
      tasksDone: tasksDoneByUser[u._id.toString()] || 0,
      projectsInvolved: projectsByUser[u._id.toString()] || [],
      teams: u.teams || [],
    }));

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
      .populate('departmentId', 'name slug permissionPreset pagePermissions');
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
      user.mustChangePassword = false;
      user.passwordChangedAt = new Date();
    }

    user.lastOnline = new Date();
    await user.save();

    const updatedUser = await User.findById(user._id)
      .select('-password')
      .populate('departmentId', 'name slug permissionPreset pagePermissions signupAllowed');
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
    const adminView = isAdminUser(req.user);

    const users = await User.find()
      .select(adminView ? '+password' : '-password')
      .populate('departmentId', 'name slug permissionPreset pagePermissions')
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments();

    const enriched = users.map((u) => {
      const doc = u.toObject ? u.toObject() : u;
      delete doc.password;
      return {
        ...doc,
        online: isUserOnline(u),
        ...(adminView ? { hasPassword: !!u.password } : {}),
      };
    });

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
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (isRootAdminEmail(targetUser.email)) {
      return res.status(403).json({ error: 'Root admin accounts are protected' });
    }

    const adminDept = await Department.findOne({ slug: ADMIN_SLUG });
    if (adminDept && targetUser.departmentId?.toString() === adminDept._id.toString()) {
      const adminUserCount = await User.countDocuments({ departmentId: adminDept._id });
      if (adminUserCount <= 1) {
        return res.status(403).json({ error: 'Cannot delete the last admin user' });
      }
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

exports.updateUserAdmin = async (req, res) => {
  try {
    const { name, email, phone, departmentId, teams, dateOfBirth, newPassword } = req.body;

    const targetUser = await User.findById(req.params.id).select('+password');
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

    if (name !== undefined) targetUser.name = name;
    if (email !== undefined) targetUser.email = email.toLowerCase().trim();
    if (phone !== undefined) targetUser.phone = phone;
    if (departmentId !== undefined) targetUser.departmentId = departmentId || null;
    if (teams !== undefined) targetUser.teams = Array.isArray(teams) ? teams.map((t) => t.toUpperCase()) : [];
    if (dateOfBirth !== undefined) {
      targetUser.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    }

    if (newPassword) {
      const passwordError = validatePasswordStrength(newPassword);
      if (passwordError) return res.status(400).json({ error: passwordError });
      targetUser.password = newPassword;
      targetUser.mustChangePassword = false;
      targetUser.passwordChangedAt = new Date();
    }

    await targetUser.save();

    const updatedUser = await User.findById(req.params.id)
      .select('-password')
      .populate('departmentId', 'name slug permissionPreset pagePermissions signupAllowed');
    res.json({ ...updatedUser.toObject(), hasPassword: !!targetUser.password });
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
      .populate('departmentId', 'name slug permissionPreset pagePermissions');
    res.json(reps);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sales representatives' });
  }
};

exports.getMonthlyReport = async (req, res) => {
  try {
    const report = await buildUserMonthlyReport(req.params.id, req.query.month);
    res.json(report);
  } catch (err) {
    if (err.message === 'User not found') return res.status(404).json({ error: err.message });
    if (err.message.includes('month')) return res.status(400).json({ error: err.message });
    logger.error('User', 'getMonthlyReport error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
};
