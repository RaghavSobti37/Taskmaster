/**
 * Sanitizer utility for data integrity and normalization.
 */

const sanitizeName = (name) => {
  if (!name) return '';
  return name
    .replace(/<[^>]*>?/gm, '') // Strip HTML
    .replace(/\s+/g, ' ')      // Remove duplicate inner whitespace
    .trim();                   // Trim leading/trailing
};

const sanitizeEmail = (email) => {
  if (!email) return '';
  return email
    .toLowerCase()
    .replace(/[\x00-\x1F\x7F]/g, '') // Strip hidden control characters
    .trim();
};

const normalizePhone = (phone) => {
  if (!phone) return '';
  // Remove all non-numeric characters except +
  let cleaned = phone.toString().replace(/[^\d+]/g, '');
  
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

module.exports = {
  sanitizeName,
  sanitizeEmail,
  normalizePhone,
  validateDate
};
