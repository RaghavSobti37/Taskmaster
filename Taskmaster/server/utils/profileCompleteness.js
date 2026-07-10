const PLACEHOLDER_PHONES = new Set(['', '+91', '+91 ']);

const digitsOnly = (value = '') => String(value).replace(/\D/g, '');

const isPhoneMissing = (phone) => {
  const trimmed = String(phone || '').trim();
  if (PLACEHOLDER_PHONES.has(trimmed)) return true;
  return digitsOnly(trimmed).length < 10;
};

const isDobMissing = (dateOfBirth) => {
  if (!dateOfBirth) return true;
  const d = new Date(dateOfBirth);
  return Number.isNaN(d.getTime());
};

const needsPasswordChange = (user) => Boolean(user?.mustChangePassword) && !user?.clerkId;

/** Google OAuth-only accounts with no saved password may set one without the OAuth seed. */
const canSetPasswordWithoutCurrent = (user) => {
  if (needsPasswordChange(user)) return true;
  return Boolean(user?.googleId) && !user?.passwordChangedAt && !user?.password;
};

const getProfileCompletionIssues = (user) => {
  if (!user) return [];

  const issues = [];

  if (isPhoneMissing(user.phone)) {
    issues.push({
      id: 'phone',
      message: 'Add your phone number in Profile settings.',
    });
  }

  if (isDobMissing(user.dateOfBirth)) {
    issues.push({
      id: 'dob',
      message: 'Add your date of birth in Profile settings.',
    });
  }

  if (needsPasswordChange(user)) {
    issues.push({
      id: 'password',
      message: 'Change your default password. Contact Raghav if you need help.',
    });
  }

  return issues;
};

const attachProfileCompletion = (user) => {
  if (!user) return user;
  const plain = user.toObject ? user.toObject() : { ...user };
  const issues = getProfileCompletionIssues(plain);
  return {
    ...plain,
    profileCompletion: {
      complete: issues.length === 0,
      needsPhone: issues.some((i) => i.id === 'phone'),
      needsDob: issues.some((i) => i.id === 'dob'),
      needsPasswordChange: issues.some((i) => i.id === 'password'),
      issues,
    },
    authProviders: {
      google: Boolean(plain.googleId),
      canSetPasswordWithoutCurrent: canSetPasswordWithoutCurrent(plain),
    },
  };
};

module.exports = {
  isPhoneMissing,
  isDobMissing,
  needsPasswordChange,
  canSetPasswordWithoutCurrent,
  getProfileCompletionIssues,
  attachProfileCompletion,
};
