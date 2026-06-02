/**
 * Client-side lead field validation — strict phone rules per country (no auto-truncate).
 */

import {
  splitPhoneNumber,
  validatePhoneParts,
  composePhoneNumber,
} from './leadPhoneCountries';

const MAX_NAME_LENGTH = 200;

const sanitizeName = (name) => {
  if (!name) return '';
  const str = String(name).trim();
  const lower = str.toLowerCase();
  if (lower === '-' || lower === 'n/a' || lower === 'null' || lower === 'undefined') return '';
  return str.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
};

const sanitizeEmail = (email) => {
  if (!email) return '';
  const str = String(email).trim().toLowerCase();
  if (str === '-' || str === 'n/a' || str === 'null' || str === 'undefined') return '';
  return str.replace(/[\x00-\x1F\x7F]/g, '').trim();
};

const sanitizeLocation = (loc) => {
  if (!loc) return '';
  return String(loc).toLowerCase().replace(/[().,]/g, '').replace(/\s+/g, ' ').trim();
};

export const isValidEmail = (email) => {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email));
};

/**
 * @returns {{ valid: boolean, errors: Record<string,string>, sanitized: object }}
 */
export function validateLeadFormFields(data) {
  const errors = {};

  const name = sanitizeName(data.name);
  if (!name) errors.name = 'Customer name is required';
  else if (name.length > MAX_NAME_LENGTH) errors.name = `Name must be at most ${MAX_NAME_LENGTH} characters`;

  let phone = '';
  const hasParts = data.phoneCountryCode != null || data.phoneNational != null;
  if (hasParts) {
    const check = validatePhoneParts(data.phoneCountryCode || '+91', data.phoneNational || '');
    if (!check.valid && check.error) errors.phone = check.error;
    else if (check.phone) phone = check.phone;
  } else if (data.phone != null && String(data.phone).trim() !== '') {
    const { countryCode, nationalNumber } = splitPhoneNumber(data.phone);
    const check = validatePhoneParts(countryCode, nationalNumber);
    if (!check.valid && check.error) errors.phone = check.error;
    else if (check.phone) phone = check.phone;
  }

  let email = '';
  if (data.email != null && String(data.email).trim() !== '') {
    email = sanitizeEmail(data.email);
    if (!isValidEmail(email)) errors.email = 'Invalid email format';
  }

  const sanitized = {
    ...data,
    name: name || data.name,
    phone: phone || undefined,
    email: email || undefined,
    city: data.city != null ? sanitizeLocation(data.city) : data.city,
  };
  delete sanitized.phoneCountryCode;
  delete sanitized.phoneNational;

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    sanitized,
  };
}

export { splitPhoneNumber, validatePhoneParts, composePhoneNumber };
