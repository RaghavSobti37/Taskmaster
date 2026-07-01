const User = require('../models/User');
const { idFilter } = require('./mongoId');
const { getCache, setCache, deleteCache } = require('../services/cacheService');

const DEPARTMENT_POPULATE = 'name slug signupAllowed permissionPreset pagePermissions';
const BYPASS = { bypassTenant: true };
const AUTH_USER_CACHE_TTL_SECONDS = 45;

const findUserById = (userId, options = {}) => {
  const { withPassword = false, select } = options;
  let query = User.findOne(idFilter(userId)).setOptions(BYPASS);
  if (withPassword) query = query.select('+password');
  else if (select) query = query.select(select);
  else query = query.select('-password');
  return query;
};

const authUserCacheKey = (userId) => `auth:user:v2:${userId}`;

/** Hydrate drops populated refs; cache stores departmentId as ObjectId only. */
const serializeAuthUserForCache = (user) => {
  const plain = user.toObject();
  const dept = plain.departmentId;
  if (dept && typeof dept === 'object' && dept._id) {
    plain.departmentId = dept._id;
  }
  return plain;
};

const hydrateAuthUserFromCache = async (cached) => {
  const user = User.hydrate(cached);
  if (user.departmentId && !user.departmentId?.slug) {
    await user.populate('departmentId', DEPARTMENT_POPULATE);
  }
  if (!user.departmentId?.slug && cached?.departmentId) {
    const fresh = await findUserById(user._id)
      .select('departmentId')
      .populate('departmentId', DEPARTMENT_POPULATE);
    if (fresh?.departmentId?.slug) {
      user.departmentId = fresh.departmentId;
    }
  }
  return user;
};

const loadAuthUser = async (userId) => {
  const cacheKey = authUserCacheKey(userId);
  const cached = await getCache(cacheKey);
  if (cached) {
    return hydrateAuthUserFromCache(cached);
  }

  const user = await findUserById(userId).populate('departmentId', DEPARTMENT_POPULATE);
  if (user) {
    await setCache(cacheKey, serializeAuthUserForCache(user), AUTH_USER_CACHE_TTL_SECONDS);
  }
  return user;
};

const invalidateAuthUserCache = (userId) => deleteCache(authUserCacheKey(userId));

module.exports = {
  findUserById,
  loadAuthUser,
  invalidateAuthUserCache,
  DEPARTMENT_POPULATE,
  authUserCacheKey,
  serializeAuthUserForCache,
};
