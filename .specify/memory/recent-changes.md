# Recent changes

## 2026-06-10 — Supabase secondary store & backup migration

- **Supabase** secondary Postgres + Storage offloads logs, audits, mail rollups, CRM snapshots, and **production DB backups** from Atlas M0.
- Mongo remains primary for live CRM, tasks, and locked email tracking; mirrors are async (`registerMirrors.js`, `supabaseSyncWorker`).
- **Backup widget** (`LastBackupCard`) + Data Hub **DB Backup** → `POST /api/data-hub/backup` writes to Supabase Storage by default (`BACKUP_DESTINATION=supabase`).
- After successful Supabase dump, **Mongo GridFS** snapshots in `taskmaster_backups` are auto-purged (`BACKUP_PURGE_MONGO_AFTER_SUPABASE=true`).
- Verified: `npm run backup:verify-supabase` — 83 collections, ~9.45 MB compressed, storage download sample OK.
- Fast prod sync: `npm run supabase:migrate`; health: `npm run supabase:health`, `GET /api/admin/supabase/health`.
- Env templates: `server/.env.example`, `server/.env.render.example`, `render.yaml` Supabase keys (`sync: false`).

## 2026-06-09 — CRM registered location breakdown

- Campaign `GET /api/campaigns/:id` and aggregate `/api/analytics/cumulative` attribute opens/clicks to each recipient's **CRM city** (`Lead.location` / `Lead.city`, `PersonIndex.city` fallback) — not IP geo.
- New `server/utils/campaignRegisteredLocation.js`; removed orphan `server/utils/campaignLocationGeo.js`.
- UI: `RegisteredLocationBarChart` on campaign detail (mini + large charts) and Emails → Aggregate Analytics.
- Scripts: `rebuildCampaignLocationBreakdown.js` and `backfillCampaignFromResend.js` persist CRM breakdown after Resend backfill.
- Production: **Testing Campaigns** (`c4c40e028d464384e4ba45a4`) backfilled from Resend (274 emails) and CRM location breakdown updated (Mumbai, Ludhiana, Vadodara, Bengaluru, …).
