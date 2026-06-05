# CoreKnot 1.0.0 — UX Architecture Implementation Roadmap

**Status:** Implemented 2026-06-05  
**Compiled:** 2026-06-05  
**Vision source:** Strategic Design and UX Architecture Plan (1.0.0 executive brief)  
**Existing standards:** `client/design_guidelines.md` (UDIF v2.1), `docs/COMPONENT_STANDARDS.md`

This document is the **per-file change manifest** with **acceptance criteria per module**. Use it to scope PRs, assign work, and verify completion. It extends UDIF — it does not replace it.

---

## Executive Summary

CoreKnot’s backend (50+ routes, multi-tenant, BullMQ, Data Hub reconciliation) outpaces its frontend information architecture. The 1.0.0 UX plan targets:

1. **Three-tier design tokens** — Global → Semantic → Component density overrides  
2. **Dark-mode-first product canvas** — Near-black surfaces, hairline borders, `#126d5e` accent only for CTAs/focus/loader  
3. **Keyboard-first navigation** — Command Palette as action router, sidebar demoted to wayfinding  
4. **High-density grids** — Sticky identity columns, hover-expand temporal data, inlet icon clusters  
5. **Module-specific interaction patterns** — CRM locks, dual-currency, attendance timeline, task review state machines, quiet gamification  
6. **Inclusive polish** — OS `prefers-reduced-motion`, assertive `aria-live`, global focus rings  

**Estimated total effort:** 4–6 weeks (1 engineer), phased. Backend net-new: unified search API + optional lead-lock WebSocket.

---

## Locked Zones (Do Not Touch Unless Explicitly Unlocked)

| Zone | Doc | Impact on this roadmap |
|------|-----|------------------------|
| Email engine | `docs/EMAIL_ENGINE_LOCKED.md` | HolySheet deselect-on-load, tracking URLs, activity stream geo — no UX token changes in locked logic files |
| Logo & spinner | `docs/LOGO_LOCKED.md` | `#126d5e` on mark shell, `frl-v-02` default loader — accent usage only around existing components |

---

## Phase Overview

| Phase | Focus | Est. | Unblocks |
|-------|-------|------|----------|
| **0** | Token foundation + dark palette | 1–2 d | All visual work |
| **1** | Shell, sidebar, toasts, motion | 3–5 d | Palette feel + a11y baseline |
| **2** | Command Palette v2 + search API | 4–6 d | Keyboard-first routing |
| **3** | Data Hub + CRM density | 5–7 d | Admin/sales triage velocity |
| **4** | Finance + HR/Attendance | 5–7 d | Ops/finance precision |
| **5** | Tasks + gamification | 4–5 d | Governance + engagement |
| **6** | Integrations + observability | 3–5 d | Artist analytics + ops terminal |
| **7** | Accessibility hardening + QA | 2–3 d | Ship gate |

Phases 0–1 can ship independently. Phase 2 requires server work. Phases 3–7 can parallelize after Phase 0.

---

## Phase 0 — Token Foundation

### New files

| File | Purpose |
|------|---------|
| `client/src/styles/tokens/global.css` | Raw hex, 4px spacing scale (`--space-1` … `--space-16`) |
| `client/src/styles/tokens/semantic.css` | Functional aliases: canvas, surface-1/2/3, hairline, text-*, brand-accent, semantic-* |
| `client/src/styles/tokens/components.css` | Component overrides: `--table-cell-padding-compact`, `--sidebar-active-border-width`, etc. |
| `client/src/styles/tokens/index.css` | `@import` chain; imported from `client/src/index.css` |

### Files to modify

| File | Changes |
|------|---------|
| `client/src/index.css` | Import token chain; remap `.dark` to 1.0.0 palette; keep marketing `.tm-marketing-page` isolated; add `[data-density="compact"]` scope |
| `client/design_guidelines.md` | Phase 5: document dark canvas stack + three-tier token model |
| `docs/COMPONENT_STANDARDS.md` | Reference semantic token names for new components |

### Dark palette mapping (1.0.0 → existing vars)

| 1.0.0 token | Hex | Maps to existing var |
|-------------|-----|----------------------|
| canvas | `#010102` | `--color-bg-primary`, `--background`, `--color-bg-workspace` |
| surface-1 | `#0f1011` | `--color-bg-surface`, `--card` |
| surface-2 | `#141516` | `--color-bg-secondary` (hover/alternate rows) |
| surface-3 | `#18191a` | `--color-bg-floating` (modals, dropdowns, FAB) |
| hairline | `#23252a` | `--color-bg-border`, `--border` |
| text-primary | `#f7f8f8` | `--color-text-primary`, `--foreground` |
| text-muted | `#8a8f98` | `--color-text-muted` |
| brand-accent | `#126d5e` | `--color-action-primary` (unchanged — logo lock) |
| semantic-success | `#27a644` | New `--color-semantic-success`; wire delta-positive where appropriate |

Light mode: retain current slate shell; only dark mode gets full remap initially.

### Acceptance criteria — Phase 0

- [ ] `.dark` shell uses canvas `#010102`; no static card uses `box-shadow` (only `.tm-floating`)
- [ ] All new semantic tokens consumed via CSS vars — no hardcoded `#111827` in migrated files
- [ ] `[data-density="compact"]` reduces `--spacing-row-padding` by 50%
- [ ] Marketing pages (`.tm-marketing-page`) visually unchanged
- [ ] Lighthouse a11y on `/dashboard` does not regress vs. baseline

---

## Phase 1 — Shell, Sidebar, Toasts, Motion

### Files to modify

| File | Current | Target change |
|------|---------|---------------|
| `client/src/components/MainLayout.jsx` | 160/56px sidebar margin, CommandPalette mounted | Default collapsed 56px; optional `data-density` on content wrapper |
| `client/src/components/OutletSidebar.jsx` | Full background active states, 160px expanded | Active = `surface-2` + 2px left `brand-accent` border; smaller icons; strip heavy fills |
| `client/src/contexts/ThemeContext.jsx` | Sets `data-reducedMotion`, `data-textSize` — no CSS rules | Sync OS `prefers-reduced-motion` on mount; expose tri-state (system/on/off) |
| `client/src/index.css` | No reduced-motion rules | `[data-reduced-motion="true"]` disables transitions; `@media (prefers-reduced-motion: reduce)` fallback |
| `client/src/main.jsx` | Provider tree | Wrap app in Framer `MotionConfig` with `reducedMotion` from ThemeContext |
| `client/src/lib/notifications.jsx` | Toasts: surface + border + shadow | Uniform `surface-1` bg; **2px left border** by severity (success/warning/danger); remove solid colored backgrounds |
| `client/src/hooks/useAuthenticatedRealtime.jsx` | XP toast: emoji, shadow-2xl, blue icon bg | Quiet toast: muted icon, surface-1, left-border success, bottom-right spring (respect reduced motion) |

### Acceptance criteria — Phase 1

- [ ] Sidebar active item shows 2px `#126d5e` left border, not full-width green fill
- [ ] Toast success/error/warning distinguishable by left border only; background always `surface-1`
- [ ] With `prefers-reduced-motion: reduce`, Command Palette open/close is instant (no spring)
- [ ] Tab through sidebar + main content shows `brand-accent` focus ring on all interactives
- [ ] Collapsed sidebar (56px) is default on viewports ≥1280px (persisted in `localStorage`)

---

## Phase 2 — Command Palette v2 + Unified Search

### New server files

| File | Purpose |
|------|---------|
| `server/services/UnifiedSearchService.js` | Fan-out search across Lead, Contact (Data Hub), Task, Project, Note |
| `server/controllers/unifiedSearchController.js` | `GET /api/search?q=&types=&limit=` |
| `server/routes/searchRoutes.js` | Auth + tenant-scoped route registration |

### New client files

| File | Purpose |
|------|---------|
| `client/src/hooks/useUnifiedSearch.js` | Debounced 300ms query; merges TanStack cache hits + API results |
| `client/src/utils/commandPaletteActions.js` | Department preset action registry |
| `client/src/utils/commandPaletteResolver.js` | `#asset`, `TSK-*`, `@mention` token routing |

### Files to modify

| File | Current | Target change |
|------|---------|---------------|
| `client/src/components/CommandPalette.jsx` | ~9 static nav shortcuts; filter local list | Zero-state by `departmentId.slug`; local cache filter + debounced API; action execution (navigate, open modal, POST note); keyboard hints G+D etc. |
| `client/src/hooks/useTaskmasterQueries.js` | No unified search hook | Add `useUnifiedSearch` query key |
| `server/index.js` (or route aggregator) | No `/api/search` | Mount `searchRoutes` |
| `server/utils/notificationActionUrl.js` | Task/lead URLs | Export helpers reused by palette resolver |
| `shared/mentionTokens.js` | Parse tokens | Document palette integration; no logic change |
| `client/src/utils/mentionTokens.js` | Client mirror | Add `resolvePaletteQuery(text)` wrapper |

### Department zero-state presets

| `departmentId.slug` | Default suggestions (no query) |
|---------------------|--------------------------------|
| `sales` | Create Lead, View Follow-ups, Open CRM |
| `operations` | Approve Finance Documents, Review Ops Logs, Data Hub |
| `admin` | Users, Data Hub, System Logs |
| *(fallback)* | Dashboard, Todo, Projects, Settings |

### Acceptance criteria — Phase 2

- [ ] Cmd/Ctrl+K opens palette; empty query shows department-specific suggestions
- [ ] Typing `"Raghav"` returns leads/contacts from `GET /api/search` within 500ms (debounced)
- [ ] `TSK-892` or task ObjectId navigates to project/task detail
- [ ] `#asset-{id}` opens asset panel or navigates to asset route
- [ ] `"Add note …"` POSTs to notes API, shows success toast, palette closes, user context unchanged
- [ ] `G` then `D` navigates to dashboard (sequential chord, not simultaneous)
- [ ] Search respects `hasPageAccess` — no results for forbidden modules
- [ ] Palette renders on `surface-3` with backdrop blur; positioned upper-center

---

## Phase 3 — Data Hub + CRM

### Phase 3A — Data Hub

| File | Changes |
|------|---------|
| `client/src/pages/admin/DataHubPage.jsx` | Apply `[data-density="compact"]`; wire new column components |
| `client/src/components/dataHub/DataHubInletCluster.jsx` | **NEW** — monochromatic icon flex-cluster from `inCRM`, `inExly`, etc. |
| `client/src/components/dataHub/DataHubTemporalColumn.jsx` | **NEW** — collapsed time glyph; Framer hover-expand to full `lastSyncedAt` |
| `client/src/components/dataHub/DataHubPersonDetail.jsx` | Migrate overlay to `FullScreenWorkspace` 70/30 if not already |
| `client/src/utils/dataHubInlets.js` | Export icon + tooltip label map per inlet key |
| `shared/dataInlets.js` | Source of truth for inlet keys — sync if keys change |

**Column behavior**

| Column | Behavior |
|--------|----------|
| Name, Email/Phone | `position: sticky; left: 0`; z-index above scroll |
| Inlet flags | `DataHubInletCluster` — no text badges |
| lastSyncedAt, engagement | `DataHubTemporalColumn` — hover expand only |

### Phase 3B — CRM (Leads + Follow-ups)

| File | Changes |
|------|---------|
| `client/src/pages/crm/LeadsPage.jsx` | `pageSize` default 25 (not 5); filter persistence `localStorage` key `crm-leads-filters`; row lock UI; hover inline actions |
| `client/src/pages/crm/FollowupsPage.jsx` | Align toolbar; filter persistence `crm-followups-filters`; same lock + hover patterns |
| `client/src/components/crm/LeadRowActions.jsx` | **NEW** — hover overlay: Log Follow-up, Audit Trail, Edit |
| `client/src/components/crm/LeadLockIndicator.jsx` | **NEW** — padlock + `text-muted` row opacity |
| `client/src/hooks/useTaskmasterQueries.js` | `useUpdateLead` handles 423; optional `useLeadLocks` subscription |
| `client/src/hooks/useLeadLockRealtime.js` | **NEW** — subscribe to `lead_lock` channel (Phase 3B optional backend) |

### Optional backend (lead lock presence)

| File | Changes |
|------|---------|
| `server/middleware/concurrencyMiddleware.js` | On lock acquire/release, broadcast `lead_lock` on `leads` channel |
| `server/controllers/crmController.js` | Include `lockedBy` populated name in 423 response body |
| `server/config/realtime.js` | Document `lead_lock` event shape |

*If WebSocket deferred:* poll `lockedBy` on `lead_change` invalidation; show lock only after 423 on edit attempt.

### Acceptance criteria — Phase 3

**Data Hub**

- [ ] Name + Email columns remain visible during horizontal scroll on 1280×800
- [ ] Inlet presence shown as ≤6 icon cluster; tooltip shows inlet name + count
- [ ] `lastSyncedAt` column default width ≤48px; expands on hover with full timestamp
- [ ] Row click opens person detail without horizontal layout shift

**CRM**

- [ ] Leads default page size ≥25; user can change and preference persists
- [ ] Compound filters (`leadStatus` + geo) restore from `localStorage` on return visit
- [ ] When lead locked by another user, row shows padlock + ~60% opacity; edit attempt shows who holds lock
- [ ] Hover row tail reveals Log Follow-up / Audit / Edit — no permanent Actions column
- [ ] 423 response shows non-blocking toast: *"[Name] is editing this lead"*

---

## Phase 4 — Finance + HR/Attendance

### Phase 4A — Finance

| File | Changes |
|------|---------|
| `client/src/components/finance/UsdInrAmountFields.jsx` | INR-primary single block; symbol baseline-aligned; `Intl.NumberFormat('en-IN')` on input; subline `≈ $X USD (Rate: Y)`; stale rate → `semantic-warning` |
| `client/src/hooks/useUsdInrRate.js` | Expose `isStale` / `isOverride` flags from server meta |
| `client/src/pages/finance/FinancePage.jsx` | Migrate raw `<table>` → `DataTable`; OCR upload row progress bar; post-OCR `flash-highlight` on parsed cells; "Needs Attention" accordion above pagination |
| `client/src/components/finance/FinanceDocumentRow.jsx` | **NEW** — OCR processing state machine (uploading → parsing → complete) |
| `client/src/components/finance/NeedsAttentionAccordion.jsx` | **NEW** — pending approvals grouped top; bulk checkbox + optimistic approve |
| `client/src/components/project/ProjectFinance.jsx` | Same `DataTable` migration |
| `server/services/usdInrRateService.js` | Return `{ rate, asOf, source: 'live'|'cache'|'override' }` in API — no rate logic change |

### Phase 4B — HR/Attendance

| File | Changes |
|------|---------|
| `client/src/components/attendance/UnifiedTimeCard.jsx` | Replace tabular worked/not-logged with horizontal 24h timeline bar; lunch hash segment; header badge `Action Required: XXm Not Logged` |
| `client/src/components/attendance/AttendanceTimeline.jsx` | **NEW** — segmented bar: worked span, lunch deduction, log gaps |
| `client/src/components/attendance/WorkModeToggle.jsx` | On `work-mode-hint` match, animate home → building icon (no modal) |
| `client/src/components/attendance/AttendancePromptModal.jsx` | Strip from DOM for `attendanceExcludedUsers` — not disabled state |
| `client/src/components/attendance/HygieneProgressMeter.jsx` | **NEW** — circular ring in dashboard header; fills as `unloggedMinutes` → 0 |
| `client/src/pages/management/AttendancePage.jsx` | Mount `HygieneProgressMeter` on self view; keep monthly grid exception documented |
| `client/src/utils/attendanceUsers.js` | Mirror `shared/attendanceExcludedUsers.js` — no drift |
| `shared/attendanceMetrics.js` | Source for timeline math — UI reads via `client/src/utils/attendanceMetrics.js` |

### Acceptance criteria — Phase 4

**Finance**

- [ ] Typing `150000` in INR field displays `1,50,000.00` live
- [ ] USD equivalent always visible below INR in `text-muted`; updates on keystroke
- [ ] When rate is override/fallback, subline turns warning color + tooltip explains offline estimate
- [ ] Upload shows linear progress in row; parsed Invoice #/Amount cells flash green once
- [ ] Pending invoices appear in top accordion; bulk approve optimistically marks rows before server confirms

**Attendance**

- [ ] Timeline shows check-in→check-out wash (`brand-accent` low opacity)
- [ ] 60-min lunch shown as diagonal hash at median of worked span
- [ ] `unloggedMinutes ≥ 30` → assertive `aria-live` badge in card header
- [ ] Excluded users never see `AttendancePromptModal` or mark-in card (absent from DOM)
- [ ] Office IP match pre-selects Office on toggle with icon transition
- [ ] Hygiene ring reaches success hue when backend awards `ATTENDANCE_DAY_BONUS`

---

## Phase 5 — Tasks + Gamification

### Phase 5A — Task governance

| File | Changes |
|------|---------|
| `client/src/components/project/ProjectKanban.jsx` | `in-review` cards: dashed `brand-accent` border; remove solid border |
| `client/src/components/TaskDetailModal.jsx` | If `!canUserApproveReview`: show `text-muted` *"Awaiting review by [assigner]"* — no disabled button; rollback expands inline autofocus textarea; optimistic column move on submit |
| `client/src/components/tasks/TaskReviewActions.jsx` | **NEW** — approve / rollback UI extracted from modal |
| `client/src/utils/taskReview.js` | Wire optimistic updates + `emitSystemEvent` toasts |
| `client/src/components/tasks/TaskCompletionFlash.jsx` | **NEW** — `+0.25h logged to Daily Tracker` fade under title |
| `shared/taskReviewRules.js` | No changes expected — frontend mirrors `canUserApproveReview` |

### Phase 5B — Gamification

| File | Changes |
|------|---------|
| `client/src/components/dashboard/LeaderboardPodium.jsx` | Top 3 on `surface-3`; 1px hairline borders with gold/silver/bronze gradient; dense scrollable list with XP gap to next rank |
| `client/src/components/dashboard/LeaderboardRow.jsx` | Show `+N XP to next rank` for current user |
| `client/src/hooks/useAuthenticatedRealtime.jsx` | XP toast: surface-1, left-border, no emoji; Framer slide from bottom-right |
| `client/src/components/dashboard/HygieneProgressMeter.jsx` | Shared with Phase 4B if mounted on dashboard |

### Acceptance criteria — Phase 5

**Tasks**

- [ ] Kanban `in-review` cards identifiable by dashed green border at 3m distance
- [ ] Assignee opens task → no Approve button; sees awaiting message with assigner name
- [ ] Assigner sees prominent "Review & Approve"
- [ ] Rollback requires reason; card animates to In Progress before server responds
- [ ] On approve, brief `+0.25h logged` confirmation appears under task title

**Gamification**

- [ ] XP toast unobtrusive; no solid colored background
- [ ] Podium top 3 distinguished by hairline metallic border only — no cartoon graphics
- [ ] Leaderboard shows XP delta to next position for logged-in user

---

## Phase 6 — Integrations + Observability

### Phase 6A — Artist integrations

| File | Changes |
|------|---------|
| `client/src/components/artists/UnifiedReachCard.jsx` | Remove hardcoded slate gradient + `shadow-xl`; use semantic tokens; multi-series temporal chart (followers over time, all platforms); OAuth expiry → dashed projection + `surface-2` re-auth banner (non-blocking) |
| `client/src/components/artists/PlatformReachChart.jsx` | **NEW** — unified X-axis time comparison |
| `client/src/components/artists/OAuthExpiryBanner.jsx` | **NEW** — localized reconnect CTA |
| `client/src/pages/artists/ArtistDetail.jsx` | Wire new chart + banner; handle `ArtistConnection` expiry gracefully |
| Exly panel (wherever AOV table lives) | Append `*` on `inferListPriceFromBookings` values; tooltip explains auto-repair |

### Phase 6B — Ops terminal

| File | Changes |
|------|---------|
| `client/src/pages/admin/SystemLogsPage.jsx` | Terminal aesthetic: monospace trace IDs, timestamps, JSON payloads |
| `client/src/pages/admin/SystemLogsPanel.jsx` | Stream via existing `system_log` socket; client-side severity/module filter on TanStack cache (no round-trip) |
| `client/src/components/admin/OpsTerminalView.jsx` | **NEW** — log line renderer with severity left-border |
| `client/src/hooks/useSystemLogs.js` | Expose `filterLocally(logs, { severity, module })` helper |

### Acceptance criteria — Phase 6

**Integrations**

- [ ] Meta token expiry does not crash chart; dashed line + banner shown
- [ ] All three platforms on one temporal chart with shared X-axis
- [ ] Inferred Exly prices show `*` with tooltip — no silent backfill

**Observability**

- [ ] `/ops-logs` uses monospace for trace ID + payload
- [ ] Severity filter applies instantly without API call (on loaded set)
- [ ] New logs append via socket without full page refresh

---

## Phase 7 — Accessibility Hardening + QA

### Files to modify

| File | Changes |
|------|---------|
| `client/src/index.css` | Global `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]` on buttons, links, inputs |
| `client/src/contexts/ThemeContext.jsx` | `textSize` CSS steps: `small` / `medium` / `large` on `data-text-size` |
| `client/src/components/attendance/AttendanceTimeline.jsx` | `aria-label` describing worked span, lunch, unlogged gap |
| `client/src/components/finance/UsdInrAmountFields.jsx` | `aria-describedby` linking to conversion subline |
| `server/services/qa/qaLighthouseRunner.js` | Add `/leads`, `/admin/crm` (Data Hub), `/finance` to a11y route set post-migration |

### Acceptance criteria — Phase 7

- [ ] WCAG 2.1 AA: all interactive elements reachable by keyboard with visible focus
- [ ] `prefers-reduced-motion`: no Framer spring on palette, toasts, column expand, XP toast
- [ ] Attendance "Not Logged" badge in `aria-live="assertive"` region
- [ ] Lighthouse a11y ≥90 on Dashboard, Leads, Data Hub, Finance after migrations
- [ ] No regressions in locked email/logo zones (smoke: campaign details, brand mark render)

---

## Per-File Master Index

Quick lookup of **every file touched** across all phases.

### Create (new)

```
client/src/styles/tokens/global.css
client/src/styles/tokens/semantic.css
client/src/styles/tokens/components.css
client/src/styles/tokens/index.css
client/src/hooks/useUnifiedSearch.js
client/src/utils/commandPaletteActions.js
client/src/utils/commandPaletteResolver.js
client/src/components/dataHub/DataHubInletCluster.jsx
client/src/components/dataHub/DataHubTemporalColumn.jsx
client/src/components/crm/LeadRowActions.jsx
client/src/components/crm/LeadLockIndicator.jsx
client/src/hooks/useLeadLockRealtime.js
client/src/components/finance/FinanceDocumentRow.jsx
client/src/components/finance/NeedsAttentionAccordion.jsx
client/src/components/attendance/AttendanceTimeline.jsx
client/src/components/attendance/HygieneProgressMeter.jsx
client/src/components/tasks/TaskReviewActions.jsx
client/src/components/tasks/TaskCompletionFlash.jsx
client/src/components/artists/PlatformReachChart.jsx
client/src/components/artists/OAuthExpiryBanner.jsx
client/src/components/admin/OpsTerminalView.jsx
server/services/UnifiedSearchService.js
server/controllers/unifiedSearchController.js
server/routes/searchRoutes.js
```

### Modify (existing)

```
client/src/index.css
client/design_guidelines.md
docs/COMPONENT_STANDARDS.md
client/src/main.jsx
client/src/components/MainLayout.jsx
client/src/components/OutletSidebar.jsx
client/src/contexts/ThemeContext.jsx
client/src/lib/notifications.jsx
client/src/hooks/useAuthenticatedRealtime.jsx
client/src/components/CommandPalette.jsx
client/src/hooks/useTaskmasterQueries.js
client/src/utils/mentionTokens.js
server/index.js (route mount)
server/utils/notificationActionUrl.js
client/src/pages/admin/DataHubPage.jsx
client/src/components/dataHub/DataHubPersonDetail.jsx
client/src/utils/dataHubInlets.js
client/src/pages/crm/LeadsPage.jsx
client/src/pages/crm/FollowupsPage.jsx
server/middleware/concurrencyMiddleware.js (optional)
server/controllers/crmController.js (optional)
client/src/components/finance/UsdInrAmountFields.jsx
client/src/hooks/useUsdInrRate.js
client/src/pages/finance/FinancePage.jsx
client/src/components/project/ProjectFinance.jsx
server/services/usdInrRateService.js (response meta only)
client/src/components/attendance/UnifiedTimeCard.jsx
client/src/components/attendance/WorkModeToggle.jsx
client/src/components/attendance/AttendancePromptModal.jsx
client/src/pages/management/AttendancePage.jsx
client/src/components/project/ProjectKanban.jsx
client/src/components/TaskDetailModal.jsx
client/src/utils/taskReview.js
client/src/components/dashboard/LeaderboardPodium.jsx
client/src/components/dashboard/LeaderboardRow.jsx
client/src/components/artists/UnifiedReachCard.jsx
client/src/pages/artists/ArtistDetail.jsx
client/src/pages/admin/SystemLogsPage.jsx
client/src/pages/admin/SystemLogsPanel.jsx
client/src/hooks/useSystemLogs.js
server/services/qa/qaLighthouseRunner.js
docs/AI_AGENT_PROJECT_CONTEXT.md (index link)
```

### Do not modify (locked)

```
server/utils/trackingUrls.js
server/utils/emailTracker.js
server/utils/geoLookup.js
server/routes/track.js
server/routes/campaignRoutes.js (tracking logic)
server/models/MailEvent.js
server/models/MailTemplate.js (format logic)
client/src/pages/CampaignDetails.jsx (activity geo logic)
client/src/utils/mailEventLocation.js
client/src/components/admin/AdminMailContent.jsx (HolySheet deselect)
client/src/components/brand/* (logo/spinner)
client/public/brand-mark.svg
```

---

## PR Slicing Recommendation

| PR | Scope | Review focus |
|----|-------|--------------|
| PR-1 | Phase 0 tokens + dark palette | Visual regression, marketing isolation |
| PR-2 | Phase 1 sidebar + toasts + motion | a11y, focus rings |
| PR-3 | Phase 2 search API + palette | Security (tenant scope), permissions |
| PR-4 | Phase 3A Data Hub columns | Density, sticky CSS |
| PR-5 | Phase 3B CRM locks + filters | 423 UX, localStorage |
| PR-6 | Phase 4A Finance | Currency formatting edge cases |
| PR-7 | Phase 4B Attendance timeline | Metric parity with `shared/attendanceMetrics.js` |
| PR-8 | Phase 5 Tasks + XP | Review authority matrix |
| PR-9 | Phase 6 Integrations + ops terminal | OAuth failure modes |
| PR-10 | Phase 7 a11y + Lighthouse | CI thresholds |

---

## Test Plan (Ship Gate)

### Manual

1. Dark mode: Dashboard → Leads → Data Hub → Finance — consistent canvas/surface/hairline
2. Cmd+K: department suggestions → entity search → deep link → note command
3. Data Hub: scroll wide row on 13" display — name/email pinned, inlet icons visible
4. CRM: two browsers edit same lead — lock indicator + 423 toast
5. Finance: INR typing format; stale rate warning; OCR upload flash
6. Attendance: timeline matches `workedMinutes` / `unloggedMinutes`; excluded user sees no prompt
7. Tasks: in-review dashed border; assignee vs assigner button gating; rollback flow
8. XP toast on task complete — quiet, bottom-right
9. Artist detail: disconnect Meta — chart degrades gracefully
10. Ops logs: filter severity locally; new log streams in

### Automated

- `server/services/qa/qaIntegrationRunners.js` — lead lock scenarios (`sm-lead-lock-*`) still pass
- Lighthouse CI routes extended per Phase 7
- Existing `taskReviewRules` / `attendanceMetrics` shared tests unchanged

---

## Agent Quick Reference

When implementing any phase:

1. Read this roadmap section + UDIF (`client/design_guidelines.md`)
2. Check locked zones before touching email or brand files
3. Use `@shared` for business rules — do not duplicate in UI-only utils
4. New API hooks → `useTaskmasterQueries.js`
5. New pages → `pagePermissions.js` (client + server)
6. Toasts → `emitSystemEvent` / `useSystemToast`, not `window.alert`
7. USD/INR → `UsdInrAmountFields` / `useUsdInrRate` — no hardcoded rates
8. Attendance UI → `unloggedMinutes` from shared metrics, not legacy `discrepancyMinutes`

---

*Companion to Strategic Design and UX Architecture Plan (1.0.0). Update this doc when phases complete — check boxes via PR description.*
