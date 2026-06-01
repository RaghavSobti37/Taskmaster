# Production Data Backup

CoreKnot runs a **daily full-database backup** of production MongoDB into a separate backup database on the same Atlas cluster. Backups are compressed, retained for 7 days, and you receive a success/failure email after each run.

## Overview

| Item | Value |
|------|-------|
| Schedule | **12:01 AM IST** daily (`31 18 * * *` UTC on Render) |
| Source | Production DB (`MONGODB_URI_PROD` or `MONGODB_URI`) |
| Destination | `taskmaster_backups` (configurable via `MONGODB_BACKUP_DB`) |
| Retention | **7 days** — oldest snapshot auto-deleted on day 8 |
| Format | Gzipped NDJSON per collection in GridFS |
| Notification | Email via Resend to `BACKUP_NOTIFY_EMAIL` or `ADMIN_EMAIL` |

**Not covered by this system:** CRM real-time CSV export (`leads.csv`) still runs separately via `csvBackupService.js` on lead mutations. That is a lightweight CRM export, not a full DB backup.

## Architecture

```
Render Cron (12:01 AM IST)
        │
        ▼
runDailyBackup.js
        │
        ├── cleanup snapshots older than 7 days
        ├── stream each prod collection (read: secondaryPreferred)
        ├── gzip → GridFS in taskmaster_backups
        └── email success/failure via Resend
```

### Storage model (same Atlas cluster)

| Location | Purpose |
|----------|---------|
| `taskmaster_backups.backup_snapshots` | One metadata doc per day: date, collections, sizes, expiry |
| `taskmaster_backups.backup_archives.files` | GridFS index — one file per collection per snapshot |
| `taskmaster_backups.backup_archives.chunks` | GridFS binary chunks (compressed data) |

GridFS filenames follow: `YYYY-MM-DD/<collectionName>.json.gz`

Example: `2026-05-30/leads.json.gz`

### Performance safeguards

- Runs on a **dedicated Render Cron Job** — not on the web server (avoids multi-instance collisions).
- Reads use `readPreference: secondaryPreferred` (falls back to primary on single-node tiers).
- Cursor streaming with batch size 500; 100 ms pause between collections.
- **Zero writes** to production collections — all writes go to `taskmaster_backups` only.

## Environment variables

Set these on the **Render cron service** (and locally in `server/.env` for manual runs):

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MONGODB_URI_PROD` | **Yes** | — | Production MongoDB only. **Never** falls back to local `MONGODB_URI`. Local DB names (`CoreKnot`, `taskmaster_local`, `testing`) and `localhost` URIs are rejected. |
| `MONGODB_BACKUP_DB` | No | `taskmaster_backups` | Backup database name on same cluster |
| `BACKUP_RETENTION_DAYS` | No | `7` | Days to keep daily snapshots |
| `BACKUP_ENABLED` | No | `true` | Set `false` to skip backup runs |
| `BACKUP_NOTIFY_EMAIL` | No | — | Override notification recipient |
| `BACKUP_FROM_EMAIL` | No | `noreply@theshakticollective.in` | **Must be a Resend-verified domain.** Do not use unverified addresses like `sandbox@CoreKnot.io`. |
| `ADMIN_EMAIL` | Yes (email) | — | Used when `BACKUP_NOTIFY_EMAIL` is empty |
| `RESEND_API_KEY` | Yes (email) | — | Resend API key |
| `SYSTEM_VERIFIED_FROM_EMAIL` | Yes (email) | — | Verified sender address in Resend |

Template in `server/.env.example`.

## Production deployment (Render)

Blueprint: [`render.yaml`](../render.yaml)

```yaml
services:
  - type: cron
    name: CoreKnot-daily-backup
    schedule: "31 18 * * *"   # 12:01 AM IST
    rootDir: server
    buildCommand: npm install
    startCommand: node scripts/runDailyBackup.js
```

### Setup checklist

1. Sync or create the cron service from `render.yaml`.
2. Copy env vars from the main API service:
   - `MONGODB_URI_PROD`
   - `RESEND_API_KEY`
   - `ADMIN_EMAIL`
   - `BACKUP_FROM_EMAIL` (e.g. `noreply@theshakticollective.in` — must be verified in Resend)
3. Trigger **Manual Run** once in Render Dashboard.
4. Confirm success email and snapshot in Atlas/Compass under `taskmaster_backups`.

## Commands

All commands assume you are in the `server` directory and `server/.env` is configured.

```bash
cd server
```

### Run backup manually (production cron path)

```bash
npm run backup:daily
```

Equivalent:

```bash
node scripts/runDailyBackup.js
```

Exits `0` on success, `1` on failure. Sends notification email.

### Run backup with size report (test / audit)

Prints production DB size, compressed backup size, and compression ratio:

```bash
node scripts/testBackupNow.js
```

Use this after setup or when verifying Atlas storage growth.

### List available snapshots

```bash
node scripts/listBackups.js
```

Example output:

```
Backup database: taskmaster_backups

Date: 2026-05-30
  Status: completed
  Collections (51): crmaudits, leads, users, ...
  Total size: 1.9 MB
```

### Inspect a backup (dry run)

Load documents from backup without writing to production:

```bash
node scripts/restoreBackupCollection.js --date 2026-05-30 --collection leads --dry-run
```

### Export backup collection to local JSON

```bash
node scripts/restoreBackupCollection.js --date 2026-05-30 --collection leads --export ./leads-backup.json
```

### Restore a collection into production

**Warning:** inserts documents into the live production collection. Duplicate `_id` values will cause errors.

```bash
node scripts/restoreBackupCollection.js --date 2026-05-30 --collection leads
```

Prefer `--dry-run` or `--export` first to inspect data.

### Disable backup locally

```bash
# In server/.env
BACKUP_ENABLED=false
```

Or one-off:

```bash
# PowerShell
$env:BACKUP_ENABLED="false"; node scripts/runDailyBackup.js

# Bash
BACKUP_ENABLED=false node scripts/runDailyBackup.js
```

## Email notifications

After each run you receive one email:

| Outcome | Subject | Contents |
|---------|---------|----------|
| Success | `[CoreKnot] Backup succeeded — YYYY-MM-DD` | Snapshot date, **original DB size**, compressed backup size, collection count, duration, retention |
| Failure | `[CoreKnot] Backup FAILED — YYYY-MM-DD` | Error message, duration, hint to check Render cron logs |

Recipient: `BACKUP_NOTIFY_EMAIL` if set, otherwise `ADMIN_EMAIL`.

## Recovery workflows

### Find what dates are available

```bash
node scripts/listBackups.js
```

### Pull one collection from a past date

```bash
# Inspect
node scripts/restoreBackupCollection.js --date 2026-05-30 --collection tasks --dry-run

# Save locally
node scripts/restoreBackupCollection.js --date 2026-05-30 --collection tasks --export ./tasks-2026-05-30.json
```

### Browse in MongoDB Compass / Atlas

1. Connect to your Atlas cluster.
2. Open database **`taskmaster_backups`**.
3. Collections:
   - `backup_snapshots` — metadata per day
   - `backup_archives.files` — list of gzipped files (`filename`, `length`, `metadata`)
   - `backup_archives.chunks` — binary data (managed by GridFS)

Files are gzipped NDJSON. Download via Compass or restore scripts above.

### Partial rollback (single collection)

There is no full-database one-click restore. For a single collection:

1. Export from backup (`--export`) and review JSON.
2. Restore with the restore script, or use `mongoimport` / Compass import on a staging DB first.

Always test on staging before writing to production.

## Sizing reference

From a verified run (May 2026):

| Metric | Typical value |
|--------|----------------|
| Production data size | ~21 MB |
| Production indexes | ~14 MB |
| Compressed daily backup | ~2 MB |
| Compression vs data | ~9% |

Backup DB grows roughly **7 × daily compressed size** (7-day retention). Monitor Atlas disk usage as data grows.

### Check sizes via test script

```bash
node scripts/testBackupNow.js
```

Reports:

- Production: data size, index size, storage on disk
- Backup: GridFS compressed bytes, file count, backup DB storage

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| No email received (backup logs "success") | Unverified `from` domain; Resend returned 403 silently | Set `BACKUP_FROM_EMAIL=noreply@theshakticollective.in` on cron service. Verify domain in [Resend Domains](https://resend.com/domains). |
| No email received | Missing `RESEND_API_KEY`, `ADMIN_EMAIL`, or env not on cron | Set env vars on cron service; verify domain in Resend |
| Cron never runs | Service not created or wrong schedule | Confirm `31 18 * * *` UTC in Render; trigger manual run |
| `MONGODB_URI_PROD or MONGODB_URI is required` | Only prod URI allowed | Set `MONGODB_URI_PROD` to Atlas production URI (`taskmaster_production`). Do not point at local Mongo. |
| Backup succeeds, email fails | Resend error (403 domain, invalid from) | Check logs for `[Resend Error]`. Set `BACKUP_FROM_EMAIL` to verified address. |
| `Backup not found for date/collection` | Wrong date or collection name | Run `listBackups.js`; names are lowercase Mongo collection names |
| Restore duplicate key errors | Documents already exist in prod | Use `--export` and merge manually, or delete target docs first (careful) |

### Render logs

Dashboard → **CoreKnot-daily-backup** → **Logs**

Look for `[DatabaseBackup]` and `[BackupNotify]` lines.

### Verify prod-only guard

The guard **is working**. PowerShell `$env:MONGODB_URI_PROD=''` **removes** the variable (does not set empty string). Then `dotenv.config()` in scripts reloads `MONGODB_URI_PROD` from `server/.env`, so the one-liner exits silently with no error — that is expected on a dev machine with `.env` present.

**Test missing prod URI** (no `.env` reload):

```powershell
cd server
node -e "delete process.env.MONGODB_URI_PROD; try { require('./services/databaseBackupService').getSourceUri(); } catch (e) { console.log(e.message); }"
```

Expected: `MONGODB_URI_PROD is required for backups. Local MONGODB_URI is never used.`

**Test local DB blocked:**

```powershell
node -e "process.env.MONGODB_URI_PROD='mongodb://localhost:27017/CoreKnot'; try { require('./services/databaseBackupService').getSourceUri(); } catch (e) { console.log(e.message); }"
```

Expected: `Refusing to backup local database "CoreKnot"...`

On **Render cron**, there is no local `.env` — if `MONGODB_URI_PROD` is missing, the job fails and you get a failure email.

## Source files

| File | Role |
|------|------|
| `server/services/databaseBackupService.js` | Export, GridFS storage, retention cleanup |
| `server/services/backupNotificationService.js` | Success/failure email |
| `server/scripts/runDailyBackup.js` | Cron entry point |
| `server/scripts/listBackups.js` | List snapshots |
| `server/scripts/restoreBackupCollection.js` | Restore / export / dry-run |
| `server/scripts/testBackupNow.js` | Manual run + size report |
| `server/jobs/backupJob.js` | **Deprecated** — old leads-only CSV cron (not started) |
| `render.yaml` | Render cron service definition |

## Related docs

- [`PRODUCTION_MIGRATION.md`](../PRODUCTION_MIGRATION.md) — manual `mongodump` before schema migrations
- [`server/.env.example`](../server/.env.example) — backup env template
