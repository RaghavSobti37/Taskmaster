const User = require('../models/User');
const { getArtistRepUsers } = require('./crmAssignment');
const { findUserByPatterns } = require('./primaryCallAssignee');
const { ARTIST_SLUG } = require('./departmentPermissions');

/** Named artist call reps — Akash, Rohith, Atharva (+ full artist-management dept). */
const NAMED_ASSIGNEE_PATTERNS = [/akash/i, /rohith/i, /atharva/i];

async function listArtistCallAssignees() {
  const byId = new Map();

  const deptReps = await getArtistRepUsers();
  for (const rep of deptReps) {
    byId.set(String(rep._id), {
      _id: rep._id,
      name: rep.name,
      email: rep.email,
      avatar: rep.avatar,
    });
  }

  for (const pattern of NAMED_ASSIGNEE_PATTERNS) {
    const user = await findUserByPatterns([pattern], ARTIST_SLUG)
      || await findUserByPatterns([pattern]);
    if (user?._id) {
      byId.set(String(user._id), {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      });
    }
  }

  return [...byId.values()].sort((a, b) =>
    String(a.name || '').localeCompare(String(b.name || '')));
}

async function resolveArtistCallAssigneeId(assigneeId) {
  if (!assigneeId) return null;
  const allowed = await listArtistCallAssignees();
  const match = allowed.find((u) => String(u._id) === String(assigneeId));
  return match?._id || null;
}

module.exports = {
  NAMED_ASSIGNEE_PATTERNS,
  listArtistCallAssignees,
  resolveArtistCallAssigneeId,
};
