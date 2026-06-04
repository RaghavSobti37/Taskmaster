const { normalizePersonName } = require('../utils/sanitizer');
const { normalizePersonRecord } = require('../utils/personNormalization');

describe('normalizePersonName', () => {
  test('title-cases and produces same nameKey for casing variants', () => {
    const a = normalizePersonName('Raghav Sobti');
    const b = normalizePersonName('raghav  sobti');
    expect(a.name).toBe('Raghav Sobti');
    expect(b.name).toBe('Raghav Sobti');
    expect(a.nameKey).toBe('raghavsobti');
    expect(b.nameKey).toBe(a.nameKey);
  });

  test('rejects placeholder names', () => {
    expect(normalizePersonName('n/a').nameKey).toBe('');
    expect(normalizePersonName('-').name).toBe('');
  });
});

describe('normalizePersonRecord', () => {
  test('normalizes email to lowercase', () => {
    const r = normalizePersonRecord({
      name: 'Test User',
      email: 'Test@Example.COM',
      phone: '9876543210',
    });
    expect(r.errors).toEqual([]);
    expect(r.email).toBe('test@example.com');
    expect(r.phone).toBe('+919876543210');
    expect(r.name).toBe('Test User');
    expect(r.nameKey).toBe('testuser');
  });

  test('validates UAE phone E.164', () => {
    const r = normalizePersonRecord({
      name: 'UAE Lead',
      phone: '+971501234567',
    });
    expect(r.errors).toEqual([]);
    expect(r.phone).toBe('+971501234567');
  });

  test('rejects invalid phone without silent truncate', () => {
    const r = normalizePersonRecord({
      name: 'Bad Phone',
      phone: '+91123',
    });
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.phone).toBe('');
  });

  test('rejects placeholder phone on create', () => {
    const r = normalizePersonRecord(
      { name: 'X', phone: '0000000000' },
      { requirePhone: true }
    );
    expect(r.errors.some((e) => /phone/i.test(e))).toBe(true);
  });

  test('requireName and requirePhone', () => {
    const r = normalizePersonRecord({}, { requireName: true, requirePhone: true });
    expect(r.errors).toContain('Name is required');
    expect(r.errors).toContain('Phone is required');
  });
});
