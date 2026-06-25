const User = require('../models/User');
const { getArtistRepUsers } = require('./crmAssignment');
const { findUserByPatterns, resolvePrimaryCallAssigneeId } = require('./primaryCallAssignee');
const { ARTIST_SLUG } = require('./departmentPermissions');
const {
  ASSIGNEE_KEY_PATTERNS,
  resolveAssigneeKeyFromSheetName,
} = require('../../shared/artistCrmSheetAssignees');

/** Named artist call reps (+ full artist-management dept). */
const NAMED_ASSIGNEE_PATTERNS = [
  /akash/i,
  /rohith/i,
  /atharva/i,
  /harshika/i,
  /deepank/i,
];

function extractAssigneeTokensFromSheetName(sheetName) {
  const base = String(sheetName || '').replace(/\.csv$/i, '').trim();
  if (!base) return [];

  const dashMatch = base.match(/\s[-–—]\s+(.+)$/);
  if (!dashMatch) return [];

  return dashMatch[1]
    .split(/\s*&\s*|\s+and\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function matchAssigneeToken(token, assignee) {
  const tokenNorm = String(token || '').toLowerCase().trim();
  const name = String(assignee?.name || '').toLowerCase().trim();
  if (!tokenNorm || !name) return false;

  if (name === tokenNorm || name.includes(tokenNorm) || tokenNorm.includes(name)) {
    return true;
  }

  const nameParts = name.split(/\s+/).filter(Boolean);
  const tokenParts = tokenNorm.split(/\s+/).filter(Boolean);
  if (nameParts[0] && tokenParts[0] && nameParts[0] === tokenParts[0]) {
    return true;
  }

  if (tokenNorm.length <= 4 && nameParts.length > 1) {
    const initials = nameParts.map((p) => p[0]).join('').toLowerCase();
    if (initials === tokenNorm) return true;
  }

  return false;
}

function findAssigneeByKey(assigneeKey, assignees = []) {
  const patterns = ASSIGNEE_KEY_PATTERNS[assigneeKey] || [];
  if (!patterns.length) return null;
  return assignees.find((rep) =>
    patterns.some((re) => re.test(String(rep?.name || ''))));
}

function matchAssigneeFromSheetName(sheetName, assignees = []) {
  const ruleHit = resolveAssigneeKeyFromSheetName(sheetName);
  if (ruleHit?.assigneeKey) {
    const rep = findAssigneeByKey(ruleHit.assigneeKey, assignees);
    if (rep) {
      return {
        assigneeId: rep._id,
        assigneeName: rep.name,
        source: 'sheet_rule',
        matchedToken: ruleHit.ruleLabel,
        ruleKey: ruleHit.ruleKey,
        sheetName: ruleHit.sheetName,
      };
    }
  }

  const tokens = extractAssigneeTokensFromSheetName(sheetName);
  for (const token of tokens) {
    const hit = assignees.find((rep) => matchAssigneeToken(token, rep));
    if (hit) {
      return {
        assigneeId: hit._id,
        assigneeName: hit.name,
        source: 'sheet_name',
        matchedToken: token,
        sheetName,
      };
    }
  }
  return null;
}

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

async function resolveAssigneeForImport({ sheetName, manualAssigneeId } = {}) {
  const assignees = await listArtistCallAssignees();
  const fromSheet = sheetName ? matchAssigneeFromSheetName(sheetName, assignees) : null;
  if (fromSheet) return fromSheet;

  const manualId = await resolveArtistCallAssigneeId(manualAssigneeId);
  if (manualId) {
    const rep = assignees.find((u) => String(u._id) === String(manualId));
    return {
      assigneeId: manualId,
      assigneeName: rep?.name || 'Selected rep',
      source: 'manual',
      sheetName,
    };
  }

  const fallbackId = await resolvePrimaryCallAssigneeId();
  if (fallbackId) {
    const rep = assignees.find((u) => String(u._id) === String(fallbackId));
    return {
      assigneeId: fallbackId,
      assigneeName: rep?.name || 'Default rep',
      source: 'default',
      sheetName,
    };
  }

  return null;
}

module.exports = {
  NAMED_ASSIGNEE_PATTERNS,
  extractAssigneeTokensFromSheetName,
  matchAssigneeToken,
  findAssigneeByKey,
  matchAssigneeFromSheetName,
  resolveAssigneeForImport,
  listArtistCallAssignees,
  resolveArtistCallAssigneeId,
};
