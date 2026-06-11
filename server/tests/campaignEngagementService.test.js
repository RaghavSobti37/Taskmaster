const {
  matchesCampaignEngagementFilter,
  CAMPAIGN_ENGAGEMENT_ACTIVE,
  CAMPAIGN_ENGAGEMENT_INACTIVE,
  CAMPAIGN_ENGAGEMENT_NONE,
} = require('../domains/mail/services/campaignEngagementService');

describe('campaignEngagementService', () => {
  describe('matchesCampaignEngagementFilter', () => {
    it('allows all when filter is all or empty', () => {
      expect(matchesCampaignEngagementFilter(CAMPAIGN_ENGAGEMENT_ACTIVE, 'all')).toBe(true);
      expect(matchesCampaignEngagementFilter(CAMPAIGN_ENGAGEMENT_NONE, '')).toBe(true);
      expect(matchesCampaignEngagementFilter(undefined, 'all')).toBe(true);
    });

    it('matches active and inactive buckets', () => {
      expect(matchesCampaignEngagementFilter(CAMPAIGN_ENGAGEMENT_ACTIVE, 'active')).toBe(true);
      expect(matchesCampaignEngagementFilter(CAMPAIGN_ENGAGEMENT_INACTIVE, 'active')).toBe(false);
      expect(matchesCampaignEngagementFilter(CAMPAIGN_ENGAGEMENT_INACTIVE, 'inactive')).toBe(true);
    });

    it('treats missing engagement as none for none filter', () => {
      expect(matchesCampaignEngagementFilter(CAMPAIGN_ENGAGEMENT_NONE, 'none')).toBe(true);
      expect(matchesCampaignEngagementFilter(undefined, 'none')).toBe(true);
      expect(matchesCampaignEngagementFilter(CAMPAIGN_ENGAGEMENT_ACTIVE, 'none')).toBe(false);
    });
  });
});
