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

/** Title-case each word after sanitizeName; build case-insensitive match key. */
const titleCaseWord = (word) => {
  if (!word) return '';
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
};

const normalizePersonName = (name) => {
  const cleaned = sanitizeName(name);
  if (!cleaned) return { name: '', nameKey: '' };
  const display = cleaned
    .split(' ')
    .filter(Boolean)
    .map(titleCaseWord)
    .join(' ');
  const nameKey = display.toLowerCase().replace(/[^a-z0-9]/g, '');
  return { name: display, nameKey };
};

/** Apply person name normalization to a fields object (mutates name, sets nameKey). */
const normalizePersonFields = (fields) => {
  if (!fields || fields.name == null) return fields;
  const { name, nameKey } = normalizePersonName(fields.name);
  fields.name = name;
  if (nameKey) fields.nameKey = nameKey;
  else if ('nameKey' in fields) fields.nameKey = '';
  return fields;
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

const phoneDigitCount = (phone) => String(phone || '').replace(/\D/g, '').length;

/** Pull +91 + 10-digit mobile when digits were concatenated (e.g. legacy import). */
const extractIndianMobile = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length > 12) {
    return `+91${digits.slice(2, 12)}`;
  }
  if (digits.length === 10) return `+91${digits}`;
  return '';
};

/** When overlong and not +91 Indian, keep leading 10 digits (legacy concatenated blobs). */
const extractTruncatedMobile = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length <= 10) return digits.length === 10 ? `+${digits}` : '';
  return `+${digits.slice(0, 10)}`;
};

const extractRepairableMobile = (phone) => {
  const indian = extractIndianMobile(phone);
  if (indian) return indian;
  return extractTruncatedMobile(phone);
};

const isCanonicalIndianMobile = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.startsWith('91') && digits.length === 12;
};

/** 12-digit international numbers that must not be truncated (971 = UAE, etc.). */
const isCanonicalIntlMobile = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (isCanonicalIndianMobile(phone)) return true;
  if (digits.startsWith('971') && digits.length === 12) return true;
  return false;
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

const isValidPhone = (phone) => {
  if (!phone) return false;
  const digits = String(phone).replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
};

/** Restore phones corrupted by legacy duplicate-resolution or concatenated digit blobs. */
const repairPhone = (phone) => {
  const stripped = stripPhoneIntegritySuffix(phone);
  if (!stripped) return '';

  const digits = phoneDigitCount(stripped);
  const indian = extractIndianMobile(stripped);
  if (indian && isValidPhone(indian)) return indian;

  if (isCanonicalIntlMobile(stripped)) {
    return normalizePhone(stripped);
  }

  if (digits > 12) {
    const truncated = extractTruncatedMobile(stripped);
    if (truncated && isValidPhone(truncated)) return truncated;
  }

  const normalized = normalizePhone(stripped);
  if (isValidPhone(normalized)) return normalized;
  return normalized;
};

const isCorruptLeadPhone = (phone) => {
  if (!phone) return false;
  const str = String(phone);
  if (/-DUP-[a-f0-9]{24}$/i.test(str) || /^EMPTY-[a-f0-9]{24}$/i.test(str)) return true;

  const stripped = stripPhoneIntegritySuffix(str);
  if (!stripped) return true;

  const digits = phoneDigitCount(stripped);
  if (digits > 15) return true;
  if (isCanonicalIntlMobile(stripped)) return false;

  if (digits > 12) {
    const repaired = repairPhone(str);
    return repaired !== normalizePhone(stripped);
  }

  const normalized = normalizePhone(stripped);
  return !isValidPhone(normalized);
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

const PLACEHOLDER_PHONE_DIGITS = /^0{10,}$/;

const isPlaceholderPhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  return PLACEHOLDER_PHONE_DIGITS.test(digits);
};

module.exports = {
  sanitizeName,
  normalizePersonName,
  normalizePersonFields,
  isPlaceholderPhone,
  sanitizeEmail,
  normalizePhone,
  repairPhone,
  stripPhoneIntegritySuffix,
  extractIndianMobile,
  extractTruncatedMobile,
  extractRepairableMobile,
  phoneDigitCount,
  isCorruptLeadPhone,
  validateDate,
  sanitizeLocation,
  escapeRegExp,
  MAX_NAME_LENGTH,
  isValidEmail,
  isValidPhone,
};

