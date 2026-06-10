# Conventions

## Pre-push audits

- `npm run audit:exposure` — required before commit.
- `npm run audit:deadcode` — required before push; no orphan `client/src/utils` or `server/utils` modules.

## Locked areas

- Email tracking/geo in `track.js` / `geoLookup.js` — do not change for chart work; CRM breakdown is separate (`campaignRegisteredLocation.js`).
- Logo/spinner — `docs/LOGO_LOCKED.md`.
- Production hosts — `.cursor/production-hosts.local.json` (gitignored).

## Supabase / backup scripts

```bash
npm run supabase:setup --prefix server
npm run supabase:migrate --prefix server
npm run supabase:health --prefix server
npm run backup:verify-supabase --prefix server
npm run backup:daily --prefix server
```

- `BACKUP_DESTINATION=supabase` default when Supabase configured.
- **Render:** `SUPABASE_PG_MODE=rest` (auto) — requires `SUPABASE_URL` + `SUPABASE_SECRET_KEY`; `SUPABASE_DB_URL` optional on API.
- Do not delete Mongo log/mail collections without explicit user approval — backups GridFS only auto-purge.

## Campaign location scripts

```bash
node server/scripts/rebuildCampaignLocationBreakdown.js <campaignId> [--dry-run] [--prod]
node server/scripts/backfillCampaignFromResend.js <campaignId> [--dry-run] [--prod]
```
