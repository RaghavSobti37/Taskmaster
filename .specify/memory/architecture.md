# Architecture

## Backup flow (Supabase primary)

```mermaid
flowchart LR
  widget[Last Backup / Data Hub Run]
  API[POST /api/data-hub/backup]
  mongo[(MongoDB prod read)]
  storage[Supabase Storage]
  meta[(backup_snapshots Postgres)]
  gridfs[(Atlas GridFS taskmaster_backups)]
  widget --> API
  API --> mongo
  mongo --> storage
  mongo --> meta
  storage --> meta
  meta --> purge[Purge GridFS snapshots]
  purge --> gridfs
```

- Default `BACKUP_DESTINATION=supabase` when `SUPABASE_*` configured.
- List backups: `GET /api/data-hub/backups` reads Supabase metadata first.
- Progress: in-memory `getBackupProgress()` polled at `GET /api/data-hub/backup/progress`.

## Supabase secondary store

```mermaid
flowchart LR
  mongo[(Mongo primary)]
  mirrors[post-save mirrors + cron sync]
  pg[(Supabase Postgres)]
  rollups[mail_event_tag_rollups / geo_rollups]
  mongo --> mirrors --> pg
  analytics[/api/analytics/cumulative] --> rollups
  rollups --> pg
```

- Schema: `server/supabase/schema.sql`
- Services: `server/services/supabase/*`
- Mongo not purged for logs/analytics until explicit user approval.

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
- IP geo (`geoLookup.js`, `track.js`) unchanged for tracking; charts use CRM city.
