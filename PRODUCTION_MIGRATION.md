# Production Migration Guide

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
systemctl restart taskmaster  # or your service name
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
