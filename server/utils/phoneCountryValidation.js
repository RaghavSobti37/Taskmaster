/** Strict per-country phone validation (no auto-truncate on save). */

const COUNTRY_PHONE_RULES = [
  { code: '+971', digits: 9, name: 'UAE' },
  { code: '+91', digits: 10, name: 'India' },
  { code: '+60', digits: 9, name: 'Malaysia' },
  { code: '+65', digits: 8, name: 'Singapore' },
  { code: '+61', digits: 9, name: 'Australia' },
  { code: '+44', digits: 10, name: 'UK' },
  { code: '+1', digits: 10, name: 'US/Canada' },
];

const RULE_BY_CODE = Object.fromEntries(COUNTRY_PHONE_RULES.map((r) => [r.code, r]));

function getRule(countryCode) {
  const code = String(countryCode || '+91').startsWith('+') ? countryCode : `+${countryCode}`;
  return RULE_BY_CODE[code] || { code, digits: 10, name: code };
}

function splitPhoneNumber(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return { countryCode: '+91', nationalNumber: '' };

  const sorted = [...COUNTRY_PHONE_RULES].sort(
    (a, b) => b.code.replace(/\D/g, '').length - a.code.replace(/\D/g, '').length
  );
  for (const rule of sorted) {
    const cc = rule.code.replace('+', '');
    if (digits.startsWith(cc)) {
      return { countryCode: rule.code, nationalNumber: digits.slice(cc.length) };
    }
  }
  if (digits.length === 10) return { countryCode: '+91', nationalNumber: digits };
  const m = String(phone || '').trim().match(/^\+(\d{1,3})([\d\s-]*)$/);
  if (m) return { countryCode: `+${m[1]}`, nationalNumber: m[2].replace(/\D/g, '') };
  return { countryCode: '+91', nationalNumber: digits };
}

function validatePhoneE164(phone) {
  const { countryCode, nationalNumber } = splitPhoneNumber(phone);
  const rule = getRule(countryCode);
  const national = String(nationalNumber || '').replace(/\D/g, '');

  if (!national) return { valid: true, phone: '' };

  if (national.length !== rule.digits) {
    return {
      valid: false,
      error: `Phone number for ${rule.name} (${rule.code}) must have ${rule.digits} digits`,
    };
  }

  const cc = rule.code.replace('+', '');
  return { valid: true, phone: `+${cc}${national}` };
}

module.exports = {
  validatePhoneE164,
  splitPhoneNumber,
};
