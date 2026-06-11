const express = require('express');
const router = express.Router();
const Department = require('../models/Department');
const User = require('../models/User');
const TaskType = require('../models/TaskType');
const { protect, requireAnyPageAccess } = require('../middleware/authMiddleware');

const deptAdminAccess = requireAnyPageAccess('admin_users', 'admin_roles');
const { seedDepartments } = require('../services/departmentService');
const { PRESET_VALUES } = require('../utils/departmentPermissions');
const {
  PAGE_GROUPS,
  PRESET_PAGES,
  validatePagePermissions,
  departmentHasAdminAccess,
} = require('../utils/pagePermissions');
const {
  buildDepartmentMonthlyReport,
  buildTeamMonthlyReport,
} = require('../services/monthlyReportService');
const logger = require('../utils/logger');

const slugify = (name) => String(name || '')
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const uniqueSlug = async (base) => {
  let slug = base || 'department';
  let suffix = 0;
  while (await Department.findOne({ slug })) {
    suffix += 1;
    slug = `${base}-${suffix}`;
  }
  return slug;
};

router.get('/public', async (req, res) => {
  try {
    let depts = await Department.find({ signupAllowed: true }).sort('sortOrder').lean();
    if (depts.length === 0) {
      await seedDepartments();
      depts = await Department.find({ signupAllowed: true }).sort('sortOrder').lean();
    }
    res.json(depts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.use(protect);

router.get('/page-registry', deptAdminAccess, (req, res) => {
  res.json({ groups: PAGE_GROUPS, presets: PRESET_PAGES });
});

router.get('/', async (req, res) => {
  try {
    let depts = await Department.find().sort('sortOrder').lean();
    if (depts.length === 0) {
      await seedDepartments();
      depts = await Department.find().sort('sortOrder').lean();
    }
    res.json(depts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/team/monthly-report', deptAdminAccess, async (req, res) => {
  try {
    const report = await buildTeamMonthlyReport(req.query.month, req.query);
    res.json(report);
  } catch (err) {
    logger.error('Department', 'team monthly report error', { error: err.message });
    res.status(err.message.includes('month') ? 400 : 500).json({ error: err.message });
  }
});

router.get('/task-types', async (req, res) => {
  try {
    const { departmentId, projectRole } = req.query;
    const filter = { isActive: true };
    const orConditions = [];
    if (departmentId) {
      orConditions.push({ departmentId }, { departmentId: null });
    }
    if (projectRole) {
      orConditions.push({ projectRole }, { projectRole: null });
    }
    if (orConditions.length) filter.$or = orConditions;
    const types = await TaskType.find(filter).sort('name').lean();
    res.json(types);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/monthly-report', deptAdminAccess, async (req, res) => {
  try {
    const report = await buildDepartmentMonthlyReport(req.params.id, req.query.month, req.query);
    res.json(report);
  } catch (err) {
    logger.error('Department', 'department monthly report error', { error: err.message, departmentId: req.params.id });
    const status = err.message === 'Department not found' ? 404
      : err.message.includes('month') ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

router.post('/', deptAdminAccess, async (req, res) => {
  try {
    const {
      name,
      permissionPreset = 'standard',
      signupAllowed = true,
      pagePermissions,
    } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
    if (!PRESET_VALUES.has(permissionPreset)) {
      return res.status(400).json({ error: 'Invalid permission preset' });
    }

    let resolvedPages = PRESET_PAGES[permissionPreset] || PRESET_PAGES.standard;
    if (pagePermissions !== undefined) {
      const validation = validatePagePermissions(pagePermissions);
      if (!validation.valid) return res.status(400).json({ error: validation.error });
      resolvedPages = validation.pages;
    }

    const baseSlug = slugify(name);
    const slug = await uniqueSlug(baseSlug);
    const maxOrder = await Department.findOne().sort('-sortOrder').select('sortOrder').lean();
    const sortOrder = (maxOrder?.sortOrder ?? -1) + 1;

    const dept = await Department.create({
      name: name.trim(),
      slug,
      permissionPreset,
      pagePermissions: resolvedPages,
      signupAllowed: !!signupAllowed,
      sortOrder,
    });
    res.status(201).json(dept);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', deptAdminAccess, async (req, res) => {
  try {
    const dept = await Department.findById(req.params.id);
    if (!dept) return res.status(404).json({ error: 'Department not found' });

    const { name, permissionPreset, signupAllowed, pagePermissions } = req.body;

    if (pagePermissions !== undefined) {
      const validation = validatePagePermissions(pagePermissions);
      if (!validation.valid) return res.status(400).json({ error: validation.error });
      if (departmentHasAdminAccess(dept) && !validation.pages.some((k) => k.startsWith('admin_') || k === 'campaigns')) {
        const adminDepts = await Department.find({}).lean();
        const otherAdminCount = adminDepts.filter(
          (d) => d._id.toString() !== dept._id.toString() && departmentHasAdminAccess(d)
        ).length;
        if (otherAdminCount === 0) {
          return res.status(400).json({ error: 'Cannot remove admin access from the last admin department' });
        }
      }
      dept.pagePermissions = validation.pages;
    }

    if (permissionPreset !== undefined) {
      if (!PRESET_VALUES.has(permissionPreset)) {
        return res.status(400).json({ error: 'Invalid permission preset' });
      }
      if (departmentHasAdminAccess(dept) && permissionPreset !== 'admin') {
        const adminDepts = await Department.find({}).lean();
        const otherAdminCount = adminDepts.filter(
          (d) => d._id.toString() !== dept._id.toString() && departmentHasAdminAccess(d)
        ).length;
        if (otherAdminCount === 0) {
          return res.status(400).json({ error: 'Cannot demote the last admin department' });
        }
      }
      dept.permissionPreset = permissionPreset;
      if (pagePermissions === undefined) {
        dept.pagePermissions = PRESET_PAGES[permissionPreset] || PRESET_PAGES.standard;
      }
    }

    if (name !== undefined) dept.name = name.trim();
    if (signupAllowed !== undefined) dept.signupAllowed = !!signupAllowed;

    await dept.save();
    res.json(dept);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', deptAdminAccess, async (req, res) => {
  try {
    const dept = await Department.findById(req.params.id);
    if (!dept) return res.status(404).json({ error: 'Department not found' });

    const memberCount = await User.countDocuments({ departmentId: dept._id });
    if (memberCount > 0) {
      return res.status(400).json({ error: `Cannot delete department with ${memberCount} assigned member(s)` });
    }

    if (departmentHasAdminAccess(dept)) {
      const adminDepts = await Department.find({}).lean();
      const otherAdminCount = adminDepts.filter(
        (d) => d._id.toString() !== dept._id.toString() && departmentHasAdminAccess(d)
      ).length;
      if (otherAdminCount === 0) {
        return res.status(400).json({ error: 'Cannot delete the last admin department' });
      }
    }

    await dept.deleteOne();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/users/:userId', deptAdminAccess, async (req, res) => {
  try {
    const { departmentId } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { departmentId: departmentId || null },
      { new: true }
    ).populate('departmentId', 'name slug signupAllowed permissionPreset pagePermissions');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
