const Department = require('../models/Department');
const TaskType = require('../models/TaskType');
const Task = require('../models/Task');
const TaskAssignment = require('../models/TaskAssignment');
const User = require('../models/User');

const { PRESET_PAGES } = require('../utils/pagePermissions');

const DEFAULT_DEPARTMENTS = [
  { name: 'Admin', slug: 'admin', sortOrder: 0, signupAllowed: false, permissionPreset: 'admin', pagePermissions: PRESET_PAGES.admin },
  { name: 'Artist Management', slug: 'artist-management', sortOrder: 1, signupAllowed: true, permissionPreset: 'artist-management', pagePermissions: PRESET_PAGES['artist-management'] },
  { name: 'Artist Business', slug: 'artist-business', sortOrder: 2, signupAllowed: false, permissionPreset: 'artist-business', pagePermissions: PRESET_PAGES['artist-business'] },
  { name: 'Operations', slug: 'ops', sortOrder: 3, signupAllowed: true, permissionPreset: 'ops', pagePermissions: PRESET_PAGES.ops },
  { name: 'Sales', slug: 'sales', sortOrder: 4, signupAllowed: true, permissionPreset: 'sales', pagePermissions: PRESET_PAGES.sales },
  { name: 'Creative', slug: 'creative', sortOrder: 5, signupAllowed: true, permissionPreset: 'creative', pagePermissions: PRESET_PAGES.creative },
];

const BASE_ROLE_SLUGS = new Set(DEFAULT_DEPARTMENTS.map((d) => d.slug));

/** General task categories (replaces granular Edit/Final Cut/etc. duplicates). */
const TASK_CATEGORIES = [
  { value: 'bug', label: 'Bug', keywords: ['bug', 'fix', 'error', 'broken', 'defect'] },
  { value: 'feature', label: 'Feature', keywords: ['feature', 'build', 'implement', 'add', 'new'] },
  { value: 'content', label: 'Content', keywords: ['edit', 'cut', 'grading', 'dubbing', 'color', 'mix', 'export', 'film', 'audio', 'video', 'rushes', 'compression'] },
  { value: 'design', label: 'Design', keywords: ['design', 'ui', 'mockup', 'layout', 'visual'] },
  { value: 'ops', label: 'Operations', keywords: ['plan', 'planning', 'schedule', 'support', 'ops', 'operation', 'deploy'] },
  { value: 'review', label: 'Review', keywords: ['review', 'approve', 'feedback', 'qa', 'check'] },
  { value: 'sales', label: 'Sales', keywords: ['sales', 'deal', 'client', 'lead', 'crm', 'pitch', 'prospect', 'call', 'follow up', 'followup', 'pipeline', 'quota'] },
  { value: 'general', label: 'General', keywords: [] },
];

const slugToDeptName = {
  creative: 'Creative',
  ops: 'Operations',
  operations: 'Operations',
  sales: 'Sales',
  'artist-management': 'Artist Management',
};

const migrateLegacyOpsSlug = async () => {
  const legacyOps = await Department.findOne({ slug: 'operations' });
  const opsDept = await Department.findOne({ slug: 'ops' });
  if (legacyOps && !opsDept) {
    legacyOps.slug = 'ops';
    if (legacyOps.permissionPreset === 'operations') legacyOps.permissionPreset = 'ops';
    await legacyOps.save();
  }
};

const inferTypeFromTitle = (title) => {
  if (!title || !String(title).trim()) return 'general';
  const upper = String(title).toUpperCase();
  for (const cat of TASK_CATEGORIES) {
    if (cat.keywords.some((kw) => upper.includes(kw.toUpperCase()))) {
      return cat.value;
    }
  }
  return 'general';
};

const seedDepartmentsForTenant = async (tenantId) => {
  if (!tenantId) throw new Error('tenantId required to seed departments');
  const { runWithContext } = require('../utils/tenantContext');
  return runWithContext({ tenantId: String(tenantId) }, async () => {
    await migrateLegacyOpsSlug();
    const results = [];
    for (const dept of DEFAULT_DEPARTMENTS) {
      const existing = await Department.findOne({ slug: dept.slug });
      if (!existing) {
        results.push(await Department.create(dept));
      } else {
        let changed = false;
        if (dept.permissionPreset && !existing.permissionPreset) {
          existing.permissionPreset = dept.permissionPreset;
          changed = true;
        }
        if (dept.pagePermissions?.length && (!existing.pagePermissions || existing.pagePermissions.length === 0)) {
          existing.pagePermissions = dept.pagePermissions;
          changed = true;
        }
        if (dept.slug === 'artist-management') {
          const presetPages = PRESET_PAGES['artist-management'];
          const current = existing.pagePermissions || [];
          const merged = [...new Set([...current, ...presetPages])];
          if (merged.length !== current.length || !current.includes('artists')) {
            existing.pagePermissions = merged;
            existing.permissionPreset = 'artist-management';
            changed = true;
          }
        }
        if (changed) await existing.save();
        results.push(existing);
      }
    }
    return results;
  });
};

/** @deprecated use seedDepartmentsForTenant inside tenant context */
const seedDepartments = async () => {
  const { getTenantId } = require('../utils/tenantContext');
  let tenantId = getTenantId();
  if (!tenantId) {
    if (process.env.NODE_ENV === 'test') {
      const { ensurePlatformTenant } = require('../utils/defaultTenant');
      tenantId = await ensurePlatformTenant();
    } else {
      throw new Error('tenantId required to seed departments');
    }
  }
  return seedDepartmentsForTenant(tenantId);
};

const mineTaskTypes = async () => {
  const departments = await Department.find().lean();
  const deptBySlug = Object.fromEntries(departments.map((d) => [d.slug, d]));

  const tasks = await Task.find({}, 'title type').lean();
  const assignments = await TaskAssignment.find({}).populate('userId', 'departmentId').lean();

  const taskAssigneeDepts = {};
  for (const a of assignments) {
    const deptId = a.userId?.departmentId?.toString();
    if (deptId) {
      taskAssigneeDepts[a.taskId.toString()] = deptId;
    }
  }

  const typeMap = new Map();

  for (const task of tasks) {
    const typeName = inferTypeFromTitle(task.title);
    const deptId = taskAssigneeDepts[task._id.toString()] || null;
    const key = `${typeName}::${deptId || 'global'}`;
    typeMap.set(key, (typeMap.get(key) || 0) + 1);
  }

  const created = [];
  for (const [key, count] of typeMap.entries()) {
    if (count < 1) continue;
    const sep = key.lastIndexOf('::');
    const name = sep >= 0 ? key.slice(0, sep) : key;
    const deptPart = sep >= 0 ? key.slice(sep + 2) : 'global';
    const departmentId = deptPart === 'global' ? null : deptPart;
    const exists = await TaskType.findOne({ name, ...(departmentId ? { departmentId } : { departmentId: null }) });
    if (!exists) {
      created.push(await TaskType.create({ name, ...(departmentId ? { departmentId } : {}), isActive: true }));
    }
  }

  for (const cat of TASK_CATEGORIES) {
    for (const slug of Object.keys(slugToDeptName)) {
      const dept = deptBySlug[slug];
      if (!dept) continue;
      const exists = await TaskType.findOne({ name: cat.value, departmentId: dept._id });
      if (!exists) {
        created.push(await TaskType.create({ name: cat.value, departmentId: dept._id, isActive: true }));
      }
    }
    const globalExists = await TaskType.findOne({ name: cat.value, departmentId: null });
    if (!globalExists) {
      created.push(await TaskType.create({ name: cat.value, departmentId: null, isActive: true }));
    }
  }

  return { mined: typeMap.size, created: created.length, types: created };
};

module.exports = {
  DEFAULT_DEPARTMENTS,
  BASE_ROLE_SLUGS,
  seedDepartments,
  seedDepartmentsForTenant,
  mineTaskTypes,
  inferTypeFromTitle,
  TASK_CATEGORIES,
};
