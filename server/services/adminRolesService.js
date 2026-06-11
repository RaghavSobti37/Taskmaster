const Department = require('../models/Department');
const User = require('../models/User');
const { seedDepartments, DEFAULT_DEPARTMENTS } = require('./departmentService');
const { PRESET_VALUES } = require('../utils/departmentPermissions');
const {
  PAGE_GROUPS,
  PRESET_PAGES,
  validatePagePermissions,
  resolveDepartmentPages,
  departmentHasAdminAccess,
} = require('../utils/pagePermissions');
const { getProjectRoleCatalog } = require('../../shared/projectRoleCatalog');

const SYSTEM_SLUGS = new Set(DEFAULT_DEPARTMENTS.map((d) => d.slug));

const slugify = (name) => String(name || '')
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const uniqueSlug = async (base) => {
  let slug = base || 'role';
  let suffix = 0;
  while (await Department.findOne({ slug })) {
    suffix += 1;
    slug = `${base}-${suffix}`;
  }
  return slug;
};

const memberCountMap = async () => {
  const rows = await User.aggregate([
    { $match: { departmentId: { $ne: null } } },
    { $group: { _id: '$departmentId', count: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((r) => [r._id.toString(), r.count]));
};

const formatOrgRole = (dept, counts) => ({
  id: dept._id,
  name: dept.name,
  slug: dept.slug,
  permissionPreset: dept.permissionPreset,
  pagePermissions: resolveDepartmentPages(dept),
  memberCount: counts[dept._id.toString()] || 0,
  isSystem: SYSTEM_SLUGS.has(dept.slug),
  signupAllowed: dept.signupAllowed,
});

const ensureDepartments = async () => {
  let depts = await Department.find().sort('sortOrder').lean();
  if (depts.length === 0) {
    await seedDepartments();
    depts = await Department.find().sort('sortOrder').lean();
  }
  return depts;
};

const listRoles = async () => {
  const depts = await ensureDepartments();
  const counts = await memberCountMap();
  return {
    orgRoles: depts.map((dept) => formatOrgRole(dept, counts)),
    projectRoles: getProjectRoleCatalog(),
    pageRegistry: { groups: PAGE_GROUPS, presets: PRESET_PAGES },
  };
};

const createOrgRole = async ({ name, permissionPreset = 'standard', pagePermissions, signupAllowed = true }) => {
  if (!name?.trim()) {
    const err = new Error('name is required');
    err.status = 400;
    throw err;
  }
  if (!PRESET_VALUES.has(permissionPreset)) {
    const err = new Error('Invalid permission preset');
    err.status = 400;
    throw err;
  }

  let resolvedPages = PRESET_PAGES[permissionPreset] || PRESET_PAGES.standard;
  if (pagePermissions !== undefined) {
    const validation = validatePagePermissions(pagePermissions);
    if (!validation.valid) {
      const err = new Error(validation.error);
      err.status = 400;
      throw err;
    }
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

  const counts = await memberCountMap();
  return formatOrgRole(dept.toObject(), counts);
};

const updateOrgRole = async (id, { name, permissionPreset, pagePermissions, signupAllowed }) => {
  const dept = await Department.findById(id);
  if (!dept) {
    const err = new Error('Role not found');
    err.status = 404;
    throw err;
  }

  if (pagePermissions !== undefined) {
    const validation = validatePagePermissions(pagePermissions);
    if (!validation.valid) {
      const err = new Error(validation.error);
      err.status = 400;
      throw err;
    }
    if (departmentHasAdminAccess(dept) && !validation.pages.some((k) => k.startsWith('admin_') || k === 'campaigns')) {
      const adminDepts = await Department.find({}).lean();
      const otherAdminCount = adminDepts.filter(
        (d) => d._id.toString() !== dept._id.toString() && departmentHasAdminAccess(d)
      ).length;
      if (otherAdminCount === 0) {
        const err = new Error('Cannot remove admin access from the last admin role');
        err.status = 400;
        throw err;
      }
    }
    dept.pagePermissions = validation.pages;
  }

  if (permissionPreset !== undefined) {
    if (!PRESET_VALUES.has(permissionPreset)) {
      const err = new Error('Invalid permission preset');
      err.status = 400;
      throw err;
    }
    if (departmentHasAdminAccess(dept) && permissionPreset !== 'admin') {
      const adminDepts = await Department.find({}).lean();
      const otherAdminCount = adminDepts.filter(
        (d) => d._id.toString() !== dept._id.toString() && departmentHasAdminAccess(d)
      ).length;
      if (otherAdminCount === 0) {
        const err = new Error('Cannot demote the last admin role');
        err.status = 400;
        throw err;
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
  const counts = await memberCountMap();
  return formatOrgRole(dept.toObject(), counts);
};

const deleteOrgRole = async (id) => {
  const dept = await Department.findById(id);
  if (!dept) {
    const err = new Error('Role not found');
    err.status = 404;
    throw err;
  }

  if (SYSTEM_SLUGS.has(dept.slug)) {
    const err = new Error('Cannot delete a system role');
    err.status = 400;
    throw err;
  }

  const memberCount = await User.countDocuments({ departmentId: dept._id });
  if (memberCount > 0) {
    const err = new Error(`Cannot delete role with ${memberCount} assigned user(s)`);
    err.status = 400;
    throw err;
  }

  if (departmentHasAdminAccess(dept)) {
    const adminDepts = await Department.find({}).lean();
    const otherAdminCount = adminDepts.filter(
      (d) => d._id.toString() !== dept._id.toString() && departmentHasAdminAccess(d)
    ).length;
    if (otherAdminCount === 0) {
      const err = new Error('Cannot delete the last admin role');
      err.status = 400;
      throw err;
    }
  }

  await dept.deleteOne();
  return { success: true };
};

module.exports = {
  listRoles,
  createOrgRole,
  updateOrgRole,
  deleteOrgRole,
  SYSTEM_SLUGS,
};
