# Server scripts runbook

All paths: `cd server && node scripts/<file>` unless `npm run <script>` exists.

**Legend:** 🟢 safe local · 🟡 prod with care · 🔴 destructive / prod data

## npm scripts (preferred)

| npm run | Script | Safety | Notes |
|---------|--------|--------|-------|
| `preflight` | `preflightEnv.js` | 🟢 | Env check before dev |
| `test` | Jest | 🟢 | CI gate |
| `sync-db` | `syncProdToLocal.js --yes` | 🔴 | Pull prod → local DB (replaces local) |
| `sync:prod-tenant-tsc` | `syncProdTenantToLocal.js --yes --slug=tsc` | 🔴 | TSC tenant only; skips Data Hub/Exly; finance metadata-only |
| `sync:prod-to-local` | `syncProdToLocal.js --yes` | 🔴 | Full prod → local (all collections) |
| `sync:prod-to-local:operational` | `syncProdToLocal.js --yes --mode=operational` | 🔴 | Operational collections only (no CRM spine) |
| `backup:daily` | `runDailyBackup.js` | 🟡 | GridFS backup (also Render cron) |
| `repair:lead-phones` | `repairCorruptPhones.js` | 🟡 | Idempotent phone repair |
| `repair:phones:prod` | same `--prod` | 🔴 | Production repair |
| `normalize:person-data` | `normalizePersonData.js --dry-run` | 🟢 | Preview only |
| `normalize:person-data:execute` | same `--execute` | 🔴 | Writes normalized persons |
| `qa:audit` / `qa:audit:prod` | `qaAuditReport.js` | 🟢 / 🟡 | QA data report |
| `qa:cleanup` / `qa:cleanup:prod` | `qaFullCleanup.js` | 🟡 / 🔴 | Remove QA test artifacts |
| `reset-weak-passwords:*` | `resetWeakUserPasswords.js` | 🔴 | Needs `RESET_WEAK_PASSWORDS_CONFIRM=1` for `--apply` |
| `reconcile:datahub:prod` | `reconcileDataHub.js` | 🔴 | Prod Data Hub reconcile |
| `seed:music-calendar:prod` | `seedMusicContentCalendar.js --prod` | 🔴 | Prod content seed |
| `import-finance` | `importInvoices.js` | 🟡 | Finance import (OCR optional) |

## Dev & infra

| Script | Safety | Purpose |
|--------|--------|---------|
| `freePort.js` | 🟢 | Used by `predev` — free port 5000 |
| `preflightEnv.js` | 🟢 | Env validation |
| `generateER.js` | 🟢 | ER diagram generation |
| `testRealtime.js` | 🟢 | Socket smoke |
| `testNotifications.js` | 🟢 | Notification smoke |
| `testBackupNow.js` | 🟡 | Manual backup test |
| `smokeEmailFlowLive.js` | 🟡 | Live email flow (needs keys) |

## QA & audit

| Script | Safety | Purpose |
|--------|--------|---------|
| `runQAScan.js` / `runQATests.js` | 🟡 | Project QA automation |
| `qaRunIntegrationSubset.js` | 🟡 | Subset integration |
| `triggerQaHttp.js` | 🟡 | HTTP-trigger QA |
| `verifyQaCleanup.js` | 🟢 | Verify QA purge |
| `qaPurgeNow.js` | 🟡 | Immediate QA purge |
| `masterAudit.js` / `fullProjectAudit.js` | 🟢 | Read-only audits |
| `userFlowAudit.js` / `performanceAudit.js` | 🟢 | Performance / flow reports |
| `realPerformanceAudit.js` / `generateAudit.js` | 🟢 | Static performance reports |

## Migrations (one-time — run once per environment, then archive)

| Script | Safety | Purpose |
|--------|--------|---------|
| `migrateTaskStructure.js` | 🔴 | TaskAssignment migration (`--unset-legacy`) |
| `migrateTaskSchema.js` | 🔴 | Task field normalization |
| `migrateCreatorAssigneeSplit.js` | 🔴 | Creator vs assignee split |
| `migrateReviewWorkflow.js` | 🔴 | Review workflow |
| `migrateRoleToDepartment.js` | 🔴 | Role → department |
| `migrateDepartmentPresets.js` | 🔴 | Department presets |
| `migrateDepartmentPagePermissions.js` | 🔴 | Page permissions |
| `migrateArtists.js` / `migrateToArtistConnections.js` | 🔴 | Artist models |
| `migrateExlyOfferings.js` | 🔴 | Exly offerings |
| `migrateTscFilmsTasks.js` / `splitTscFilmsProjects.js` | 🔴 | TSC Films split |
| `migrate-local.js` / `migrate-production.js` | 🔴 | Bundled migrations |
| `backfillPasswordChangedAt.js` | 🔴 | Password metadata |

## Data repair & sync

| Script | Safety | Purpose |
|--------|--------|---------|
| `repairCorruptPhones.js` | 🟡/🔴 | Phone dedup (`--local` / `--prod`) |
| `auditLeadPhones.js` / `scanCorruptPhones.js` | 🟢 | Read-only phone audit |
| `normalizePersonData.js` | 🟡/🔴 | Person normalization |
| `syncProdToLocal.js` | 🔴 | DB sync (`npm run sync-db`) — replaces all local collections |
| `syncProdTenantToLocal.js` | 🔴 | Tenant-scoped prod → local (`npm run sync:prod-tenant-tsc`); skips Data Hub/Exly; finance lite |
| `consolidatePlatformTenant.js` | 🔴 | Keep one tenant, rename slug, cascade-delete others (`--new-slug` / `--keep-slug`; `--prod --yes`) |
| `restorePlatformTenantSetup.js` | 🟡/🔴 | Re-enable all `featureUnlocks` + clear `mustChangePassword` for Clerk users on platform tenant |
| `syncDataHubToProd.js` / `compareDataHubDbs.js` | 🔴 | Data Hub prod sync |
| `syncFinanceToProd.js` | 🔴 | Finance → prod |
| `sync-workspaces-to-prod.js` | 🔴 | Workspaces → prod |
| `reconcileDataHub.js` | 🔴 | Data Hub reconcile |
| `restoreBackupCollection.js` | 🔴 | Restore from backup |
| `listBackups.js` | 🟢 | List GridFS backups |

## Seeds & content

| Script | Safety | Purpose |
|--------|--------|---------|
| `seedDepartmentsAndTaskTypes.js` | 🟡 | First-time local seed |
| `seedProductionContent.js` | 🔴 | Prod seed |
| `seedMusicContentCalendar.js` | 🟡/🔴 | Calendar seed |
| `assignBigSmileAvatars.js` | 🟡 | One-time avatar assignment (archive after use) |
| `resolveScriptAdminUserId.js` | 🟢 | Resolve QA admin from Platform roles / env |

## Finance & imports

| Script | Safety | Purpose |
|--------|--------|---------|
| `importInvoices.js` | 🟡 | Invoice import |
| `importBasecampInvoices.js` | 🟡 | Basecamp import |
| `reparseFinanceOcr.js` | 🟡 | Re-run OCR |
| `deleteFinanceFolders.js` / `reorganizeFinanceFolders.js` | 🔴 | Finance tree changes |

## Cleanup & dangerous

| Script | Safety | Purpose |
|--------|--------|---------|
| `qaFullCleanup.js` | 🟡/🔴 | QA artifact purge |
| `cleanupTestTasks.js` | 🔴 | Delete test tasks |
| `resetAttendance.js` | 🔴 | Reset attendance |
| `keepOnlyCampaign.js` | 🔴 | Campaign data prune |
| `resetWeakUserPasswords.js` | 🔴 | Force password resets |
| `setUserRole.js` / `setUserDepartment.js` | 🔴 | User admin overrides |
| `dbPush.js` | 🔴 | Push schema/data — verify before run |

## HolySheet / legacy

| Script | Safety | Purpose |
|--------|--------|---------|
| `clean_holysheet.js` / `split_holysheet_contacts.js` | 🟡 | Legacy sheet utilities |

## Admin Script Runner (`/admin/scripts`)

The UI lists only entries in **`server/config/adminScriptsCatalog.js`** (not every file in `server/scripts/`). Duplicates and one-off migrations are excluded. Danger-tier scripts use a red Run button.

## Rules

1. **Never** run 🔴 scripts against production without backup + [`DATA_BACKUP.md`](./DATA_BACKUP.md).
2. Prefer `npm run` aliases — they encode flags documented in `server/package.json`.
3. After a one-time migration succeeds in prod, note the date in git commit / changelog — do not re-run blindly.
4. Run `npm run preflight` before `npm run dev`.
