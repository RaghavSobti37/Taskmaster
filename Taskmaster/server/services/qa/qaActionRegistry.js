/**
 * Layer 3 — Action registry: endpoint + method + required permission roles.
 * Roles map to department slugs / platform settings in the codebase.
 */
const {
  ADMIN_SLUG,
  OPS_SLUG,
  SALES_SLUG,
  ARTIST_SLUG,
} = require('../../utils/departmentPermissions');

/** QA role keys → department slug or special marker */
const QA_ROLE_DEFS = {
  admin: { slug: ADMIN_SLUG, label: 'Admin' },
  operations: { slug: OPS_SLUG, label: 'Operations' },
  sales: { slug: SALES_SLUG, label: 'Sales' },
  artist_management: { slug: ARTIST_SLUG, label: 'Artist Management' },
  user: { slug: null, label: 'User', preset: 'standard' },
  manager: { slug: null, label: 'Manager', projectRole: 'manager' },
  platform_owner: { slug: null, label: 'Platform Owner', platformOwner: true },
};

/**
 * Each action: id, label, method, url (may include :id), allowedRoles, deniedRoles, category.
 * allowedRoles: roles that should get 2xx. deniedRoles: roles that should get 401/403.
 * Empty allowedRoles + guest in deniedRoles = auth required.
 */
const QA_ACTIONS = [
  {
    id: 'tasks-list',
    label: 'List tasks',
    method: 'GET',
    url: '/api/tasks',
    allowedRoles: ['admin', 'operations', 'sales', 'artist_management', 'user', 'manager', 'platform_owner'],
    category: 'permission',
    sev: 'high',
  },
  {
    id: 'tasks-create',
    label: 'Create task',
    method: 'POST',
    url: '/api/tasks',
    allowedRoles: ['admin', 'operations', 'sales', 'artist_management', 'user', 'manager', 'platform_owner'],
    payloadHint: '{ title, projectId }',
    category: 'permission',
    sev: 'high',
  },
  {
    id: 'crm-leads-list',
    label: 'List CRM leads',
    method: 'GET',
    url: '/api/crm/leads',
    allowedRoles: ['admin', 'sales', 'operations', 'platform_owner'],
    deniedRoles: ['user'],
    category: 'permission',
    sev: 'critical',
  },
  {
    id: 'crm-leads-create',
    label: 'Create CRM lead',
    method: 'POST',
    url: '/api/crm/leads',
    allowedRoles: ['admin', 'sales', 'platform_owner'],
    deniedRoles: ['user'],
    payloadHint: '{ name, email, phone }',
    category: 'permission',
    sev: 'critical',
  },
  {
    id: 'finance-list',
    label: 'List finance documents',
    method: 'GET',
    url: '/api/finance',
    allowedRoles: ['admin', 'operations', 'platform_owner'],
    deniedRoles: ['sales', 'user'],
    category: 'permission',
    sev: 'critical',
  },
  {
    id: 'finance-approve',
    label: 'Approve finance document',
    method: 'PATCH',
    url: '/api/finance/:id/approve',
    allowedRoles: ['admin', 'operations', 'platform_owner'],
    deniedRoles: ['sales', 'user'],
    dynamicId: 'finance',
    category: 'permission',
    sev: 'critical',
  },
  {
    id: 'attendance-list',
    label: 'List attendance',
    method: 'GET',
    url: '/api/attendance',
    allowedRoles: ['admin', 'operations', 'platform_owner'],
    deniedRoles: [],
    category: 'permission',
    sev: 'medium',
  },
  {
    id: 'data-hub-reconcile',
    label: 'Data Hub Auto-Mailer handoff',
    method: 'POST',
    url: '/api/data-hub/reconcile',
    allowedRoles: ['admin', 'operations', 'sales', 'artist_management', 'user', 'manager', 'platform_owner'],
    deniedRoles: [],
    category: 'permission',
    sev: 'medium',
  },
  {
    id: 'admin-roles-list',
    label: 'Admin roles list',
    method: 'GET',
    url: '/api/admin/roles',
    allowedRoles: ['admin', 'platform_owner'],
    deniedRoles: ['user', 'sales'],
    category: 'permission',
    sev: 'critical',
  },
  {
    id: 'gamification-config',
    label: 'Gamification config read',
    method: 'GET',
    url: '/api/gamification/config',
    allowedRoles: ['admin', 'operations', 'sales', 'artist_management', 'user', 'manager', 'platform_owner'],
    category: 'permission',
    sev: 'low',
  },
  {
    id: 'artists-list',
    label: 'List artists',
    method: 'GET',
    url: '/api/artists',
    allowedRoles: ['admin', 'artist_management', 'platform_owner'],
    deniedRoles: ['user'],
    category: 'permission',
    sev: 'high',
  },
  {
    id: 'departments-list',
    label: 'Departments list',
    method: 'GET',
    url: '/api/departments',
    allowedRoles: ['admin', 'operations', 'sales', 'artist_management', 'user', 'manager', 'platform_owner'],
    category: 'permission',
    sev: 'low',
  },
];

function getActionById(id) {
  return QA_ACTIONS.find((a) => a.id === id);
}

function getAllActions() {
  return QA_ACTIONS;
}

function getRoleDefs() {
  return QA_ROLE_DEFS;
}

function roleShouldAllow(action, roleKey) {
  if (action.allowedRoles?.includes(roleKey)) return true;
  if (action.deniedRoles?.includes(roleKey)) return false;
  return action.allowedRoles?.length ? false : true;
}

module.exports = {
  QA_ROLE_DEFS,
  QA_ACTIONS,
  getActionById,
  getAllActions,
  getRoleDefs,
  roleShouldAllow,
};
