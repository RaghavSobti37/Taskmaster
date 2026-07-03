/**
 * Explicit department-admin bypasses for task mutations.
 * Admins do NOT bypass: delegated completion rules, XP caps, or rollback permission checks.
 */
const { isAdminUser } = require('./departmentPermissions');
const { userIsProjectViewer } = require('../../shared/projectRoles');

/** Viewers cannot mutate tasks; admins can (unless they are viewers-only on project — rare). */
const adminBypassesProjectViewerBlock = (user) => isAdminUser(user);

/** Admins may assign users outside project scope (cross-team delegation). */
const adminBypassesAssigneeScopeCheck = (user, actorOnProject) =>
  isAdminUser(user) && !actorOnProject;

/** @mentioned users without assignment: view-only — admins are not mention-only. */
const userIsMentionOnlyOnTask = (user, { mentionOnly }) =>
  mentionOnly && !isAdminUser(user);

/** Mention-only users cannot edit tasks (view + activity read only). */
const canMentionOnlyUserUpdateTask = () => false;

module.exports = {
  adminBypassesProjectViewerBlock,
  adminBypassesAssigneeScopeCheck,
  userIsMentionOnlyOnTask,
  canMentionOnlyUserUpdateTask,
  userIsProjectViewer,
};
