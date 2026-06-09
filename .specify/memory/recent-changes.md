# Recent changes

## 2026-06-09 — CRM registered location breakdown

- Campaign `GET /api/campaigns/:id` and aggregate `/api/analytics/cumulative` attribute opens/clicks to each recipient's **CRM city** (`Lead.location` / `Lead.city`, `PersonIndex.city` fallback) — not IP geo.
- New `server/utils/campaignRegisteredLocation.js`; removed orphan `server/utils/campaignLocationGeo.js`.
- UI: `RegisteredLocationBarChart` on campaign detail (mini + large charts) and Emails → Aggregate Analytics.
- Scripts: `rebuildCampaignLocationBreakdown.js` and `backfillCampaignFromResend.js` persist CRM breakdown after Resend backfill.
- Production: **Testing Campaigns** (`c4c40e028d464384e4ba45a4`) backfilled from Resend (274 emails) and CRM location breakdown updated (Mumbai, Ludhiana, Vadodara, Bengaluru, …).
