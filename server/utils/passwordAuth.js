/** Normalize password input before hashing or comparing (trim only — preserves inner spaces). */
const normalizePasswordInput = (password) => {
  if (typeof password !== 'string') return password;
  return password.trim();
};

/** Try trimmed password first, then raw input for legacy accounts saved before trim normalization. */
const passwordCandidatesForCompare = (password) => {
  if (typeof password !== 'string') return [];
  const trimmed = password.trim();
  if (trimmed === password) return [trimmed];
  return [trimmed, password];
};

module.exports = {
  normalizePasswordInput,
  passwordCandidatesForCompare,
};
