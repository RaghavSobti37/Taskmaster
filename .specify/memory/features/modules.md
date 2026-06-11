# Feature Modules

Each module below maps to routes, pages, and services. Full API detail in [MASTER.md](../MASTER.md) §15.

---

## Projects & Workspaces

- CRUD projects, members, roles, workload, hours, analytics
- Project goals/KRA with snapshot history
- Optimistic concurrency via `__v` on project updates
- **Pages:** `/projects`, `/projects/:id`, `/projects/:id/analytics`

---

## Tasks & Review Workflow

- Status flow: `todo` → `in-progress` → `in-review` → `done`
- Assignees via `TaskAssignment` join — creator on `task.createdBy` only
- **Assignment:** Any authenticated user may assign any tenant user (directory-scoped); project role does not gate assignment. On create or reassignment, assigner becomes `createdBy`. Viewer role still blocks task mutations on a project.
- Activity timeline, @mentions with unread receipts
- Bug report FAB → `POST /api/tasks/bug` → Tech Stack project
- Completed tasks hidden after 2 days (`taskListFilter.js`)

---


## Daily logs (productivity)

- **Scope:** `GET /api/logs` defaults to authenticated user; `userId=all` admin-only; non-admins cannot pass another user's id
- **Client:** `DailyLogPage` uses self or admin impersonation id only — no `?user=` override
- **Page:** `/daily-log` (attendance metrics tie-in via `shared/attendanceMetrics.js`)

## CRM & Leads

- Lead CRUD, follow-ups, EMIs, audit logs, stats
- Strict phone validation — E.164 normalization, HTTP 409 on duplicate
- Booked calls via website webhook (2:1:1 rep split)
- Artist CRM (`crmType: artist`) — 6-sheet CSV import
- **Pages:** `/crm` (Leads, Followups, Bookings tabs)

---

## Data Hub & Data Master

- Admin at `/admin` — unified person graph across inlets
- Inlets: Exly, Leads, HolySheet, Booked Calls, Enquiries, Mail, Community, Artist Path, Newsletter, Outsourced
- Person spine: `Person` + `PersonIdentifier` + `PersonHubView`
- Spec: `docs/DATA_MASTER_ARCHITECTURE.md`

---

## Email & Campaigns

- **Mail Template Studio:** Raw HTML inline images (Uploadthing) with optional pre-upload crop (`react-easy-crop`, `MailTemplateImageCropModal`)
- **Campaign wizard:** `CampaignWizardShell` seeds `subject` from `?subject=` via `URLSearchParams` only — no double `decodeURIComponent` (subjects with `%` safe)
- **Campaign audience:** Source tiles CSV / HolySheet / CRM / **Exly** / Manual; Exly via `GET /api/mail/audience/exly` (`ExlyBooking`); CRM filters (`leadStatus`, `contactCategory`, `artistProject`); Select all + Deselect all
- Email hub at `/emails/*` — templates, campaigns, profiles, analytics
- `MailTemplateStudio` — draft → submit → approve workflow
- HolySheet contact sync, indexed merge tokens (`{{1}}`, `{{2}}`)
- Campaign detail at `/campaign/:campaignId`
- **Recipient CSV export** — `GET /api/campaigns/:id/recipients/export?status=&hideInvalid=` returns name/number/email from rowData or linked Lead
- **Registered location breakdown** — CRM city (not IP geo)
- **Resend webhooks** — `resendWebhookHandler.js` sets `MailEvent.tenantId` from campaign (Lead fallback); skips event row if unresolved (no 500)
- **Email engine LOCKED** — `docs/EMAIL_ENGINE_LOCKED.md`

---

## Newsletter

- Issues, articles, curate, compile, preview, send
- Routes: `/api/newsletter/*`

---

## Finance

- Document upload (UploadThing), OCR extraction, folder hierarchy
- Invoice/reimbursement submission + ops approval queue
- USD/INR live rate sync
- **Page:** `/management?tab=finance`

---

## Attendance

- Manual Office/WFH toggle (`WorkModeToggle.jsx`)
- Worked vs daily-log metrics (`shared/attendanceMetrics.js`)
- Leave requests with ops approval
- Checkout reminder cron 6:30 PM IST
- **Pages:** `/attendance`, `/attendance/all`

---

## Gamification

- XP from task completion, daily logs, attendance
- Time cap: 12h per event; daily log 8h base + 1.5× overtime
- Weekly reset Monday 00:00 IST
- **Page:** `/admin/gamification`

---

## Artists & Artist Path

- Artist detail with Spotify/YouTube/Meta connections
- Artist Path admin at `/admin/artist-path`
- Artist enquiry webhook → task + CRM lead
- Membership workspace + public portfolio/profile stubs (see Artist Workspace section)
- **Pages:** `/artists/:id`, `/admin/artist-path`, `/artist-workspace/:id/*`, `/artist/:slug`, `/artists/portfolio`


---

## Artist OS

- Nested routes under artist detail — command center, calendar, content, contracts, documents, finance, gigs, inquiries, notes, analytics
- ArtistOSLayout, ArtistOsQueryShell, hooks in client/src/hooks/queries/artistOs.js
- Team access: client/src/utils/artistTeamAccess.js
- **Connection hub:** ConnectionsCenter + server providers (Spotify, YouTube, Instagram); permission key `socials` via artist membership

## Artist Workspace (membership layer)

- Dedicated shell at `/artist-workspace/:id/*` — home, team, bookings, releases, settings tabs
- Shared `ArtistOverviewPanel` (OS command center + workspace home): KPIs, alerts, deep links into tabs
- **Phase 4:** Content hub + release tracker CRUD (`ArtistContentTab`, `ArtistReleasesTab`, `ArtistAsset`, `ArtistReleaseCampaign`)
- **Phase 5:** Booking pipeline (`ArtistBookingsTab`, inquiries) + finance widgets (`ArtistFinanceTab`, `ArtistFinanceEntry`)
- **Phase 6:** Portfolio dashboard KPIs/rankings/alerts (`PortfolioDashboard`, portfolio API on `artistOsService`)
- **Phase 7:** Public profile polish (`ArtistPublicProfile`) + slug editor (`ArtistWorkspaceSettings`)
- `ArtistMembership` roles + invite flow; `ArtistMembershipRoute` + `artistMemberPermissions.js`
- Accept invite: `/artist-workspace/:id/accept`; claim banner routes claimed artists into workspace
- Server: `artistMembershipService`, `artistWorkspaceService`, `artistWorkspaceController`, `connectionHubService`
- Tests: `server/tests/artistWorkspace.test.js` (+ portfolio public, route access, artist OS)


---

## Admin & roles

- AdminRolesPage, PagePermissionsEditor � department page keys synced with server gates
- System health card on dashboard (systemHealth.js)
