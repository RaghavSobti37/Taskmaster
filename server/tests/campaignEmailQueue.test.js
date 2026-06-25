const { buildCampaignEmailJobId } = require('../services/campaignEmailQueue');

describe('campaignEmailQueue', () => {
  describe('buildCampaignEmailJobId', () => {
    it('builds a stable id from campaign and recipient', () => {
      expect(buildCampaignEmailJobId('abc123', 'def456')).toBe('abc123__def456');
    });

    it('never contains colons (BullMQ rejects them)', () => {
      const id = buildCampaignEmailJobId('507f1f77bcf86cd799439011', '507f191e810c19729de860ea');
      expect(id).not.toMatch(/:/);
    });
  });
});
