/**
 * Staff excluded from QA automation side effects (notifications, email, probe actor selection).
 * QA agents (Alpha/Beta/Gamma) still run tests; these users must not receive noise.
 */
const QA_EXCLUDED_EMAILS = Object.freeze([
  'redacted-staff@example.com',
]);

const QA_EXCLUDED_EMAIL_SET = new Set(
  QA_EXCLUDED_EMAILS.map((e) => String(e).trim().toLowerCase())
);

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const isQaExcludedEmail = (email) => QA_EXCLUDED_EMAIL_SET.has(normalizeEmail(email));

const userMatchesQaExclusion = (user) => {
  if (!user) return false;
  return isQaExcludedEmail(user.email);
};

/** Mongo filter fragment: { email: { $nin: [...] } } */
const qaExcludedEmailNinFilter = () => ({
  email: { $nin: [...QA_EXCLUDED_EMAILS] },
});

module.exports = {
  QA_EXCLUDED_EMAILS,
  isQaExcludedEmail,
  userMatchesQaExclusion,
  qaExcludedEmailNinFilter,
};
