const { isAdminUser } = require('../utils/departmentPermissions');

function canDeletePin(user, pin) {
  if (!user?._id || !pin?.createdBy) return false;
  const isCreator = String(pin.createdBy) === String(user._id);
  return isCreator || isAdminUser(user);
}

module.exports = { canDeletePin };
