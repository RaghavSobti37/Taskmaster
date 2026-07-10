/** Country calling codes + required national number length (no auto-truncate). */
export const COUNTRY_PHONE_RULES = [
  { code: '+971', label: 'UAE (+971)', digits: 9, name: 'UAE' },
  { code: '+91', label: 'India (+91)', digits: 10, name: 'India' },
  { code: '+60', label: 'Malaysia (+60)', digits: 9, name: 'Malaysia' },
  { code: '+65', label: 'Singapore (+65)', digits: 8, name: 'Singapore' },
  { code: '+61', label: 'Australia (+61)', digits: 9, name: 'Australia' },
  { code: '+44', label: 'UK (+44)', digits: 10, name: 'UK' },
  { code: '+1', label: 'US/Canada (+1)', digits: 10, name: 'US/Canada' },
];

const RULE_BY_CODE = Object.fromEntries(COUNTRY_PHONE_RULES.map((r) => [r.code, r]));

export function getCountryPhoneRule(countryCode) {
  const normalized = normalizeCountryCode(countryCode);
  return RULE_BY_CODE[normalized] || { code: normalized, label: normalized, digits: 10, name: normalized };
}

export function normalizeCountryCode(code) {
  const raw = String(code || '').trim();
  if (!raw) return '+91';
  return raw.startsWith('+') ? raw : `+${raw.replace(/\D/g, '')}`;
}

/** Split stored E.164 phone into country code + national digits. */
export function splitPhoneNumber(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return { countryCode: '+91', nationalNumber: '' };

  const byLength = [...COUNTRY_PHONE_RULES].sort(
    (a, b) => b.code.replace(/\D/g, '').length - a.code.replace(/\D/g, '').length
  );
  for (const rule of byLength) {
    const cc = rule.code.replace('+', '');
    if (digits.startsWith(cc)) {
      return { countryCode: rule.code, nationalNumber: digits.slice(cc.length) };
    }
  }

  if (digits.length === 10) {
    return { countryCode: '+91', nationalNumber: digits };
  }

  const m = String(phone || '').trim().match(/^\+(\d{1,3})([\d\s-]*)$/);
  if (m) {
    return {
      countryCode: `+${m[1]}`,
      nationalNumber: m[2].replace(/\D/g, ''),
    };
  }

  return { countryCode: '+91', nationalNumber: digits };
}

export function composePhoneNumber(countryCode, nationalNumber) {
  const rule = getCountryPhoneRule(countryCode);
  const cc = rule.code.replace('+', '');
  const national = String(nationalNumber || '').replace(/\D/g, '');
  if (!national) return '';
  return `+${cc}${national}`;
}

/**
 * @returns {{ valid: boolean, error?: string, phone?: string, expectedDigits: number, countryName: string }}
 */
export function validatePhoneParts(countryCode, nationalNumber) {
  const rule = getCountryPhoneRule(countryCode);
  const national = String(nationalNumber || '').replace(/\D/g, '');

  if (!national) {
    return { valid: true, phone: '', expectedDigits: rule.digits, countryName: rule.name };
  }

  if (!/^\d+$/.test(national)) {
    return {
      valid: false,
      error: 'Phone must contain digits only',
      expectedDigits: rule.digits,
      countryName: rule.name,
    };
  }

  if (national.length !== rule.digits) {
    return {
      valid: false,
      error: `Phone number for ${rule.name} (${rule.code}) must have ${rule.digits} digits`,
      expectedDigits: rule.digits,
      countryName: rule.name,
    };
  }

  return {
    valid: true,
    phone: composePhoneNumber(rule.code, national),
    expectedDigits: rule.digits,
    countryName: rule.name,
  };
}
