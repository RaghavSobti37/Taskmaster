# Features

## Production backup (admin)

- **Dashboard:** `Last Backup` widget — latest snapshot, recent 2 list, **Run** with progress bar.
- **Data Hub:** toolbar **DB Backup** — same async API, confirm dialog, system log on completion.
- **Destination:** Supabase Storage bucket `taskmaster-backups` (default); badge shows destination in widget.
- **Retention:** `BACKUP_RETENTION_COUNT` (default 2) on Supabase; Mongo GridFS cleared after each success.
- **Cron:** Render `CoreKnot-daily-backup` or `npm run backup:daily`.

## Supabase secondary data

| Stream | Supabase table / bucket |
| --- | --- |
| Daily snapshots | `backup_snapshots`, `backup_files`, Storage |
| App logs | `app_logs` |
| System logs | `system_logs` |
| CRM audits | `crm_audits` |
| XP / QA audits | `xp_audit_logs`, `qa_test_runs` |
| Mail rollups | `mail_event_tag_rollups`, `mail_geo_rollups` |
| CRM stat cache | `crm_stat_snapshots` |

## Email campaigns

- **Campaign detail** (`/campaign/:campaignId`): stats, engagement over time, **registered location breakdown** (CRM city), recipient delivery log.
- **Aggregate analytics** (`/emails` analytics tab): cumulative performance by event tag + registered location chart; reads Supabase rollups when available.

## Data sources for location charts

| Source | Used for charts |
| --- | --- |
| `Lead.location` / `Lead.city` | Primary |
| `PersonIndex.city` | Fallback when no Lead row |
| MailEvent Open/Click | Counts only — city from CRM map, not event IP |
