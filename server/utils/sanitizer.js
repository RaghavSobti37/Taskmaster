/**
 * Sanitizer utility for data integrity and normalization.
 */

const sanitizeName = (name) => {
  if (!name) return '';
  const str = name.toString().trim();
  const lower = str.toLowerCase();
  if (lower === '-' || lower === 'n/a' || lower === 'null' || lower === 'undefined') return '';
  return str
    .replace(/<[^>]*>?/gm, '') // Strip HTML
    .replace(/\s+/g, ' ')      // Remove duplicate inner whitespace
    .trim();                   // Trim leading/trailing
};

const sanitizeEmail = (email) => {
  if (!email) return '';
  const str = email.toString().trim();
  const lower = str.toLowerCase();
  if (lower === '-' || lower === 'n/a' || lower === 'null' || lower === 'undefined') return '';
  return lower
    .replace(/[\x00-\x1F\x7F]/g, '') // Strip hidden control characters
    .trim();
};

const stripPhoneIntegritySuffix = (phone) => {
  if (!phone) return '';
  let str = String(phone).trim();
  if (/^EMPTY-[a-f0-9]{24}$/i.test(str)) return '';
  const dupMatch = str.match(/-DUP-[a-f0-9]{24}$/i);
  if (dupMatch) str = str.slice(0, dupMatch.index);
  return str;
};

const normalizePhone = (phone) => {
  if (!phone) return '';
  const str = stripPhoneIntegritySuffix(phone);
  if (!str) return '';
  const lower = str.toLowerCase();
  if (lower === '-' || lower === 'n/a' || lower === 'null' || lower === 'undefined') return '';

  let cleaned = str.replace(/[^\d+]/g, '');

  if (cleaned.length === 10 && !cleaned.startsWith('+')) {
    cleaned = '+91' + cleaned;
  } else if (cleaned.length > 10 && !cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }

  return cleaned;
};

/** Restore phones corrupted by legacy duplicate-resolution (e.g. +91…-DUP-{objectId}). */
const repairPhone = (phone) => normalizePhone(stripPhoneIntegritySuffix(phone));

const isCorruptLeadPhone = (phone) => {
  if (!phone) return false;
  const str = String(phone);
  return /-DUP-[a-f0-9]{24}$/i.test(str) || /^EMPTY-[a-f0-9]{24}$/i.test(str);
};

const validateDate = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
};

const sanitizeLocation = (loc) => {
  if (!loc) return '';
  return loc
    .toLowerCase()
    .replace(/[().,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const MAX_NAME_LENGTH = 200;

const isValidEmail = (email) => {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email));
};

const isValidPhone = (phone) => {
  if (!phone) return false;
  const digits = String(phone).replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
};

const escapeRegExp = (str) => {
  if (!str) return '';
  const specials = ['-', '[', ']', '/', '{', '}', '(', ')', '*', '+', '?', '.', '\\', '^', '$', '|'];
  let output = '';
  for (const char of String(str)) {
    if (specials.includes(char)) {
      output += '\\' + char;
    } else {
      output += char;
    }
  }
  return output;
};

module.exports = {
  sanitizeName,
  sanitizeEmail,
  normalizePhone,
  repairPhone,
  stripPhoneIntegritySuffix,
  isCorruptLeadPhone,
  validateDate,
  sanitizeLocation,
  escapeRegExp,
  MAX_NAME_LENGTH,
  isValidEmail,
  isValidPhone,
};

