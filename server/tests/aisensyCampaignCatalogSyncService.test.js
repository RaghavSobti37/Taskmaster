const {
  inferTagsFromCampaignName,
} = require('../services/aisensyCampaignCatalogSyncService');

describe('aisensyCampaignCatalogSyncService', () => {
  it('infers havells tags from campaign name', () => {
    expect(inferTagsFromCampaignName('Havells mYOUsic Dumka Message 1 FAILED AUDIENCE')).toEqual(
      expect.arrayContaining(['havells', 'dumka', 'failed_audience']),
    );
  });
});
