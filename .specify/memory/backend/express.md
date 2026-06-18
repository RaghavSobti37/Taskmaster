# Backend (Express API)

## Entry point

`server/server.js` → `server/app/startServer.js` — middleware, domain routes, workers, graceful shutdown, SystemHealthService.

**Production port:** 5000 (Render binds `0.0.0.0:$PORT`)

---

## Domain modules (`server/domains/`)

| Domain | Description |
| --- | --- |
| **auth** | Login/register/OAuth, JWT sessions, user CRUD |
| **tasks** | Tasks, assignments, activity, review workflow, mentions |
| **projects** | Workspaces, phases, KRAs, goals, workspace goals, project analytics |
| **crm** | Leads, follow-ups, CSV import, artist CRM, stats/audits |
| **data-hub** | Person spine, folder inlets, reconcile, backups |
| **mail** | Campaigns, templates, HolySheet, Resend, open/click tracking |
| **artists** | Artist hub, OAuth (Spotify/Meta), artist path, enquiries |
| **dashboard** | Dashboard metrics, attendance overview |
| **integrations** | Google Calendar/accounts, Exly, integration verify |

Legacy shims remain in `server/routes/`, `server/controllers/`, `server/models/` for backward compatibility.

---

## Route mounts (highlights)

| Mount | Purpose |
| --- | --- |
| `/api/auth` | Authentication + sessions |
| `/api/projects`, `/api/tasks` | Project + task CRUD |
| `/api/crm` | CRM leads, follow-ups |
| `/api/campaigns`, `/api/mail` | Email campaigns + templates |
| `/api/track` | Open/click tracking (LOCKED) |
| `/api/data-hub` | Data Hub sync + backup |
| `/api/attendance` | Check-in/out, leave |
| `/api/finance` | Documents, OCR, approvals |
| `/api/gamification` | XP, leaderboard |
| `/api/notifications` | In-app inbox; `GET /status-counts` includes `projects.overdue` / `projects.review` for sidebar badges |
| `/api/webhooks` | External webhook ingress |
| `/api/admin/platform-settings` | Platform roles + notification routing (admin UI) |
| `/api/admin/scripts` | Whitelisted script runner |
| `/api/qa` | QA testing runner |

Full mount table: [MASTER.md](../MASTER.md) §12

---

## Services (grouped)

| Group | Key services |
| --- | --- |
| **Core** | `TaskService`, `LeadService`, `DataHubService`, `PersonHubBuilder`, `UnifiedSearchService` |
| **Email** | `mailService`, `mailDriver`, `emailProcessor`, `holySheetService` |
| **CRM/Artists** | `artistEnquiryService`, `artistPathImportService`, `orgAccountImportService` |
| **Infra** | `SystemHealthService`, `systemLogService`, `databaseBackupService`, `notificationDispatcher` |
| **Supabase** | `backupStore`, `logStore`, `snapshotStore`, `mailRollupStore`, `syncService` |
| **QA** | `qaTestingService`, `qa/qaSuite4V19`, `qa/qaIntegrationTests` |

---

## Workers

| Worker | Purpose |
| --- | --- |
| `statsWorker.js` | Periodic stats aggregation |
| `webhookWorker.js` | Async webhook processing |
| `importWorker.js` | Bulk import jobs |
| `logArchiverWorker.js` | Log archival |
| `taskActivityPurgeWorker.js` | Trim old task activity |
| `supabaseSyncWorker.js` | Batch sync to Supabase |

---

## Validation

`server/validation/` — Zod schemas for campaigns, projects, data-hub, finance, mail, attendance. Middleware: `validateBody`, `validateQuery`, `validateParams`.

Shared contracts: `@coreknot/contracts` (`shared/contracts/`)

---

## Background jobs & cron

| Schedule | Job |
| --- | --- |
| `30 18 * * *` IST | Attendance checkout reminder |
| Monday 00:00 IST | XP weekly reset |
| Render cron | Daily backup, subscription reminders, keep-warm |

### Webhook ingress (`/api/webhooks`)

Book-call (TSC website), artist-enquiry, newsletter, masterclass-review, Meta data deletion, Instagram, Resend events.

---

## Admin script runner

31 whitelisted scripts at `/admin/scripts`. Catalog: `server/config/adminScriptsCatalog.js`. Runbook: `docs/SCRIPTS_RUNBOOK.md`.
