const {
  sanitizeEmail,
  sanitizeLocation,
  normalizePersonName,
  isValidEmail,
  isPlaceholderPhone,
  repairPhone,
  isCorruptLeadPhone,
  MAX_NAME_LENGTH,
} = require('./sanitizer');
const { validatePhoneE164 } = require('./phoneCountryValidation');

/**
 * Normalize person identity fields for API, imports, and backfill.
 * @param {Object} input - { name, email, phone, city, location }
 * @param {Object} options
 * @param {boolean} options.requireName
 * @param {boolean} options.requirePhone
 * @param {boolean} options.rejectPlaceholderPhone - default true on requirePhone
 * @param {boolean} options.tryRepairPhone - backfill may attempt repairPhone before failing
 * @returns {{ name, nameKey, email, phone, city, location, errors: string[] }}
 */
function normalizePersonRecord(input = {}, options = {}) {
  const {
    requireName = false,
    requirePhone = false,
    rejectPlaceholderPhone = requirePhone,
    tryRepairPhone = false,
  } = options;

  const errors = [];
  const out = {
    name: '',
    nameKey: '',
    email: '',
    phone: '',
    city: '',
    location: '',
    errors,
  };

  if (input.name != null && input.name !== '') {
    const { name, nameKey } = normalizePersonName(input.name);
    out.name = name;
    out.nameKey = nameKey;
    if (!name) errors.push('Invalid name');
    else if (name.length > MAX_NAME_LENGTH) {
      errors.push(`Name must be at most ${MAX_NAME_LENGTH} characters`);
    }
  } else if (requireName) {
    errors.push('Name is required');
  }

  if (input.email != null && input.email !== '') {
    out.email = sanitizeEmail(input.email);
    if (!out.email) errors.push('Invalid email');
    else if (!isValidEmail(out.email)) errors.push('Invalid email format');
  }

  let rawPhone = input.phone != null ? String(input.phone).trim() : '';
  if (rawPhone) {
    if (tryRepairPhone && isCorruptLeadPhone(rawPhone)) {
      const repaired = repairPhone(rawPhone);
      if (repaired) rawPhone = repaired;
    }
    const check = validatePhoneE164(rawPhone);
    if (!check.valid) {
      errors.push(check.error || 'Invalid phone number');
    } else {
      out.phone = check.phone;
      if (isPlaceholderPhone(out.phone) || isPlaceholderPhone(rawPhone)) {
        errors.push('Invalid phone number');
        out.phone = '';
      } else if (rejectPlaceholderPhone && !out.phone) {
        errors.push('Phone is required');
      }
    }
  } else if (requirePhone) {
    errors.push('Phone is required');
  }

  if (input.city && typeof input.city === 'string') {
    out.city = sanitizeLocation(input.city);
  }
  if (input.location && typeof input.location === 'string') {
    out.location = sanitizeLocation(input.location);
  }

  return out;
}

/** Apply normalized person fields onto a target object (only defined keys). */
function applyPersonFieldsTo(target, normalized, keys = ['name', 'nameKey', 'email', 'phone', 'city', 'location']) {
  if (!target || !normalized) return target;
  for (const key of keys) {
    if (normalized[key] !== undefined && normalized[key] !== '') {
      target[key] = normalized[key];
    } else if (key === 'nameKey' && normalized.nameKey === '') {
      target.nameKey = '';
    }
  }
  return target;
}

/** Mongoose pre-save: title-case name, nameKey, email, E.164 phone (repair if corrupt). */
function applyPersonIdentityToDoc(doc, { phoneRequired = false, tryRepair = true } = {}) {
  if (!doc) return;
  if (doc.name) {
    const { name, nameKey } = normalizePersonName(doc.name);
    doc.name = name || doc.name;
    doc.nameKey = nameKey;
  }
  if (doc.email) doc.email = sanitizeEmail(doc.email);
  if (doc.phone) {
    let raw = doc.phone;
    if (tryRepair && isCorruptLeadPhone(raw)) {
      const repaired = repairPhone(raw);
      if (repaired) raw = repaired;
    }
    const check = validatePhoneE164(raw);
    if (check.valid && check.phone) doc.phone = check.phone;
    else if (!phoneRequired) doc.phone = repairPhone(raw) || raw;
  }
  if (doc.city) doc.city = sanitizeLocation(doc.city);
  if (doc.location) doc.location = sanitizeLocation(doc.location);
}

module.exports = {
  normalizePersonRecord,
  applyPersonFieldsTo,
  applyPersonIdentityToDoc,
};
