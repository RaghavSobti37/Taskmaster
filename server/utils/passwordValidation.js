const WEAK_PASSWORDS = new Set([
  '1234', '12345', '123456', '1234567', '12345678', '123456789', '1234567890',
  'password', 'password1', 'password123', 'qwerty', 'qwerty123', 'admin', 'admin123',
  'letmein', 'welcome', 'monkey', 'dragon', 'master', 'abc123', 'iloveyou',
  'sunshine', 'princess', 'football', 'baseball', 'trustno1', '111111', '000000',
]);

const validatePasswordStrength = (password) => {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters long';
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return 'Password must contain at least one letter and one number';
  }
  const normalized = password.toLowerCase().trim();
  if (WEAK_PASSWORDS.has(normalized)) {
    return 'Password is too weak. Please choose a stronger password';
  }
  if (/^(.)\1+$/.test(password) || /^(\d+)$/.test(password)) {
    return 'Password is too weak. Please choose a stronger password';
  }
  return null;
};

module.exports = { validatePasswordStrength, WEAK_PASSWORDS };
