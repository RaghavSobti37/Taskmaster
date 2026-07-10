const crypto = require('crypto');

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

const PASSWORD_REQUIREMENTS = [
  'At least 8 characters long',
  'At least one letter and one number',
  'Not a common weak password (e.g. password123)',
  'Not all identical characters or digits only',
];

const generateSecurePassword = (length = 16) => {
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const digits = '23456789';
  const symbols = '!@#$%&*';
  const all = lower + upper + digits + symbols;
  const pick = (chars) => chars[crypto.randomInt(0, chars.length)];

  const chars = [pick(lower), pick(upper), pick(digits), pick(symbols)];
  while (chars.length < length) chars.push(pick(all));

  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  const password = chars.join('');
  if (validatePasswordStrength(password)) {
    return generateSecurePassword(length);
  }
  return password;
};

module.exports = {
  validatePasswordStrength,
  generateSecurePassword,
  PASSWORD_REQUIREMENTS,
  WEAK_PASSWORDS,
};
