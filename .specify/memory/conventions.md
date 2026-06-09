# Conventions

## Pre-push audits

- `npm run audit:exposure` — required before commit.
- `npm run audit:deadcode` — required before push; no orphan `client/src/utils` or `server/utils` modules.

## Locked areas

- Email tracking/geo in `track.js` / `geoLookup.js` — do not change for chart work; CRM breakdown is separate (`campaignRegisteredLocation.js`).
- Logo/spinner — `docs/LOGO_LOCKED.md`.
- Production hosts — `.cursor/production-hosts.local.json` (gitignored).

## Campaign location scripts

```bash
node server/scripts/rebuildCampaignLocationBreakdown.js <campaignId> [--dry-run] [--prod]
node server/scripts/backfillCampaignFromResend.js <campaignId> [--dry-run] [--prod]
```
