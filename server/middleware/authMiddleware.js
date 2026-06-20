const User = require('../models/User');
const Artist = require('../models/Artist');
const Department = require('../models/Department');
const { runWithContext, getTraceId } = require('../utils/tenantContext');
const { loadAuthUser } = require('../utils/authUserLookup');
const { idFilter } = require('../utils/mongoId');

const authContext = (req, user) => ({
  tenantId: user.tenantId,
  userId: user._id?.toString?.() || user._id,
  traceId: req.traceId || getTraceId(),
});
const { getDefaultSeedPassword } = require('../utils/defaultPassword');
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

const lastOnlineWrites = new Map();
const LAST_ONLINE_INTERVAL_MS = 5 * 60 * 1000;

const touchLastOnline = (userId) => {
  const key = userId.toString();
  const now = Date.now();
  const lastWrite = lastOnlineWrites.get(key) || 0;
  if (now - lastWrite < LAST_ONLINE_INTERVAL_MS) return;
  lastOnlineWrites.set(key, now);
  User.updateOne(idFilter(userId), {
    $set: { lastOnline: new Date(), online: true },
  }).setOptions({ bypassTenant: true }).catch(() => {});
};

const { getTokenFromRequest } = require('../utils/authCookie');

/** Localhost dev bypass — never enabled in production (T0-14). */
const isDebugBypassEnabled = () => {
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.NODE_ENV === 'development'
    && String(process.env.DEBUG_BYPASS || '').trim() === 'true';
};

const protect = async (req, res, next) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ error: 'Not authorized, no token' });
  }

  try {
    const isBypassEnabled = isDebugBypassEnabled();
    const isLocalhost = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.ip);
    const bypassToken = process.env.DEBUG_BYPASS_TOKEN || 'bypass_token';
    if (isBypassEnabled && isLocalhost && token === bypassToken) {
      const adminDept = await Department.findOne({ slug: ADMIN_SLUG }).select('_id');
      const adminUser = adminDept
        ? await populateDepartment(User.findOne({ departmentId: adminDept._id }).select('-password'))
        : null;
      if (adminUser) {
        req.user = adminUser;
        req.tenantId = adminUser.tenantId;
        return runWithContext(authContext(req, adminUser), next);
      }
      return res.status(503).json({ error: 'No admin user available for bypass' });
    }

    const decoded = verifySessionToken(token);
    if (decoded.purpose) {
      return res.status(401).json({ error: 'Not authorized, token failed' });
    }
    const { isTokenRevoked } = require('../utils/tokenRevocation');
    if (await isTokenRevoked(decoded)) {
      return res.status(401).json({ error: 'Session revoked. Please sign in again.' });
    }
    if (isAbsoluteSessionExpired(decoded)) {
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }

    req.user = await loadAuthUser(decoded.id);
    if (req.user && decoded.jti) {
      const { touchSession } = require('../utils/sessionRegistry');
      await touchSession(decoded.id, decoded.jti, req);
    }

    if (!req.user) {
      return res.status(401).json({ error: 'User no longer exists' });
    }
    if (req.user.suspended) {
      clearAuthCookie(res, req);
      return res.status(403).json({ error: 'Account suspended. Contact an administrator.' });
    }

    touchLastOnline(req.user._id);

    req.tenantId = req.user.tenantId;
    runWithContext(authContext(req, req.user), next);
  } catch (error) {
    res.status(401).json({ error: 'Not authorized, token failed' });
  }
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

module.exports = {
  protect,
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
  isOps: isOpsUser,
  isArtistManager: isArtistManagerUser,
  isAdminUser,
  isSalesUser: require('../utils/departmentPermissions').isSalesUser,
};
