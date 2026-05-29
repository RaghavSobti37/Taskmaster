const ALL_CATEGORIES = ['task', 'review', 'crm', 'attendance', 'announcement', 'department', 'system'];

const DEPT_CATEGORY_MAP = {
  sales: ['crm'],
  operations: ['task', 'review', 'attendance', 'department', 'announcement', 'system'],
  admin: ['task', 'review', 'attendance', 'department', 'announcement', 'system'],
  editor: ['task', 'review', 'system'],
  videographer: ['task', 'review', 'system'],
  'cg-artist': ['task', 'review', 'system'],
  'artist-management': ['task', 'review', 'system'],
};

async function getAllowedCategoriesForUser(user) {
  if (user?.role === 'admin') return ALL_CATEGORIES;
  const Department = require('../models/Department');
  let slug = '';
  if (user?.departmentId) {
    const dept = await Department.findById(user.departmentId).select('slug').lean();
    slug = dept?.slug || '';
  }
  return DEPT_CATEGORY_MAP[slug] || ['task', 'system'];
}

module.exports = { ALL_CATEGORIES, getAllowedCategoriesForUser };
