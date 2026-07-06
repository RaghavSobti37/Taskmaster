const User = require('../models/User');
const Artist = require('../models/Artist');
const Department = require('../models/Department');
const CustomRole = require('../models/CustomRole');
const { runWithContext, getTraceId } = require('../utils/tenantContext');
const { loadAuthUser } = require('../utils/authUserLookup');

const {
  resolveSessionTenantId,
  listActiveMemberships,
  getMembership,
  backfillMembershipFromUser,
  reconcileMembershipRole,
} = require('../services/tenantMembershipService');
const { rejectClientTenantSpoof } = require('./rejectClientTenantSpoof');

const applySessionTenant = async (req, user, decoded = null) => {
  try {
    await backfillMembershipFromUser(user);
  } catch (err) {
    // ponytail: parallel requests can still collide on unique index during deploy transition
    if (err?.code !== 11000) throw err;
  }
  const memberships = await listActiveMemberships(user._id);
  let tenantId = resolveSessionTenantId(decoded, user);
  const orgFirst = require('../utils/orgFirstAuth').isOrgFirstAuthEnabled();

  if (tenantId) {
    const membership = await getMembership(user._id, tenantId);
    if (!membership) {
      if (orgFirst && memberships.length > 0) {
        return { tenantId: null, needsTenantSelection: true };
      }
      if (memberships.length === 1) {
        return {
          tenantId: memberships[0].tenantId?._id || memberships[0].tenantId,
          needsTenantSelection: false,
        };
      }
      if (memberships.length > 1) {
        return { tenantId: null, needsTenantSelection: true };
      }
    }
    return { tenantId, needsTenantSelection: false };
  }

  if (orgFirst) {
    if (memberships.length > 0) {
      return { tenantId: null, needsTenantSelection: true };
    }
    return { tenantId: user.tenantId || null, needsTenantSelection: false };
  }

  if (memberships.length === 1) {
    tenantId = memberships[0].tenantId?._id || memberships[0].tenantId;
    return { tenantId, needsTenantSelection: false };
  }
  if (memberships.length > 1) {
    return { tenantId: null, needsTenantSelection: true };
  }
  return { tenantId: user.tenantId || null, needsTenantSelection: false };
};

const authContext = (req, user, tenantId) => ({
  tenantId: tenantId || user.tenantId,
  userId: user._id?.toString?.() || user._id,
  traceId: req.traceId || getTraceId(),
});

const { isRootAdminUser } = require('../../shared/platformUserIds');
const {
  isAdminUser,
  isOpsUser,
  isArtistManagerUser,
  hasPageAccess,
  hasAnyPageAccess,
  ADMIN_SLUG,
} = require('../utils/departmentPermissions');
const { verifySessionToken, isAbsoluteSessionExpired } = require('../utils/authSession');
const { clearAuthCookie } = require('../utils/authCookie');

const populateDepartment = (query) =>
  query.populate('departmentId', 'name slug signupAllowed permissionPreset pagePermissions');

const { COOKIE_NAME } = require('../utils/authCookie');

/** Localhost dev bypass — never enabled in production (T0-14). */
const isDebugBypassEnabled = () => {
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.NODE_ENV === 'development'
    && String(process.env.DEBUG_BYPASS || '').trim() === 'true';
};

/** CoreKnot session cookie only — never Clerk JWT via Authorization header. */
const getSessionTokenFromRequest = (req) => {
  if (req.cookies?.[COOKIE_NAME]) {
    return req.cookies[COOKIE_NAME];
  }
  return null;
};

/**
 * Resolve CoreKnot user from cookie/JWT without writing HTTP responses.
 * @returns {Promise<{ user: object|null, suspended?: boolean, bypassUnavailable?: boolean }>}
 */
const resolveRequestUser = async (req) => {
  const token = getSessionTokenFromRequest(req);
  if (!token) return { user: null };

  try {
    const isBypassEnabled = isDebugBypassEnabled();
    const isLocalhost = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.ip);
    const bypassToken = process.env.DEBUG_BYPASS_TOKEN || 'bypass_token';
    if (isBypassEnabled && isLocalhost && token === bypassToken) {
      const adminDept = await Department.findOne({ slug: ADMIN_SLUG }).select('_id');
      const adminUser = adminDept
        ? await populateDepartment(User.findOne({ departmentId: adminDept._id }).select('-password'))
        : null;
      if (adminUser) return { user: adminUser };
      return { user: null, bypassUnavailable: true };
    }

    const decoded = verifySessionToken(token);
    if (decoded.purpose) return { user: null };

    const { isTokenRevoked } = require('../utils/tokenRevocation');
    if (await isTokenRevoked(decoded)) return { user: null };
    if (isAbsoluteSessionExpired(decoded)) return { user: null };

    const user = await loadAuthUser(decoded.id);
    const isPageViewTelemetry = String(req.headers['x-telemetry'] || '').toLowerCase() === 'page-view';
    if (user && decoded.jti && !isPageViewTelemetry) {
      const { touchSession } = require('../utils/sessionRegistry');
      await touchSession(decoded.id, decoded.jti, req);
    }

    if (!user) return { user: null };
    if (user.suspended) return { user: null, suspended: true };

    return { user, decoded };
  } catch {
    return { user: null };
  }
};

/** Sets req.user when a valid session exists; never 401 for missing/invalid session. */
const optionalAuthenticate = async (req, res, next) => {
  const { user, suspended, decoded } = await resolveRequestUser(req);
  if (suspended) {
    req.sessionSuspended = true;
    return next();
  }
  if (!user) return next();
  const session = await applySessionTenant(req, user, decoded);
  if (session.tenantId) {
    await reconcileMembershipRole(user, session.tenantId);
  }
  req.user = user;
  req.tenantId = session.tenantId != null
    ? session.tenantId
    : (session.needsTenantSelection ? null : user.tenantId);
  req.needsTenantSelection = session.needsTenantSelection;
  return runWithContext(authContext(req, user, req.tenantId), next);
};

const protect = async (req, res, next) => {
  const token = getSessionTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ error: 'Not authorized, no token' });
  }

  const { user, suspended, bypassUnavailable, decoded } = await resolveRequestUser(req);
  if (bypassUnavailable) {
    return res.status(503).json({ error: 'No admin user available for bypass' });
  }
  if (suspended) {
    clearAuthCookie(res, req);
    return res.status(403).json({ error: 'Account suspended. Contact an administrator.' });
  }
  if (!user) {
    return res.status(401).json({ error: 'Not authorized, token failed' });
  }

  const session = await applySessionTenant(req, user, decoded);
  const path = req.originalUrl || req.url || '';
  const allowTenantSelection = /\/api\/auth\/me\b/.test(path)
    || /\/api\/tenants\/memberships\b/.test(path)
    || /\/api\/tenants\/select\b/.test(path)
    || /\/api\/tenants\/create\b/.test(path)
    || /\/api\/invites\//.test(path);
  if (session.needsTenantSelection && !allowTenantSelection) {
    return res.status(409).json({
      error: 'Tenant selection required',
      code: 'NEEDS_TENANT_SELECTION',
    });
  }

  let effectiveUser = user;
  if (session.tenantId) {
    const membership = await getMembership(user._id, session.tenantId);
    if (membership?.customRoleId) {
      const customRole = await CustomRole.findById(membership.customRoleId).select('pageKeys').lean();
      if (customRole?.pageKeys?.length) {
        const base = user.toObject ? user.toObject() : { ...user };
        effectiveUser = { ...base, pagePermissions: customRole.pageKeys };
      }
    }
  }

  req.user = effectiveUser;
  req.tenantId = session.tenantId != null
    ? session.tenantId
    : (session.needsTenantSelection ? null : user.tenantId);
  return rejectClientTenantSpoof(req, res, () => runWithContext(authContext(req, effectiveUser, req.tenantId), next));
};

const admin = (req, res, next) => {
  if (req.user && isAdminUser(req.user)) {
    next();
  } else {
    res.status(403).json({ error: 'Not authorized as an admin' });
  }
};

const opsOrAdmin = (req, res, next) => {
  if (req.user && isOpsUser(req.user)) {
    next();
  } else {
    res.status(403).json({ error: 'Not authorized — ops or admin required' });
  }
};

const requirePageAccess = (pageKey) => (req, res, next) => {
  if (req.user && hasPageAccess(req.user, pageKey)) {
    next();
  } else {
    res.status(403).json({ error: 'Not authorized — page access required' });
  }
};

const requireAnyPageAccess = (...pageKeys) => (req, res, next) => {
  if (req.user && hasAnyPageAccess(req.user, pageKeys)) {
    next();
  } else {
    res.status(403).json({ error: 'Not authorized — page access required' });
  }
};

const artistOrAdmin = (req, res, next) => {
  if (req.user && isArtistManagerUser(req.user)) {
    next();
  } else {
    res.status(403).json({ error: 'Not authorized — artist management or admin required' });
  }
};

const isUserOnArtistTeam = (user, team = []) => {
  if (!user) return false;
  const uid = String(user._id || user.id);
  return team.some((member) => String(member?._id || member) === uid);
};

const {
  hasArtistMembership,
  hasArtistOwnerRole,
} = require('../domains/artists/services/artistMembershipService');

const artistMembershipAccess = (permission) => async (req, res, next) => {
  if (req.user && isArtistManagerUser(req.user)) {
    return next();
  }
  const artistId = req.params.id;
  if (!artistId || !req.user) {
    return res.status(403).json({ error: 'Not authorized — artist management or team membership required' });
  }
  try {
    const ok = await hasArtistMembership(req.user, artistId, permission);
    if (ok) return next();
    return res.status(403).json({ error: 'Not authorized — artist management or team membership required' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/** OAuth connect sends artistId in body — mirror :id for membership checks. */
const artistBodyMembershipAccess = (permission) => async (req, res, next) => {
  if (req.body?.artistId && !req.params.id) {
    req.params = { ...req.params, id: String(req.body.artistId) };
  }
  return artistMembershipAccess(permission)(req, res, next);
};

/** Back-compat alias — delegates to ArtistMembership + legacy team[] check. */
const artistTeamOrAdmin = artistMembershipAccess();

const canManageArtistTeam = artistMembershipAccess('team');

const artistWorkspaceAccess = async (req, res, next) => {
  if (req.user && isArtistManagerUser(req.user)) {
    return next();
  }
  const artistId = req.params.id;
  if (!artistId || !req.user) {
    return res.status(403).json({ error: 'Not authorized — artist workspace access required' });
  }
  try {
    const ok = await hasArtistMembership(req.user, artistId);
    if (ok) return next();
    return res.status(403).json({ error: 'Not authorized — artist workspace access required' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const artistOwnerOrAdmin = async (req, res, next) => {
  if (req.user && isArtistManagerUser(req.user)) {
    return next();
  }
  const artistId = req.params.id;
  if (!artistId || !req.user) {
    return res.status(403).json({ error: 'Not authorized — artist owner or admin required' });
  }
  try {
    const ok = await hasArtistOwnerRole(req.user, artistId);
    if (ok) return next();
    return res.status(403).json({ error: 'Not authorized — artist owner or admin required' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const orgAccountsAccess = (req, res, next) => {
  if (req.user && (isArtistManagerUser(req.user) || isOpsUser(req.user))) {
    next();
  } else {
    res.status(403).json({ error: 'Not authorized — artist management, operations, or admin required' });
  }
};

const requirePlatformAdmin = (req, res, next) => {
  if (req.user && isRootAdminUser(req.user)) {
    return next();
  }
  return res.status(403).json({ error: 'Platform administrator access required' });
};

module.exports = {
  protect,
  optionalAuthenticate,
  applySessionTenant,
  resolveRequestUser,
  isDebugBypassEnabled,
  admin,
  opsOrAdmin,
  requirePageAccess,
  requireAnyPageAccess,
  artistOrAdmin,
  artistTeamOrAdmin,
  artistMembershipAccess,
  artistBodyMembershipAccess,
  /** Spec alias for artistMembershipAccess */
  artistMemberOrAdmin: artistMembershipAccess,
  canManageArtistTeam,
  artistWorkspaceAccess,
  artistOwnerOrAdmin,
  hasArtistMembership,
  isUserOnArtistTeam,
  orgAccountsAccess,
  requirePlatformAdmin,
  isOps: isOpsUser,
  isArtistManager: isArtistManagerUser,
  isAdminUser,
  isSalesUser: require('../utils/departmentPermissions').isSalesUser,
};
