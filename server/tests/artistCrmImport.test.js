const {
  parseContactField,
  extractEmails,
  resolveEmailStatus,
} = require('../utils/artistContactFieldParser');
const { detectSheetTemplate } = require('../../shared/artistCrmSheetMappings');

describe('artistContactFieldParser', () => {
  test('parses combined phone and email', () => {
    const r = parseContactField('9814089914, yugmarg@example.com');
    expect(r.phone).toMatch(/^\+91/);
    expect(r.email).toBe('yugmarg@example.com');
  });

  test('extracts first valid email from multi-email cell', () => {
    const emails = extractEmails('amrita.prasad@timesgroup.com / amrita.prasad27@timesgroup.com');
    expect(emails.length).toBeGreaterThanOrEqual(1);
    expect(emails[0]).toContain('@');
  });

  test('resolveEmailStatus flags invalid', () => {
    expect(resolveEmailStatus('not-an-email')).toBe('Invalid');
    expect(resolveEmailStatus('valid@example.com')).toBe('Pending');
  });
});

describe('artistCrmImport identity', () => {
  const {
    coerceArtistImportIdentity,
    mapRowToLead,
  } = require('../services/artistCrmImportService');
  const { detectSheetTemplate } = require('../../shared/artistCrmSheetMappings');

  test('imports row with no email and no phone using synthetic phone', () => {
    const template = detectSheetTemplate('harshaDuhita Collective __ TSC Talent Mastersheet - Wavrkari sanstha and maharaj contact.csv');
    const mapped = mapRowToLead(
      { Name: 'Warkari Org', contact: 'Pune address only', City: 'Pune' },
      template,
      5
    );
    const coerced = coerceArtistImportIdentity(mapped);
    expect(coerced.name).toBe('Warkari Org');
    expect(coerced.email).toBeUndefined();
    expect(coerced.phone).toMatch(/^\+91/);
    expect(coerced.metadata.importSyntheticPhone).toBe(true);
  });

  test('derives name from publication when contact name missing', () => {
    const template = detectSheetTemplate('YUGM __ TSC Artist Mastersheet - Media List.csv');
    const mapped = mapRowToLead(
      {
        'Publication Name': 'Lokmat Times',
        'Contact Information': '9822012345',
        'City / Region': 'Pune',
      },
      template,
      10
    );
    const coerced = coerceArtistImportIdentity(mapped);
    expect(coerced.name).toBe('Lokmat Times');
    expect(coerced.phone).toMatch(/^\+91/);
  });
});

describe('artistCrmSheetMappings', () => {
  test('detects YUGM media template', () => {
    const t = detectSheetTemplate('YUGM __ TSC Artist Mastersheet - Media List.csv');
    expect(t?.type).toBe('yugm_media');
    expect(t?.artistProject).toBe('YUGM');
  });

  test('detects event database template', () => {
    const t = detectSheetTemplate('TSC Artist Event Database - Master Database.csv');
    expect(t?.contactCategory).toBe('event_database');
    expect(t?.artistProject).toBeNull();
  });
});
