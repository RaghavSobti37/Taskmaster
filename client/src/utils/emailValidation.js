/**
 * Client-side email validation (mirrors server/utils/emailValidation.js).
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const PHONE_PATTERN = /^\+?\d{7,15}$/;
const TLD_PATTERN = /^[a-z]{2,63}$/i;

export const normalizeEmail = (email) => {
  if (!email) return '';
  return String(email)
    .trim()
    .toLowerCase()
    .replace(/[\x00-\x1F\x7F]/g, '');
};

const looksLikePhone = (value) => {
  if (!value) return false;
  const compact = String(value).replace(/[\s().-]/g, '');
  if (!compact) return false;
  if (!/^\+?\d+$/.test(compact)) return false;
  return PHONE_PATTERN.test(compact);
};

export const isValidEmail = (email) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  if (!normalized.includes('@')) return false;
  if (looksLikePhone(normalized)) return false;
  if (!EMAIL_PATTERN.test(normalized)) return false;

  const domain = normalized.split('@')[1];
  if (!domain || domain.startsWith('.') || domain.endsWith('.')) return false;

  const tld = domain.split('.').pop();
  if (!tld || !TLD_PATTERN.test(tld)) return false;

  return true;
};

export const filterValidRecipientRows = (rows) => {
  const valid = [];
  const skipped = [];
  for (const row of rows || []) {
    const email = normalizeEmail(row?.email);
    if (isValidEmail(email)) {
      valid.push({ ...row, email });
    } else if (email) {
      skipped.push(email);
    }
  }
  return { valid, skipped };
};
