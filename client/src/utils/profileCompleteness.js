/** Client mirror of server/utils/profileCompleteness.js — keep in sync */

const PLACEHOLDER_PHONES = new Set(['', '+91', '+91 ']);

const digitsOnly = (value = '') => String(value).replace(/\D/g, '');

export const isPhoneMissing = (phone) => {
  const trimmed = String(phone || '').trim();
  if (PLACEHOLDER_PHONES.has(trimmed)) return true;
  return digitsOnly(trimmed).length < 10;
};

export const isDobMissing = (dateOfBirth) => {
  if (!dateOfBirth) return true;
  const d = new Date(dateOfBirth);
  return Number.isNaN(d.getTime());
};

export const getProfileCompletionIssues = (user) => {
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

  if (user.mustChangePassword && !user.clerkId) {
    issues.push({
      id: 'password',
      message: 'Change your default password. Contact Raghav if you need help.',
    });
  }

  return issues;
};

const getProfileCompletion = (user) => {
  const issues = getProfileCompletionIssues(user);
  return {
    complete: issues.length === 0,
    needsPhone: issues.some((i) => i.id === 'phone'),
    needsDob: issues.some((i) => i.id === 'dob'),
    needsPasswordChange: issues.some((i) => i.id === 'password'),
    issues,
  };
};
