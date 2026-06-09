const User = require('../models/User');
const { idFilter } = require('./mongoId');

const DEPARTMENT_POPULATE = 'name slug signupAllowed permissionPreset pagePermissions';
const BYPASS = { bypassTenant: true };

const findUserById = (userId, options = {}) => {
  const { withPassword = false, select } = options;
  let query = User.findOne(idFilter(userId)).setOptions(BYPASS);
  if (withPassword) query = query.select('+password');
  else if (select) query = query.select(select);
  else query = query.select('-password');
  return query;
};

const loadAuthUser = (userId) =>
  findUserById(userId).populate('departmentId', DEPARTMENT_POPULATE);

module.exports = {
  findUserById,
  loadAuthUser,
  DEPARTMENT_POPULATE,
};
