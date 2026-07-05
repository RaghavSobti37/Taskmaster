/** CJS entry for Node server — keep in sync with posthogInternalUsers.js */
const E2E_AGENT_EMAIL = /^e2e-agent/i;
const E2E_TEST_USER_EMAIL = /^e2e-.+@test\.coreknot\.local$/i;

function isPostHogInternalOrTestUser(email) {
  const normalized = String(email || '').trim();
  if (!normalized) return false;
  return E2E_AGENT_EMAIL.test(normalized) || E2E_TEST_USER_EMAIL.test(normalized);
}

function postHogPersonPropertiesForUser(user) {
  const email = user?.email;
  const base = {
    email: email || undefined,
    name: user?.name || undefined,
    role: user?.role || undefined,
  };
  if (isPostHogInternalOrTestUser(email)) {
    base.$internal_or_test_user = true;
  }
  return base;
}

module.exports = {
  isPostHogInternalOrTestUser,
  postHogPersonPropertiesForUser,
};
