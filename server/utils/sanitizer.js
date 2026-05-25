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

const normalizePhone = (phone) => {
  if (!phone) return '';
  const str = phone.toString().trim();
  const lower = str.toLowerCase();
  if (lower === '-' || lower === 'n/a' || lower === 'null' || lower === 'undefined') return '';
  
  // Remove all non-numeric characters except +
  let cleaned = str.replace(/[^\d+]/g, '');
  
  // If it starts with 0 and has 11 digits, it's likely a local format (e.g., India 09... -> +91...)
  // But for now, let's just ensure it has a standard format.
  // Standardizing to +CC format if missing. Default to +91 if 10 digits and no CC.
  if (cleaned.length === 10 && !cleaned.startsWith('+')) {
    cleaned = '+91' + cleaned;
  } else if (cleaned.length > 10 && !cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  
  return cleaned;
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
  validateDate,
  sanitizeLocation,
  escapeRegExp
};

