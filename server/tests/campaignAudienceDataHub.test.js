const {
  listDataHubAudienceContacts,
  listDataHubAudienceFolders,
  dataHubContactToRowData,
  CAMPAIGN_DATA_HUB_FOLDER_KEYS,
  sanitizeInletKeys,
  buildInletFlagCondition,
  buildInletAudienceQuery,
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

  it('sanitizeInletKeys drops invalid and unsubscribed keys', () => {
    expect(sanitizeInletKeys(['leads', 'exly', 'unsubscribed', 'bogus', 'leads']))
      .toEqual(['leads', 'exly']);
  });

  it('buildInletFlagCondition maps folder keys to PersonHubView flags', () => {
    expect(buildInletFlagCondition('leads')).toEqual({ inCRM: true });
    expect(buildInletFlagCondition('booked_calls')).toEqual({ inBookedCalls: true });
    expect(buildInletFlagCondition('outsourced').$or).toBeDefined();
  });

  it('buildInletAudienceQuery ORs include inlets and NORs exclude inlets', () => {
    const query = buildInletAudienceQuery({
      includeInlets: ['leads', 'exly'],
      excludeInlets: ['newsletter'],
      extra: { email: { $exists: true } },
    });
    expect(query.email).toEqual({ $exists: true });
    expect(query.$and).toEqual(expect.arrayContaining([
      { $or: [{ inCRM: true }, { inExly: true }] },
      { $nor: [{ inNewsletter: true }] },
    ]));
  });

  it('buildInletAudienceQuery with only exclude applies nor clauses', () => {
    const query = buildInletAudienceQuery({
      excludeInlets: ['booked_calls'],
      extra: { unsubscribed: { $ne: true } },
    });
    expect(query.$and).toEqual(expect.arrayContaining([
      { $nor: [{ inBookedCalls: true }] },
    ]));
  });
});
