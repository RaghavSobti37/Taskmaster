# Production Migration Guide

## v1.7.37 — Review Workflow & Data Cleanup (2026-05-30)

Run from `server/` after deploying code to Render:

```bash
# 1. Dry run — review self-review tasks + creator backfill counts
node scripts/migrateReviewWorkflow.js --dry-run --prod

# 2. Execute — mark self-review in-review → done, backfill creator TaskAssignments
node scripts/migrateReviewWorkflow.js --execute --prod

# 3. Optional — remove demo/seed tasks (NEXUS PRIME, QUANTUM SHIFT, VOID WALKER, etc.)
node scripts/cleanupTestTasks.js --dry-run --prod
node scripts/cleanupTestTasks.js --prod
```

**What changes (no new collections):**
- `TaskAssignment` rows backfilled for creators missing self-assignee row
- Legacy `in-review` tasks with only self-assignments → `done`
- Review queue logic is code-only (`shared/taskReviewRules.js`); no schema migration required

**Attendance / calendar:** client-side holiday list (`officeHolidays.js`); no DB migration.

---

## Overview
This guide provides scripts to migrate your production database to the new structure:
- Adds `order` field to workspaces for drag-reorder functionality
- Deletes SOCIAL MEDIA workspace
- Migrates projects from SOCIAL MEDIA to GENERAL

## Prerequisites
- Access to production MongoDB instance
- Node.js environment with required packages
- Updated codebase with latest schema changes

## Migration Scripts

### 1. Local Development Migration
**File:** `server/scripts/migrate-local.js`
- Adds `order` field to workspaces
- Keeps SOCIAL MEDIA workspace (for local testing)
- Safe to run multiple times

**Usage:**
```bash
node server/scripts/migrate-local.js
```

### 2. Production Migration
**File:** `server/scripts/migrate-production.js`
- Adds `order` field to workspaces
- Migrates all SOCIAL MEDIA projects to GENERAL workspace
- Deletes SOCIAL MEDIA workspace
- **WARNING:** Use only on production. Run once.

**Usage:**
```bash
# On production server
MONGODB_URI="mongodb://user:pass@host:port/dbname" node server/scripts/migrate-production.js
```

### 3. Workspace Data Sync (Local → Production)
**File:** `server/scripts/sync-workspaces-to-prod.js`
- Syncs all workspace data from local to production as-is
- Preserves `name`, `color`, `order`, and all other fields
- Uses upsert to avoid duplicates and update existing workspaces
- Safe to run multiple times
- **Requires:** Both `MONGODB_URI` and `MONGODB_URI_PROD` set in `.env`

**Usage:**
```bash
# Ensure .env has both URIs
node server/scripts/sync-workspaces-to-prod.js
```

**Example .env:**
```
MONGODB_URI=mongodb://localhost:27017/CoreKnot
MONGODB_URI_PROD=mongodb://user:pass@prod-host:port/CoreKnot
```

## Step-by-Step Deployment

### Step 1: Backup Production Database
```bash
mongodump --uri="mongodb://user:pass@host:port/dbname" --out ./backup-$(date +%Y%m%d-%H%M%S)
```

### Step 2: Deploy Updated Code
```bash
git pull origin main
npm install
npm run build
```

### Step 3: Run Production Migration
```bash
# Set MongoDB connection
export MONGODB_URI="mongodb://user:pass@host:port/dbname"

# Run migration
node server/scripts/migrate-production.js
```

### Step 3b: Sync Workspace Data (Optional - if workspaces exist locally)
```bash
# If you've created new workspaces locally and want to sync them to production:
# Ensure .env has both MONGODB_URI and MONGODB_URI_PROD
node server/scripts/sync-workspaces-to-prod.js
```

### Step 4: Verify Migration
```bash
# Check workspaces collection
mongosh "mongodb://user:pass@host:port/dbname"
> db.workspaces.find().sort({ order: 1 }).pretty()
> db.projects.countDocuments({ workspace: 'SOCIAL MEDIA' })  // Should be 0
```

### Step 5: Restart Application
```bash
# Restart your Node.js server
systemctl restart CoreKnot  # or your service name
pm2 restart app
# or your deployment method
```

## Rollback (if needed)
```bash
# Restore from backup
mongorestore --uri="mongodb://user:pass@host:port/dbname" ./backup-YYYYMMDD-HHMMSS
```

## What the Migration Does

1. **Adds `order` field:**
   - Every workspace gets an order value (0-indexed)
   - Order: TSC ACADEMY → TSC ARTISTS → TSC FILMS → TSC TECH → GENERAL

2. **Migrates projects:**
   - Projects in SOCIAL MEDIA workspace → moved to GENERAL
   - Task data remains intact
   - User data untouched

3. **Deletes SOCIAL MEDIA:**
   - Workspace removed from database
   - Frontend will not show this workspace

## Data Preserved
✅ All projects
✅ All tasks
✅ All user data
✅ All project assignments
✅ All workspace settings (except SOCIAL MEDIA)

## Backend Changes Summary
- `Workspace.js`: Added `order` field
- `projectController.js`: Added `reorderWorkspaces()` endpoint, removed SOCIAL MEDIA from defaults
- `projectRoutes.js`: Added `PUT /api/projects/workspaces` route

## Frontend Changes Summary
- Workspace drag-and-drop reorder (admin only)
- Warm leads filter (meaningfulConnect = YES)
- Converted leads filter (leadStatus = Converted)
- Task table workspace colors
- All modals use ModalShell for consistent sizing
- Settings: Discord-style save bar, signout button
- Sidebar: Removed settings/logout links

## Questions?
Check logs in production:
```bash
tail -f logs/application.log | grep -i workspace
```
