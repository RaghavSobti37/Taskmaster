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

  test('extracts Indian mobile from concatenated digit blob', () => {
    const blob = '+91859149939360809296289249';
    expect(repairPhone(blob)).toBe('+918591499393');
    expect(isCorruptLeadPhone(blob)).toBe(true);
    expect(isValidPhone(repairPhone(blob))).toBe(true);
  });

  test('extracts from Mayank-style concatenated phone', () => {
    const blob = '+917999590515600440129893197126';
    expect(repairPhone(blob)).toBe('+917999590515');
    expect(isCorruptLeadPhone(blob)).toBe(true);
  });

  test('extracts first 10 digits when no +91 prefix', () => {
    const blob = '+6051722962892400';
    expect(repairPhone(blob)).toBe('+6051722962');
    expect(isCorruptLeadPhone(blob)).toBe(true);
    expect(isValidPhone(repairPhone(blob))).toBe(true);
  });

  test('extracts first 10 digits from 15-digit concatenated blob', () => {
    const blob = '+605171296289242';
    expect(repairPhone(blob)).toBe('+6051712962');
    expect(isCorruptLeadPhone(blob)).toBe(true);
  });

  test('valid +91 mobile stays unchanged', () => {
    expect(repairPhone('+918591499393')).toBe('+918591499393');
    expect(isCorruptLeadPhone('+918591499393')).toBe(false);
  });

  test('valid UAE mobile stays unchanged', () => {
    expect(repairPhone('+971506622739')).toBe('+971506622739');
    expect(isCorruptLeadPhone('+971506622739')).toBe(false);
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
