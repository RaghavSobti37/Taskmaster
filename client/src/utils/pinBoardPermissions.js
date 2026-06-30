import { isAdminUser } from './departmentPermissions';

export function getPinAuthorId(pin) {
  const author = pin?.createdBy;
  if (!author) return null;
  return String(author._id || author);
}

export function canDeletePin(user, pin) {
  if (!user?._id || !pin) return false;
  if (isAdminUser(user)) return true;
  return getPinAuthorId(pin) === String(user._id);
}
