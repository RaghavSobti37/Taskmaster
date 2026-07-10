const E2E_TEST_USER_EMAIL = /^e2e-.+@test\.coreknot\.local$/i;

const isE2eTestUser = (email) => E2E_TEST_USER_EMAIL.test(String(email || '').trim());

const E2E_PW_GATE_EMAIL = 'e2e-pw-gate@test.coreknot.local';
const E2E_PW_GATE_TEMP_PASSWORD = 'E2eGateTemp1!';

module.exports = {
  E2E_TEST_USER_EMAIL,
  isE2eTestUser,
  E2E_PW_GATE_EMAIL,
  E2E_PW_GATE_TEMP_PASSWORD,
};
