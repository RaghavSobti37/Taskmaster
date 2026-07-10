import { isDepartmentAdmin } from './pagePermissions';

/** Returns user-facing block reason when org role cannot be deleted, or null if allowed. */
export function getOrgRoleDeleteBlockReason(role) {
  if (!role) return 'Role not found';
  if (role.isSystem) return 'System roles cannot be deleted';
  if (isDepartmentAdmin(role)) return 'Admin roles cannot be deleted';
  const count = role.memberCount || 0;
  if (count <= 0) return null;
  const noun = count === 1 ? 'user is' : 'users are';
  return `Cannot delete "${role.name}" — ${count} ${noun} still assigned. Reassign them in Users first.`;
}
