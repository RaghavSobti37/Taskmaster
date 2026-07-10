const {
  normalizeEmail,
  normalizePhone,
  normalizeName,
  identityKey,
  isIMLOffering,
  mapHavellsRow,
  buildHavellsIdentitySet,
} = require('../services/havellsDataHubService');
const { DEFAULT_HAVELLS_ROOT } = require('../lib/havellsDataRoot');
const {
  isHolySheetArtistOrPr,
  buildDbMinusHavellsRows,
} = require('../services/dataHubDiffExportService');
const { buildInletGroups } = require('../../shared/dataInlets');

describe('havellsDataHubService', () => {
  it('normalizes email and phone for identity matching', () => {
    expect(normalizeEmail('  Test@Example.COM ')).toBe('test@example.com');
    expect(normalizePhone('+91 98765-43210')).toBe('9876543210');
    expect(normalizeName('  Jane   Doe ')).toBe('Jane Doe');
  });

  it('builds email-first identity keys with phone fallback', () => {
    expect(identityKey('a@b.com', '9999999999')).toBe('e:a@b.com');
    expect(identityKey('', '8888888888')).toBe('p:8888888888');
    expect(identityKey('', '')).toBe('');
  });

  it('detects IML offerings', () => {
    expect(isIMLOffering('IML Masterclass')).toBe(true);
    expect(isIMLOffering('Vocal basics')).toBe(false);
  });

  it('maps havells rows and collapses non-attendee status to registered inlet', () => {
    const mapped = mapHavellsRow(
      { Name: 'Alice', Email: 'alice@example.com', Phone: '9876543210' },
      'reports/non_attendees/non_attendees_delhi.csv',
      'havells_non_attended_delhi'
    );
    expect(mapped.statusKey).toBe('havells_registered');
  });

  it('dedupes havells identities by email then phone', () => {
    const records = [
      { email: 'dup@example.com', phone: '1111111111', statusKey: 'havells_registered' },
      { email: 'dup@example.com', phone: '2222222222', statusKey: 'havells_selected' },
      { email: '', phone: '3333333333', statusKey: 'havells_registered' },
      { email: '', phone: '3333333333', statusKey: 'havells_selected' },
    ];
    const set = buildHavellsIdentitySet(records);
    expect(set.size).toBe(2);
    expect(set.get('e:dup@example.com').statusKeys).toEqual(
      expect.arrayContaining(['havells_registered', 'havells_selected'])
    );
  });

  it('links phone-only rows to email when phone seen on an email row', () => {
    const records = [
      { email: 'person@example.com', phone: '9999999999', statusKey: 'havells_registered' },
      { email: '', phone: '9999999999', statusKey: 'havells_selected' },
    ];
    const set = buildHavellsIdentitySet(records);
    expect(set.size).toBe(1);
    expect(set.get('e:person@example.com').statusKeys).toEqual(
      expect.arrayContaining(['havells_registered', 'havells_selected'])
    );
  });
});

describe('dataHubDiffExportService', () => {
  it('excludes HolySheet artist/PR contacts from DB-minus-Havells export', () => {
    const people = [
      { name: 'Artist', email: 'artist@example.com', phone: '', inArtistPath: true, inlets: [] },
      {
        name: 'PR',
        email: 'pr@example.com',
        phone: '',
        inlets: [{ key: 'outsourced', summary: { sourceFilename: 'holysheet_pr.csv', role: 'PR' } }],
      },
      { name: 'Keep', email: 'keep@example.com', phone: '9999999999', inlets: [] },
    ];
    const havellsRecords = [
      { email: 'keep@example.com', phone: '9999999999', statusKey: 'havells_registered' },
    ];
    const { rows, excludedArtistPr } = buildDbMinusHavellsRows(people, havellsRecords);
    expect(excludedArtistPr).toBe(2);
    expect(rows).toEqual([]);
  });

  it('sorts export rows with IML priority first then name', () => {
    const { rows } = buildDbMinusHavellsRows([
      { name: 'Zara', email: 'z@example.com', phone: '1111111111', imlPriority: false, inlets: [] },
      { name: 'Amy', email: 'a@example.com', phone: '2222222222', imlPriority: true, inlets: [] },
      { name: 'Ben', email: 'b@example.com', phone: '3333333333', imlPriority: false, inlets: [] },
    ], []);
    expect(rows.map((r) => r.name)).toEqual(['Amy', 'Ben', 'Zara']);
  });
  it('isHolySheetArtistOrPr flags artist path and holysheet PR rows', () => {
    expect(isHolySheetArtistOrPr({ inArtistCrm: true, inlets: [] })).toBe(true);
    expect(isHolySheetArtistOrPr({
      inlets: [{ key: 'outsourced', summary: { sourceFilename: 'holy sheet artists.csv', category: 'artist' } }],
    })).toBe(true);
    expect(isHolySheetArtistOrPr({ inlets: [{ key: 'leads' }] })).toBe(false);
  });
});

describe('dataInlets taxonomy', () => {
  it('buildInletGroups rolls up havells and media subfolders', () => {
    const groups = buildInletGroups({
      havells_registered: 10,
      havells_selected: 5,
      media_pr: 3,
      leads: 2,
    });
    const havells = groups.find((g) => g.key === 'havells');
    const media = groups.find((g) => g.key === 'media');
    expect(havells.total).toBe(15);
    expect(media.total).toBe(3);
  });
});
