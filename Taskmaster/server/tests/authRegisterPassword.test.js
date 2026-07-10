const { validatePasswordStrength } = require('../utils/passwordValidation');

describe('register password validation order', () => {
  test('weak password is rejected before domain gate would matter', () => {
    expect(validatePasswordStrength('password123')).toMatch(/weak/i);
  });
});
