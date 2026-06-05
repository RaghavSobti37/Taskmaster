# CoreKnot Improvement Roadmap

**Created:** 2026-06-05  
**Purpose:** Track the full improvement backlog from the Jun 2026 audit. Status: `done` | `in_progress` | `planned` | `deferred`.

> **Reality check:** The original audit listed 80+ items spanning months of work (TypeScript migration, event bus, multi-tenant SaaS, etc.). This doc tracks all of them; implementation is phased.

---

## Phase A — Shipped (2026-06-05)

| Item | Status | Notes |
|------|--------|-------|
| JWT revocation on logout (Redis + memory fallback) | done | `server/utils/tokenRevocation.js`, `jti` on session tokens |
| Lead lock heartbeat + unlock on editor close | done | `POST /api/crm/leads/:id/lock-heartbeat`, `/unlock` |
| Analytics location-leads pagination | done | `page`, `limit`, `{ data, pagination }` response |
| Health check depth (Mongo + Redis + uptime) | done | `GET /api/health` |
| ESLint + Vitest in CI | done | `.github/workflows/ci.yml` |
| Client Vitest foundation | done | `vitest.config.js`, validation + palette tests |
| Keyboard shortcuts overlay (`?`) | done | `KeyboardShortcutsOverlay.jsx` |
| Data Hub filter persistence | done | `localStorage` `datahub-filters` |
| LeadsPage double-semicolon fix | done | |
| CRM WhatsApp `console.log` → logger | done | |
| Token revocation tests | done | `server/tests/tokenRevocation.test.js` |

---

## Phase B1 — Shipped (2026-06-05) — test this batch

| Item | Status | How to test |
|------|--------|-------------|
| Centralized keyboard engine | done | `client/src/lib/keyboardShortcuts.js` + `KeyboardShortcutsContext` |
| G-chords work for all depts | done | Sales user: `G` then `T` → Todo (was broken before) |
| New G-chords: H N E R O | done | `G H` Data Hub, `G N` Notes, `G E` Emails, `G R` Schedule, `G O` Office |
| Admin G-chords: U B | done | Admin only: `G U` Users, `G B` Admin Console |
| `/` opens command palette | done | Press `/` outside inputs |
| `?` shortcuts overlay | done | Press `?` — grouped list, admin chords hidden for non-admin |
| G-chord hint toast | done | Press `G` — bottom hint; invalid key shows feedback |
| Inbox filter persistence | done | Change category → reload → filter restored |
| Finance filter persistence | done | Workspace/category/sort/pageSize → reload |
| Schedule day-count persistence | done | Change horizon slider → reload |
| Data Hub copy-to-clipboard | done | Person detail → hover email/phone → copy icon |
| QA `sec-httponly-auth-cookie` fix | done | `npm test` in server — checklist passes |

### Shortcut cheat sheet (authenticated app)

| Keys | Action |
|------|--------|
| `Ctrl+K` / `⌘K` | Command palette |
| `/` | Command palette (quick search) |
| `?` | Shortcuts help |
| `G` then letter | Navigate (see `?` overlay) |
| `Esc` | Close palette / help / cancel G-chord |

---

## Phase B2 — Shipped (2026-06-05) — test this batch

| Item | Status | How to test |
|------|--------|-------------|
| Split `useTaskmasterQueries.js` by domain | done | Barrel `useTaskmasterQueries.js` → `hooks/queries/*.js`; `npm test` + `npm run build` in client |
| Virtualize Leads + Data Hub tables | done | Open Leads / Data Hub with 50+ rows — scroll stays smooth; `rowEstimateSize` + `tableMaxHeight="70vh"` |
| OpenAPI spec stub | done | `GET /api/openapi.json` — curated paths (auth, tasks, CRM, data-hub) |
| Playwright E2E smoke | done | `npm run build --prefix client` then `npm run test:e2e:public`; auth: set `E2E_EMAIL` + `E2E_PASSWORD` |
| Lighthouse public a11y gate in CI (≥90) | done | `LH_BASE_URL=http://127.0.0.1:4173 npm run lighthouse:ci` in client |
| `useUpdateProject` in `queries/projects.js` | done | Edit project name — optimistic update still works |

## Phase B3 — Shipped (2026-06-05) — test this batch

| Item | Status | How to test |
|------|--------|-------------|
| Session device list + revoke | done | Settings → Security → active sessions; revoke / sign out others |
| Sentry optional integration | done | Set `SENTRY_DSN` (server) + `VITE_SENTRY_DSN` (client); errors forward when set |
| OpenAPI session routes | done | `GET /api/openapi.json` includes `/auth/sessions*` |

### B3 test commands

```bash
# Sessions API (logged in)
curl -b cookies.txt http://localhost:5000/api/auth/sessions

# Settings UI
# /settings?tab=security

npm test --prefix server   # includes sessionRegistry.test.js
npm run build --prefix client
```

### B3 fix — session backfill

Pre-B3 logins had no registry row. `ensureSession` now backfills on first `/api/auth/sessions` or any authenticated request. Tokens without `jti` get upgraded on list. **Refresh Security tab** (no re-login needed).

---

## Phase B4 — Shipped (2026-06-05) — test this batch

| Item | Status | How to test |
|------|--------|-------------|
| Session backfill for current device | done | Settings → Security → refresh — shows “This device” |
| BullMQ queue status (ops) | done | Admin → Script Runner — “Background queues” panel; `GET /api/admin/queues/status` |
| Relative timestamp tooltips | done | Hover “Last active” on Security tab; failed job times on queue panel |

## Phase B5 — Shipped (2026-06-05) — test this batch

| Item | Status | How to test |
|------|--------|-------------|
| Zod request validation (auth + tasks) | done | `npm test --prefix server` — `validation.test.js` + `auth.test.js`; object injection → 400 |
| OpenAPI expanded routes | done | `/api/openapi.json` — attendance, notifications, dashboard, search, admin queues |
| `AdminMailContent` split (step 1) | done | `MailLocationLeadsModal.jsx` extracted; mail analytics modal still works |
| Relative timestamps in Inbox | done | Inbox → hover notification time for absolute stamp |

### B5 test commands

```bash
npm test --prefix server
npm run build --prefix client
curl http://localhost:5000/api/openapi.json
```

## Phase B13 — Shipped (2026-06-05) — test this batch

| Item | Status | How to test |
|------|--------|-------------|
| Draggable nav pill (superseded) | done | Reverted to tap-only; pill slides on click via `layoutId` |
| QuickAdd context split fix | done | No `useQuickAdd must be used within QuickAddProvider` on load |
| OpenAPI gamification + projects POST | done | `/api/openapi.json` v1.0.4 |
| `bottomNavSlots` unit test | removed | Drag nav reverted to tap-only |

### B13 test commands

```bash
npm test --prefix client
npm run build --prefix client
# Mobile — tap tabs; pill animates on click
```

### B13 deferred (Phase B14+)

| Item | Status | Est. |
|------|--------|------|
| MFA / 2FA | planned | 3–5 d |
| `useUnsavedChanges` on Notes editor, Finance, mail studio | done | NoteEditorPage, NoteComposer, FinancePage, MailTemplateStudio, MailCampaignWizard |
| Full OpenAPI coverage | planned | 2–3 d |

## Phase B12 — Shipped (2026-06-05) — test this batch

| Item | Status | How to test |
|------|--------|-------------|
| Floating pill mobile bottom nav (WhatsApp-style) | done | Phone viewport — dark inset pill, active item highlight, green badges |
| Zod on attendance query + check + leave | done | Invalid `?start={$gt:''}` → 400 |
| Zod on notifications push subscribe/unsubscribe | done | Malformed subscription body → 400 |
| OpenAPI attendance + notifications expansion | done | `/api/openapi.json` v1.0.3 |

### B12 test commands

```bash
npm test --prefix server
npm run build --prefix client
# Mobile viewport — floating nav with safe-area inset
# Active tab — gray pill highlight; badges green
curl http://localhost:5000/api/openapi.json
```

### B12 deferred (Phase B13+)

| Item | Status | Est. |
|------|--------|------|
| MFA / 2FA | planned | 3–5 d |
| Consolidate `MailCampaign` → `Campaign` | planned | 3 d (avoid locked tracking files) |
| Event bus for task → XP → project rollup | planned | 5–7 d |
| Full OpenAPI coverage for all routes | planned | 2–3 d |
| `useUnsavedChanges` on Notes, Finance, mail studio | planned | 1 d |

## Phase B11 — Shipped (2026-06-05) — test this batch

| Item | Status | How to test |
|------|--------|-------------|
| Zod on `GET /api/calendar` query | done | `?start={$gt:''}` → 400 |
| Zod on calendar POST/PUT + notes POST/PUT | done | Object injection in body → 400 |
| OpenAPI `/calendar` + `/notes` stubs | done | `/api/openapi.json` v1.0.2 |
| Toast dedupe (optimistic + interceptor) | done | `client/src/lib/toastDedupe.test.js` |
| RelativeTimestamp on Notes list + dashboard panel | done | Hover note row → absolute time tooltip |

### B11 test commands

```bash
npm test --prefix server
npm test --prefix client
npm run build --prefix client
curl http://localhost:5000/api/openapi.json
# Notes page — relative times with hover absolute
# Save lead/note — single success toast (no double)
```

### B11 deferred (Phase B12+)

| Item | Status | Est. |
|------|--------|------|
| MFA / 2FA | planned | 3–5 d |
| Consolidate `MailCampaign` → `Campaign` | planned | 3 d (avoid locked tracking files) |
| Event bus for task → XP → project rollup | planned | 5–7 d |
| Full OpenAPI coverage for all routes | planned | 2–3 d |
| Zod on attendance + notifications routes | planned | 0.5 d |

## Phase B10 — Shipped (2026-06-05) — test this batch

| Item | Status | How to test |
|------|--------|-------------|
| Schedule desktop-only on mobile | done | Phone → Schedule — amber banner + stats only; grid hidden until `lg` breakpoint |
| Zod on `GET /api/schedule` query | done | Invalid `start` query → 400 |
| `validateQuery` middleware | done | `server/validation/validateQuery.js` |
| OpenAPI `/schedule` stub | done | `/api/openapi.json` |

### B10 test commands

```bash
npm test --prefix server
npm run build --prefix client
# Mobile viewport → Schedule — desktop banner only
# Desktop → full grid + day slider
```

### B10 deferred (Phase B11+)

| Item | Status | Est. |
|------|--------|------|
| MFA / 2FA | planned | 3–5 d |
| Consolidate `MailCampaign` → `Campaign` | planned | 3 d (avoid locked tracking files) |
| Event bus for task → XP → project rollup | planned | 5–7 d |
| Full OpenAPI coverage for all routes | planned | 2–3 d |

## Phase B9 — Shipped (2026-06-05) — test this batch

| Item | Status | How to test |
|------|--------|-------------|
| Mobile schedule list (superseded by B10) | done | Replaced with desktop-only banner on phone |
| Schedule range hint | done | Day slider shows "Showing N days · Jun 6 – Jun 10" |
| `tasksForScheduleDay` helper | done | `client/src/utils/scheduleLayout.test.js` |
| `AdminMailContent` dead modal removed | done | Campaign rows navigate to `/campaign/:id` only; ~100 lines dead code gone |

### B9 test commands

```bash
npm test --prefix client
npm run build --prefix client
# Mobile / narrow viewport → Schedule page
```

### B9 deferred (Phase B10+)

| Item | Status | Est. |
|------|--------|------|
| MFA / 2FA | planned | 3–5 d |
| Consolidate `MailCampaign` → `Campaign` | planned | 3 d (avoid locked tracking files) |
| Event bus for task → XP → project rollup | planned | 5–7 d |
| Full OpenAPI coverage for all routes | planned | 2–3 d |

## Phase B8 — Shipped (2026-06-05) — test this batch

| Item | Status | How to test |
|------|--------|-------------|
| `AdminMailContent` split (campaign wizard) | done | `MailCampaignWizard.jsx` + `useMailCampaignWizard.js` — `/emails/create` or Admin Mail → Create Campaign |
| Zod on mail template routes | done | `POST/PUT /api/mail/templates`, `POST .../reject` — object injection → 400 |
| Calendar `buildDateTimeFromParts` fix | done | Schedule/Calendar loads tasks without 500 |
| OpenAPI mail templates stub | done | `/api/openapi.json` → `/mail/templates` |

### B8 test commands

```bash
npm test --prefix server
npm run build --prefix client
# /emails/create — full 3-step wizard
# Admin → Mail → Template Studio → Use in Campaign
curl http://localhost:5000/api/openapi.json
```

### B8 deferred (Phase B9+)

| Item | Status | Est. |
|------|--------|------|
| MFA / 2FA | planned | 3–5 d |
| Consolidate `MailCampaign` → `Campaign` | planned | 3 d (avoid locked tracking files) |
| Event bus for task → XP → project rollup | planned | 5–7 d |
| Full OpenAPI coverage for all routes | planned | 2–3 d |
| `AdminMailContent` further splits (campaign detail modal, legacy cleanup) | planned | 1–2 d |

## Phase B7 — Shipped (2026-06-05) — test this batch

| Item | Status | How to test |
|------|--------|-------------|
| `AdminMailContent` split (profiles) | done | `MailProfilesPanel.jsx` — Admin → Mail → SMTP Profiles (create/edit/delete) |
| Zod on mail routes | done | `POST/PUT /api/mail/profiles`, `POST /api/mail/campaigns` — object injection → 400 |
| Zod on finance routes | done | `POST /api/finance/submit-invoice`, `POST /api/finance/folders` — object injection → 400 |
| OpenAPI mail + finance stubs | done | `/api/openapi.json` → `/mail/profiles`, `/mail/campaigns`, `/finance/*` |

### B7 test commands

```bash
npm test --prefix server
npm run build --prefix client
# Admin → Mail → SMTP Profiles
curl http://localhost:5000/api/openapi.json
```

### B7 deferred (Phase B8+)

| Item | Status | Est. |
|------|--------|------|
| `AdminMailContent` split (campaign wizard) | planned | 2 d |
| MFA / 2FA | planned | 3–5 d |
| Zod on remaining mail template routes | planned | 1 d |
| Consolidate `MailCampaign` → `Campaign` | planned | 3 d (avoid locked tracking files) |
| Event bus for task → XP → project rollup | planned | 5–7 d |
| Full OpenAPI coverage for all routes | planned | 2–3 d |

## Phase B6 — Shipped (2026-06-05) — test this batch

| Item | Status | How to test |
|------|--------|-------------|
| Zod on CRM routes | done | `POST/PUT /api/crm/leads`, `POST .../notes` — object injection → 400 |
| `AdminMailContent` split (step 2) | done | `MailCumulativeAnalyticsPanel`, `MailStatsSummary` — Admin Mail analytics + header stats |
| OpenAPI CRM notes | done | `/api/openapi.json` → `/crm/leads/{id}/notes` |

### B6 test commands

```bash
npm test --prefix server
npm run build --prefix client
# Admin → Mail → Aggregate Analytics + location drill-down
```

### B6 deferred (Phase B7+)

| Item | Status | Est. |
|------|--------|------|
| `AdminMailContent` splits (profiles, campaign wizard) | planned | 2–3 d |
| MFA / 2FA | planned | 3–5 d |
| Zod on finance / mail routes | planned | 1–2 d |
| Consolidate `MailCampaign` → `Campaign` | planned | 3 d (avoid locked tracking files) |
| Event bus for task → XP → project rollup | planned | 5–7 d |
| Full OpenAPI coverage for all routes | planned | 2–3 d |

### B2 test commands

```bash
# Unit + build
npm test --prefix server
npm test --prefix client
npm run build --prefix client

# OpenAPI
curl http://localhost:5000/api/openapi.json

# E2E (public — no creds)
npm run build --prefix client
npm run test:e2e:public

# E2E (auth — needs running API + creds)
E2E_EMAIL=you@example.com E2E_PASSWORD=secret npm run test:e2e

# Lighthouse a11y gate
npm run build --prefix client && npm run preview --prefix client
LH_BASE_URL=http://127.0.0.1:4173 npm run lighthouse:ci --prefix client
```

---

## Phase B16 — Shipped (2026-06-06) — test this batch

| Item | Status | How to test |
|------|--------|-------------|
| Finance `DataTable` migration (FinancePage + ProjectFinance) | done | Finance → sort folders/docs; project Finance tab |
| `FinanceDocumentRow` + upload OCR state badges | done | Upload modal — uploading/parsing progress |
| `TaskReviewActions` extract + "Review & Approve" CTA | done | Open in-review task as reviewer |
| Leaderboard "+N XP to next rank" for current user | done | Dashboard leaderboard — your row when not #1 |
| Zod on gamification / artist / admin script routes | done | `npm test --prefix server` — validation gamification/artist/admin blocks |

### B16 test commands

```bash
npm test --prefix server
npm test --prefix client
npm run build --prefix client
npm run test:e2e:public
```

---

## Phase B15 — Shipped (2026-06-06) — test this batch

| Item | Status | How to test |
|------|--------|-------------|
| E2E auth flows (shortcuts, notes unsaved, sessions) | done | `E2E_EMAIL=… E2E_PASSWORD=… npm run test:e2e:auth` |
| Shared E2E login helper | done | `e2e/helpers/auth.js` |
| Attendance badge copy → "Action Required: Xm Not Logged" | done | UnifiedTimeCard with unlogged ≥ 30m |

### B15 test commands

```bash
npm run test:e2e:public
E2E_EMAIL=you@example.com E2E_PASSWORD=secret npm run test:e2e:auth
# API must be running for auth flows (preview proxies to :5000)
```

---

## Phase B14 — Shipped (2026-06-06) — test this batch

| Item | Status | How to test |
|------|--------|-------------|
| `useUnsavedChanges` on Notes, Finance, mail studio | done | See Phase E checklist below |
| Zod on `/api/campaigns` POST + resend routes | done | `npm test --prefix server` — `validation.test.js` campaigns block |
| Zod on `/api/projects` POST/PUT + workspace/member routes | done | Same — projects block in validation tests |
| Zod on `/api/data-hub` people/analytics/reconcile queries | done | `?page={$gt:''}` → 400 |
| OpenAPI v1.0.5 campaigns + project PUT stubs | done | `GET /api/openapi.json` |

### B14 test commands

```bash
npm test --prefix server
npm test --prefix client
curl http://localhost:5000/api/openapi.json
```

---

## Phase C — UX 1.0.0 remaining (see `UX_ARCHITECTURE_1.0.0_ROADMAP.md`)

| Phase | Focus | Status |
|-------|-------|--------|
| 0 | Token foundation + dark palette | partial — tokens exist; verify acceptance criteria |
| 1 | Sidebar, toasts, reduced motion | partial |
| 2 | Command Palette v2 + unified search | mostly done |
| 3 | Data Hub + CRM density | partial — sticky columns started |
| 4 | Finance + HR/Attendance timeline | partial — DataTable migration done (B16); attendance timeline + hygiene meter shipped |
| 5 | Tasks + quiet gamification | partial — TaskReviewActions, completion flash, quiet XP toasts, leaderboard gap (B16) |
| 6 | Integrations + ops terminal | planned |
| 7 | Accessibility hardening + Lighthouse CI | planned |

---

## Phase D — Infrastructure & platform (large)

| Item | Status |
|------|--------|
| Dedicated Render background worker | planned |
| API versioning `/api/v1` | planned |
| Read/write split + materialized CRM stats | planned |
| Multi-region / HA | deferred |
| True multi-tenant SaaS + Stripe billing | deferred |
| TypeScript incremental migration | deferred |
| i18n / localization | deferred |
| AI lead scoring / follow-up drafts | deferred |
| Real-time co-editing (notes, tasks) | deferred |
| Offline mutation queue (PWA) | planned |
| S3 off-site backups + restore drill | planned |
| Feature flags service | planned |

---

## Phase E — Small polish backlog

- [x] Persist Finance / Inbox / Schedule filters to `localStorage` (B1)
- [ ] Bulk selection bar consistency across admin tables
- [x] Copy-to-clipboard on Data Hub person detail (B1)
- [x] Timestamp tooltips (relative + absolute) — Notes list + dashboard panel (B11); Inbox/Sessions already had RelativeTimestamp
- [x] `useUnsavedChanges` on Notes, Finance, mail studio (2026-06-06)
- [x] Toast dedupe on optimistic + refetch (B11)
- [ ] PageSkeleton on all data pages
- [ ] Prettier + format on commit
- [ ] ESLint `no-console` rule on `server/` (except scripts)
- [ ] Archive dev-only scripts (`test-mailer.js`, etc.)
- [ ] Version sync across README / context doc / package.json
- [ ] Duplicate lead merge UI
- [ ] Bulk CRM assign / status / tag
- [ ] Notification category preferences
- [ ] Google/Outlook calendar sync
- [ ] Task dependencies + Gantt
- [ ] Workflow automation (Trigger.dev rules)
- [ ] Subscription calendar / iCal feed
- [ ] Onboarding tour per department
- [ ] Mobile card fallback for wide tables
- [x] Floating pill mobile bottom nav (B12)
- [x] Nav pill tap-only with animated highlight (B13; drag removed per UX)
- [ ] 44px touch target audit on mobile

---

## How to update

When an item ships, move it to **Phase A** with PR link and date. Do not delete deferred items — mark `deferred` with reason.
