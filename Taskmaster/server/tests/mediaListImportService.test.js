const { MEDIA_SHEETS } = require('../data/mediaSheetManifest');
const { mapRow } = require('../services/mediaListImportService');

describe('mediaListImportService', () => {
  const standardSheet = MEDIA_SHEETS.find((s) => s.name === 'TSC Media List');

  it('maps TSC Media List CSV columns', () => {
    const row = mapRow({
      'Publication / Platform': 'Rolling Stone India',
      'Journalist Name': 'Anurag Tagat',
      Designation: 'Senior Writer & Editor',
      'Contact Email': 'anuragtagat@gmail.com',
      'Contact Phone': '9619813988',
      'Niche / Beat': 'Independent Music & Spotlights',
    }, standardSheet);

    expect(row).toMatchObject({
      publication: 'Rolling Stone India',
      journalistName: 'Anurag Tagat',
      designation: 'Senior Writer & Editor',
      contactEmail: 'anuragtagat@gmail.com',
      contactPhone: '9619813988',
      niche: 'Independent Music & Spotlights',
      sourceSheet: 'TSC Media List',
    });
  });

  it('carries forward publication on blank rows', () => {
    const context = { lastPublication: '' };
    const first = mapRow({
      'Publication / Platform': 'DNA',
      'Journalist Name': 'Aman Wadhwa',
      'Contact Email': 'cs@dnaindia.net',
    }, standardSheet, context);

    const second = mapRow({
      'Publication / Platform': '',
      'Journalist Name': 'Aniruddha Guha',
      'Contact Email': 'anirudhguha13@gmail.com',
    }, standardSheet, context);

    expect(first.publication).toBe('DNA');
    expect(second.publication).toBe('DNA');
  });

  it('skips empty rows', () => {
    expect(mapRow({}, standardSheet)).toBeNull();
  });
});
