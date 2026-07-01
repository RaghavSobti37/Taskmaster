import axios from 'axios';

function departmentNeedsHydration(dept) {
  if (!dept) return false;
  if (typeof dept === 'string') return true;
  if (typeof dept === 'object' && dept._id && !dept.slug) return true;
  return false;
}

/**
 * Session user sometimes carries departmentId as an unpopulated id ΓÇö breaks admin widgets + role label.
 * Admin dept is excluded from /public; use authenticated departments list when needed.
 */
export async function enrichUserDepartment(user) {
  if (!user || !departmentNeedsHydration(user.departmentId)) return user;

  const deptId = user.departmentId?._id || user.departmentId;
  if (!deptId) return user;

  try {
    const { data: departments } = await axios.get('/api/departments');
    const match = (departments || []).find((d) => String(d._id) === String(deptId));
    return match ? { ...user, departmentId: match } : user;
  } catch {
    return user;
  }
}
