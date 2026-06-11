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
- Activity timeline, @mentions with unread receipts
- Bug report FAB → `POST /api/tasks/bug` → Tech Stack project
- Completed tasks hidden after 2 days (`taskListFilter.js`)

---

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

- Email hub at `/emails/*` — templates, campaigns, profiles, analytics
- `MailTemplateStudio` — draft → submit → approve workflow
- HolySheet contact sync, indexed merge tokens (`{{1}}`, `{{2}}`)
- Campaign detail at `/campaign/:campaignId`
- **Registered location breakdown** — CRM city (not IP geo)
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
- **Pages:** `/artists/:id`, `/admin/artist-path`

---

## Notifications & Inbox

- Tri-channel: in-app, email, Web Push
- Categories: task, crm, attendance, announcement, department, review, system
- Deep links via `actionUrl` + `FlashHighlight`
- **Page:** `/inbox`

---

## Dashboard

- Three-column layout, customizable widget grid
- Widgets: todos, calendar, pinboard, notes, schedule, leaderboard, leave, backup, dept-stats
- Per-widget lazy loading (`dashboardWidgetLoaders.js`)

---

## Schedule & Calendar

- Team schedule grid at `/schedule`
- Calendar with musical_day public events (35 seeded from PDF)
- Past-date guard (client + server)

---

## Assets & Org Accounts

- `/assets` file links, `/assets/accounts` managed credentials
- Access: admin, artist-management, or operations

---

## Admin tooling

| Tool | Path |
| --- | --- |
| QA Testing (209+ cases) | `/admin/qa` |
| Script runner (31 scripts) | `/admin/scripts` |
| System logs | `/management/ops-logs` |
| Platform roles | Settings → Departments (admin) |

---

## Search & Command Palette

- Unified search: `GET /api/search`
- Command palette: `Cmd/Ctrl+K`
- Keyboard shortcuts: `?`, `G` chords, `/`

---

## Artist OS

- Nested routes under artist detail � command center, calendar, content, contracts, documents, finance, gigs, inquiries, notes, analytics
- ArtistOSLayout, ArtistOsQueryShell, hooks in client/src/hooks/queries/artistOs.js
- Team access: client/src/utils/artistTeamAccess.js

---

## Admin & roles

- AdminRolesPage, PagePermissionsEditor � department page keys synced with server gates
- System health card on dashboard (systemHealth.js)
