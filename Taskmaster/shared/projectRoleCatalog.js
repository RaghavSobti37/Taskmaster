const { PROJECT_ROLE_RANK } = require('./projectRoles');

/** Read-only project role reference for admin UI (fixed enum — not tenant-customizable). */
const PROJECT_ROLE_DEFINITIONS = [
  {
    key: 'admin',
    label: 'Admin',
    rank: PROJECT_ROLE_RANK.admin,
    description: 'Full project control; project owner maps here.',
    capabilities: [
      'Manage project settings and members',
      'Create, edit, and delete tasks',
      'Assign and review work',
    ],
  },
  {
    key: 'manager',
    label: 'Manager',
    rank: PROJECT_ROLE_RANK.manager,
    description: 'Elevated project access below admin (legacy artist_management maps here).',
    capabilities: [
      'Manage most project tasks and members',
      'Assign work to team members',
    ],
  },
  {
    key: 'member',
    label: 'Member',
    rank: PROJECT_ROLE_RANK.member,
    description: 'Default collaborator — can mutate project tasks.',
    capabilities: [
      'Create and edit assigned tasks',
      'Comment and collaborate on work',
    ],
  },
  {
    key: 'viewer',
    label: 'Viewer',
    rank: PROJECT_ROLE_RANK.viewer,
    description: 'Read-only project access.',
    capabilities: [
      'View project tasks and activity',
      'Cannot create or edit tasks',
    ],
  },
];

const getProjectRoleCatalog = () =>
  PROJECT_ROLE_DEFINITIONS.map((role) => ({ ...role, editable: false }));

module.exports = {
  PROJECT_ROLE_DEFINITIONS,
  getProjectRoleCatalog,
};
