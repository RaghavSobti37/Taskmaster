const {
  sanitizeName,
  sanitizeEmail,
  normalizePhone,
  sanitizeLocation,
  isValidEmail,
  isValidPhone,
  MAX_NAME_LENGTH,
} = require('./sanitizer');

/**
 * Normalize lead fields in place (same rules as CRM API).
 * @returns {string[]} validation errors; empty if ok
 */
function normalizeAndValidateLeadFields(leadData, { requireName = false, requirePhone = false } = {}) {
  const errors = [];

  if (leadData.name != null) {
    leadData.name = sanitizeName(leadData.name);
    if (!leadData.name) errors.push('Invalid name');
    else if (leadData.name.length > MAX_NAME_LENGTH) {
      errors.push(`Name must be at most ${MAX_NAME_LENGTH} characters`);
    }
  } else if (requireName) {
    errors.push('Name is required');
  }

  if (leadData.email != null && leadData.email !== '') {
    leadData.email = sanitizeEmail(leadData.email);
    if (!isValidEmail(leadData.email)) errors.push('Invalid email format');
  }

  if (leadData.phone != null && leadData.phone !== '') {
    leadData.phone = normalizePhone(leadData.phone);
    if (!isValidPhone(leadData.phone)) errors.push('Invalid phone number');
  } else if (requirePhone) {
    errors.push('Phone is required');
  }

  if (leadData.city && typeof leadData.city === 'string') {
    leadData.city = sanitizeLocation(leadData.city);
  }
  if (leadData.location && typeof leadData.location === 'string') {
    leadData.location = sanitizeLocation(leadData.location);
  }

  return errors;
}

module.exports = { normalizeAndValidateLeadFields };
