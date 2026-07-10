const {
  suggestArtistCrmMapping,
  validateArtistCrmMapping,
} = require('../../shared/artistCrmImportFields');
const {
  extractAssigneeTokensFromSheetName,
  matchAssigneeFromSheetName,
  matchAssigneeToken,
} = require('../utils/artistCallAssignees');

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

describe('artistCallAssignees sheet name', () => {
  const reps = [
    { _id: '1', name: 'Akash Kumar' },
    { _id: '2', name: 'Rohith Sharma' },
    { _id: '3', name: 'Harshika Patel' },
  ];

  test('extracts tokens after dash', () => {
    expect(extractAssigneeTokensFromSheetName('Private Shows - Akash')).toEqual(['Akash']);
    expect(extractAssigneeTokensFromSheetName('Sponsors - Akash & Harshika')).toEqual(['Akash', 'Harshika']);
  });

  test('matchAssigneeFromSheetName picks first matching rep', () => {
    const hit = matchAssigneeFromSheetName('Live Gig Venue - Deepank', [
      { _id: '9', name: 'Deepank Soni' },
      ...reps,
    ]);
    expect(hit.assigneeName).toBe('Deepank Soni');
    expect(hit.source).toBe('sheet_rule');
  });

  test('matchAssigneeToken handles first name', () => {
    expect(matchAssigneeToken('Akash', reps[0])).toBe(true);
    expect(matchAssigneeToken('Rohith', reps[1])).toBe(true);
  });
});

describe('artistCrmMappedImport mapRow', () => {
  const { mapRowWithColumnMapping } = require('../domains/crm/services/artistCrmMappedImportService');
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
