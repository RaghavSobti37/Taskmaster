/** Client mirror of server/utils/passwordValidation.js — keep rules in sync */

export const WEAK_PASSWORDS = new Set([
  '1234', '12345', '123456', '1234567', '12345678', '123456789', '1234567890',
  'password', 'password1', 'password123', 'qwerty', 'qwerty123', 'admin', 'admin123',
  'letmein', 'welcome', 'monkey', 'dragon', 'master', 'abc123', 'iloveyou',
  'sunshine', 'princess', 'football', 'baseball', 'trustno1', '111111', '000000',
]);

export const PASSWORD_REQUIREMENT_CHECKS = [
  {
    id: 'length',
    label: 'At least 8 characters long',
    test: (password) => password.length >= 8,
  },
  {
    id: 'letterNumber',
    label: 'At least one letter and one number',
    test: (password) => /[a-zA-Z]/.test(password) && /\d/.test(password),
  },
  {
    id: 'notWeak',
    label: 'Not a common weak password (e.g. password123)',
    test: (password) => !WEAK_PASSWORDS.has(password.toLowerCase().trim()),
  },
  {
    id: 'notRepetitive',
    label: 'Not all identical characters or digits only',
    test: (password) => !/^(.)\1+$/.test(password) && !/^(\d+)$/.test(password),
  },
];

const PASSWORD_REQUIREMENTS = PASSWORD_REQUIREMENT_CHECKS.map((rule) => rule.label);

export const getPasswordRequirementChecks = (password = '') =>
  PASSWORD_REQUIREMENT_CHECKS.map(({ id, label, test }) => ({
    id,
    label,
    met: password.length > 0 && test(password),
  }));

export const validatePasswordStrength = (password) => {
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

export const formatUserCredentialsForCopy = (email, temporaryPassword) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return [
    'CoreKnot login credentials',
    '',
    `Email: ${email}`,
    `Temporary password: ${temporaryPassword}`,
    '',
    origin ? `Sign in: ${origin}/login` : 'Sign in with the credentials above.',
    'You will be asked to set a new password on first login.',
  ].join('\n');
};
