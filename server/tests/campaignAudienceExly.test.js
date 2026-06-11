const {
  listExlyAudienceContacts,
  exlyContactToRowData,
} = require('../domains/mail/services/campaignAudienceService');

describe('campaignAudienceService — Exly', () => {
  it('exports listExlyAudienceContacts', () => {
    expect(typeof listExlyAudienceContacts).toBe('function');
  });

  it('exlyContactToRowData maps offering labels', () => {
    const rowData = exlyContactToRowData({
      name: 'Test User',
      email: 'test@example.com',
      exlyOfferings: [{ title: 'Artist Path' }, { title: 'Community' }],
    });
    expect(rowData.offering).toBe('Artist Path, Community');
    expect(rowData.source).toBe('Exly');
  });
});
