const {
  listDataHubAudienceContacts,
  listDataHubAudienceFolders,
  dataHubContactToRowData,
  CAMPAIGN_DATA_HUB_FOLDER_KEYS,
} = require('../domains/mail/services/campaignAudienceService');

describe('campaignAudienceService — Data Hub', () => {
  it('exports listDataHubAudienceContacts', () => {
    expect(typeof listDataHubAudienceContacts).toBe('function');
  });

  it('exports listDataHubAudienceFolders', () => {
    expect(typeof listDataHubAudienceFolders).toBe('function');
  });

  it('CAMPAIGN_DATA_HUB_FOLDER_KEYS excludes unsubscribed', () => {
    expect(CAMPAIGN_DATA_HUB_FOLDER_KEYS).not.toContain('unsubscribed');
    expect(CAMPAIGN_DATA_HUB_FOLDER_KEYS).toContain('leads');
    expect(CAMPAIGN_DATA_HUB_FOLDER_KEYS).toContain('booked_calls');
  });

  it('dataHubContactToRowData maps inlet labels', () => {
    const rowData = dataHubContactToRowData({
      name: 'Test User',
      email: 'test@example.com',
      inletLabels: ['Exly', 'Leads'],
    }, 'exly');
    expect(rowData.source).toBe('Exly');
    expect(rowData.inlets).toBe('Exly, Leads');
  });
});
