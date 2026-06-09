const crypto = require('crypto');
const { isValidEmail, normalizeEmail } = require('./emailValidation');
const { validatePhoneE164 } = require('./phoneCountryValidation');

const PLACEHOLDER_RE = /^(#ERROR!|N\/A|NA|null|undefined|-)$/i;

function isPlaceholder(value) {
  const s = String(value || '').trim();
  if (!s) return true;
  return PLACEHOLDER_RE.test(s);
}

/** Extract emails from messy cell (multi-email, inferred suffix). */
function extractEmails(raw) {
  if (isPlaceholder(raw)) return [];
  const text = String(raw);
  const found = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  const normalized = found.map((e) => normalizeEmail(e)).filter((e) => isValidEmail(e));
  return [...new Set(normalized)];
}

/** Extract phone digits from messy cell. */
function extractPhones(raw) {
  if (isPlaceholder(raw)) return [];
  const text = String(raw);
  const phones = [];
  const digitRuns = text.match(/(?:\+?\d[\d\s().-]{6,}\d)/g) || [];
  for (const run of digitRuns) {
    const check = validatePhoneE164(run.replace(/[^\d+]/g, '').length > 10 ? run : run.replace(/\D/g, ''));
    if (check.valid && check.phone) phones.push(check.phone);
    else {
      const digits = run.replace(/\D/g, '');
      if (digits.length >= 10) {
        const india = validatePhoneE164(digits.length === 10 ? digits : digits.slice(-10));
        if (india.valid && india.phone) phones.push(india.phone);
      }
    }
  }
  return [...new Set(phones)];
}

/**
 * Parse combined contact field → { email, phone, rawContact }
 */
function parseContactField(raw) {
  const emails = extractEmails(raw);
  const phones = extractPhones(raw);
  return {
    email: emails[0] || '',
    phone: phones[0] || '',
    allEmails: emails,
    allPhones: phones,
    rawContact: String(raw || '').trim(),
  };
}

/** Synthetic E.164 for email-only artist rows (90000xxxxx range). */
function syntheticArtistPhone(seed) {
  const hash = crypto.createHash('sha256').update(String(seed)).digest('hex');
  const num = 9000000000 + (parseInt(hash.slice(0, 8), 16) % 99999999);
  const national = String(num).slice(-10);
  return `+91${national}`;
}

function resolveEmailStatus(email) {
  if (!email) return 'Pending';
  return isValidEmail(email) ? 'Pending' : 'Invalid';
}

module.exports = {
  isPlaceholder,
  extractEmails,
  extractPhones,
  parseContactField,
  syntheticArtistPhone,
  resolveEmailStatus,
};
