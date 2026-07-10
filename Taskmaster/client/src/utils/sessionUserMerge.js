/** Merge a session/profile API payload into the current auth user snapshot. */
export function mergeSessionUser(prev, nextUser) {
  if (!nextUser) return prev;
  const merged = { ...prev, ...nextUser };
  if (typeof nextUser.mustChangePassword === 'boolean') {
    merged.mustChangePassword = nextUser.mustChangePassword;
  } else if (nextUser.profileCompletion?.needsPasswordChange === false) {
    merged.mustChangePassword = false;
  }
  return merged;
}
