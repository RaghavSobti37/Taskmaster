# Architecture

## Email campaign location analytics

```mermaid
flowchart LR
  recipients[Campaign recipients] --> emailMap[buildEmailRegisteredCityMap]
  Lead[(Lead.location/city)] --> emailMap
  PersonIndex[(PersonIndex.city)] --> emailMap
  MailEvent[(Open/Click MailEvents)] --> attribute[Attribute by email]
  emailMap --> attribute
  attribute --> breakdown[locationBreakdown opens/clicks]
  breakdown --> API[GET /api/campaigns/:id]
  breakdown --> UI[CampaignDetails charts]
```

- Per-campaign: `buildRegisteredLocationBreakdown(campaignId, recipients)` in `server/utils/campaignRegisteredLocation.js`.
- Cross-campaign: `buildCumulativeRegisteredLocationBreakdown(engagedEmails)` in `analyticsController.getCumulativeMetrics`.
- IP geo (`geoLookup.js`, `track.js`) unchanged for tracking; charts no longer use it for breakdown.
- Maintenance: `node server/scripts/rebuildCampaignLocationBreakdown.js <campaignId> [--prod]`; Resend sync: `backfillCampaignFromResend.js` then CRM rebuild.
