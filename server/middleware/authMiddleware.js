const { verifyToken, clerkClient } = require('@clerk/clerk-sdk-node');
const {
  verifySessionToken,
  isAbsoluteSessionExpired,
  refreshSessionIfDue,
} = require('../utils/authSession');
const User = require('../models/User');
const Department = require('../models/Department');
const { runWithContext, getTraceId } = require('../utils/tenantContext');

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
  ADMIN_SLUG,
} = require('../utils/departmentPermissions');

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
  User.findByIdAndUpdate(userId, {
    $set: { lastOnline: new Date(), online: true },
  }).catch(() => {});
};

const { getTokenFromRequest } = require('../utils/authCookie');

const protect = async (req, res, next) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ error: 'Not authorized, no token' });
  }

  try {
    const isBypassEnabled = process.env.NODE_ENV === 'development'
      && String(process.env.DEBUG_BYPASS).trim() === 'true';
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

    let email = null;

    if (process.env.CLERK_SECRET_KEY && process.env.CLERK_SECRET_KEY !== 'mock_clerk_secret') {
      try {
        const verified = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
        if (verified && verified.sub) {
          const clerkUser = await clerkClient.users.getUser(verified.sub);
          email = clerkUser.emailAddresses?.[0]?.emailAddress?.toLowerCase().trim();
        }
      } catch (clerkErr) {
        // Fallthrough to standard JWT
      }
    }

    if (email) {
      let dbUser = await populateDepartment(User.findOne({ email }));
      if (!dbUser) {
        dbUser = await User.create({
          name: email.split('@')[0],
          email,
          password: getDefaultSeedPassword(),
          mustChangePassword: true,
        });
        dbUser = await populateDepartment(User.findById(dbUser._id).select('-password'));
      }
      req.user = dbUser;
    } else {
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
      req.user = await populateDepartment(User.findById(decoded.id).select('-password'));
      if (req.user) {
        const refresh = refreshSessionIfDue(res, decoded);
        const { ensureSession, touchSession, rotateSession } = require('../utils/sessionRegistry');
        const { revokeToken } = require('../utils/tokenRevocation');
        if (decoded.jti) {
          await ensureSession(req, decoded.id, decoded);
        }
        if (refresh.refreshed && refresh.newDecoded) {
          await rotateSession(req, decoded.id, decoded.jti, refresh.newDecoded);
          if (decoded.jti) await revokeToken(decoded);
        } else if (decoded.jti) {
          await touchSession(decoded.id, decoded.jti);
        }
      }
    }

    if (!req.user) {
      return res.status(401).json({ error: 'User no longer exists' });
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

const artistOrAdmin = (req, res, next) => {
  if (req.user && isArtistManagerUser(req.user)) {
    next();
  } else {
    res.status(403).json({ error: 'Not authorized — artist management or admin required' });
  }
};

module.exports = {
  protect,
  admin,
  opsOrAdmin,
  artistOrAdmin,
  isOps: isOpsUser,
  isArtistManager: isArtistManagerUser,
  isAdminUser,
  isSalesUser: require('../utils/departmentPermissions').isSalesUser,
};
