const {
  repairPhone,
  isCorruptLeadPhone,
  isValidPhone,
  normalizePhone,
} = require('../utils/sanitizer');

describe('lead phone repair', () => {
  const corrupt = '+919711155550-DUP-6a141225306a60191607c213';

  test('detects corrupt -DUP- suffix', () => {
    expect(isCorruptLeadPhone(corrupt)).toBe(true);
    expect(isCorruptLeadPhone('+919711155550')).toBe(false);
  });

  test('repairPhone strips -DUP- and normalizes', () => {
    expect(repairPhone(corrupt)).toBe('+919711155550');
    expect(isValidPhone(repairPhone(corrupt))).toBe(true);
  });

  test('legacy strip-less normalization produces too many digits', () => {
    const legacy = String(corrupt).replace(/[^\d+]/g, '');
    const digits = legacy.replace(/\D/g, '');
    expect(digits.length).toBeGreaterThan(15);
    expect(isValidPhone('+' + digits)).toBe(false);
  });

  test('normalizePhone now strips integrity suffix first', () => {
    expect(normalizePhone(corrupt)).toBe('+919711155550');
    expect(isValidPhone(normalizePhone(corrupt))).toBe(true);
  });

  test('EMPTY- placeholder becomes empty', () => {
    expect(repairPhone('EMPTY-6a141225306a60191607c213')).toBe('');
    expect(isCorruptLeadPhone('EMPTY-6a141225306a60191607c213')).toBe(true);
  });
});

describe('prepareLeadContactUpdates logic (unit)', () => {
  const phoneDigits = (phone) => String(phone || '').replace(/\D/g, '');

  test('unchanged corrupt phone normalizes to same digits as stored corrupt phone', () => {
    const corrupt = '+919711155550-DUP-6a141225306a60191607c213';
    const fromClient = corrupt;
    const normalized = repairPhone(fromClient);
    const existingNormalized = repairPhone(corrupt);
    expect(phoneDigits(normalized)).toBe(phoneDigits(existingNormalized));
    expect(isValidPhone(normalized)).toBe(true);
  });
});
