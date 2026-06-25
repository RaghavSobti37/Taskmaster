const {
  suggestArtistCrmMapping,
  validateArtistCrmMapping,
} = require('../../shared/artistCrmImportFields');
const {
  mapRowWithColumnMapping,
} = require('../domains/crm/services/artistCrmMappedImportService');

describe('artistCrmImportFields', () => {
  test('suggestArtistCrmMapping matches common headers', () => {
    const mapping = suggestArtistCrmMapping([
      'Name', 'Email', 'Phone', 'City', 'Designation',
    ]);
    expect(mapping.name).toBe('Name');
    expect(mapping.email).toBe('Email');
    expect(mapping.phone).toBe('Phone');
    expect(mapping.city).toBe('City');
    expect(mapping.primaryRole).toBe('Designation');
  });

  test('validateArtistCrmMapping requires name and contact', () => {
    expect(validateArtistCrmMapping({ name: 'Name' })).toMatch(/Phone or Email/);
    expect(validateArtistCrmMapping({ phone: 'Phone' })).toMatch(/Name/);
    expect(validateArtistCrmMapping({ name: 'Name', email: 'Email' })).toBeNull();
  });
});

describe('artistCrmMappedImport mapRow', () => {
  test('maps row via column mapping', () => {
    const row = {
      'Event Name': 'Ziro Festival',
      'Contact Information': 'info@ziro.com / +919810549494',
      Location: 'Arunachal',
    };
    const mapped = mapRowWithColumnMapping(
      row,
      {
        name: 'Event Name',
        email: 'Contact Information',
        phone: 'Contact Information',
        city: 'Location',
      },
      2,
      'awards.csv',
    );
    expect(mapped.name).toBe('Ziro Festival');
    expect(mapped.email).toContain('@');
    expect(mapped.phone).toMatch(/^\+/);
    expect(mapped.crmType).toBe('artist');
    expect(mapped.metadata.mappedImport).toBe(true);
  });
});
