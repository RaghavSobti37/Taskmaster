# Data Hub — Product Vision (Jun 2026)

**Owner intent:** One place to see who is in the data system, where they are connected, and how active they are — without layout clutter or backend migration ceremony.

---

## Target experience

| Goal | What the user sees |
|------|-------------------|
| **Where connected** | Per person: which inlets/systems (Exly, CRM, newsletter, mail, etc.) |
| **How active** | Recency / activity signal at a glance (not buried in a detail drawer) |
| **Assess the dataset** | Paginated table + sort/filter — scan many people quickly |
| **Analytics** | Charts/KPIs to visualize the population — above the table, not competing side panels |
| **Keep it simple** | No left folder rail, no right insights rail, no duplicate analytics surfaces |

**Non-goals (for this product slice):** PersonIndex vs PersonHubView parity as a user-facing concern; full 360° person workspace as the default list experience.

---

## What exists today

### Layout (3 surfaces)

```
[ Folder sidebar ] | [ Overview stats/charts + toolbar + table ] | [ Analytics panel (toggle) ]
```

- **Left:** `DataHubFolderSidebar` — 14+ folder buttons (all, exly, leads, loyal, …).
- **Center:** `DataOverviewSection` (4 stat cards + mini charts) + heavy `PageToolbar` (search, email status, DB backup, TSC import, incremental/full sync, analytics toggle, refresh) + paginated `DataTable`.
- **Right:** `DataHubAnalyticsPanel` — optional 320px column (inlet breakdown, email health, overlap, folder-specific insights).
- **Overlay:** `DataHubPersonDetail` — full-screen workspace with **10 tabs** (Overview, CRM, Exly, Outsourced, Artist Path, Newsletter, Booked Calls, Enquiries, Mail, Timeline).

### Table columns today

Person · Inlets (icon cluster) · City · Email status · Updated

Row click opens the full detail workspace.

### Backend (already supports the vision)

- `GET /api/data-hub/people` — paginated, search, folder filter, email status; sorts by `lastActivityAt` when PersonHubView is active.
- `GET /api/data-hub/analytics` — KPIs + breakdowns per folder.
- `GET /api/data-hub/folders` — folder counts.
- Reconcile, backup, import — **ops**, not assessment UX.

### Close vs gap

| User want | Today | Gap |
|-----------|-------|-----|
| Where connected | Inlets column + folder sidebar | Sidebar duplicates what inlets column + filter could do |
| How active | Server has `lastActivityAt`; UI shows "Updated" only | No clear activity column or sort label |
| One table + filters | Table exists with pagination + search + email status | Folder navigation is a separate column, not a filter |
| Analytics | Overview section + optional right panel | **Two** analytics surfaces; right panel is extra chrome |
| Simple, no side columns | — | Left sidebar + right panel + ops toolbar buttons |
| Unified practical view | PersonHubView / PersonIndex dual path internally | Backend complexity invisible to user — OK if list is trustworthy |

---

## Phased UI plan

### Phase A — Single table focus (layout) — **Shipped (2026-06-10)**

**Goal:** One main column; assessment = table + filters.

| Action | Status | Files |
|--------|--------|-------|
| Remove left folder rail; replace with **Inlet / folder dropdown** in toolbar (reuse `activeFolder` state + folder API) | Done | `DataHubPage.jsx` — `DataHubFolderSidebar.jsx` unused on list page |
| Remove right **Analytics panel** toggle/column; overview strip toggles above table | Done | `DataHubPage.jsx` — `DataHubAnalyticsPanel.jsx` retained for Phase C merge |
| Move **ops actions** (DB backup, incremental/full sync, TSC import) to **Data ops** overflow menu | Done | `DataHubOpsMenu.jsx`, `DataHubTscImport.jsx` |
| Toolbar: search, folder, email status, sort, page size + refresh | Done | `DataHubPage.jsx`; server `sort`/`order` on `GET /api/data-hub/people` |
| Keep row-click detail workspace (no 10-tab rewrite) | Done | `DataHubPersonDetail.jsx` unchanged |
| Default `showAnalytics` localStorage to `false` | Done | `datahub-filters` persistence |

**Still open (Phase B/C):** Last-activity column label, inlet column strength, single collapsible analytics strip merging side-panel insights.

### Phase B — Connection + activity columns

**Goal:** Scan WHERE + HOW ACTIVE without opening detail.

| Action | Files |
|--------|-------|
| Rename/replace **Updated** → **Last activity** using `lastActivityAt` / `updatedAt` via `DataHubTemporalColumn` | `DataHubPage.jsx`, `DataHubTemporalColumn.jsx` |
| Strengthen **Inlets** column: show labels on hover (exists); consider inlet count badge + multi-inlet star (partially exists) | `DataHubInletCluster.jsx` |
| Add toolbar filters: **inlet/folder**, **email status**, **sort** (activity desc default — already server default for hub view) | `DataHubPage.jsx`, `server/domains/data-hub/listService.js` (expose sort param if needed) |
| Expose **loyal / multi-inlet** as filter chip, not separate sidebar folder | `DataHubPage.jsx`, `queryHelpers.js` |

### Phase C — Analytics above the table

**Goal:** Visualize the dataset once, not twice.

| Action | Files |
|--------|-------|
| Single **collapsible analytics strip** above table: reuse `DataOverviewSection` + `buildDataHubOverviewCharts` | `DataHubPage.jsx`, `dataHubAnalyticsCharts.js`, `DataOverviewSection.jsx` |
| Pull high-value sections from side panel into strip (inlet breakdown, email health) — drop overlap matrix from default view | Retire or shrink `DataHubAnalyticsPanel.jsx` |
| Folder/inlet filter drives both analytics + table (already wired via `activeFolder`) | `DataHubPage.jsx`, hooks in `client/src/hooks/queries/dataHub.js` |

---

## Backend / ops (out of UI scope)

- **PersonIndex → PersonHubView migration** and `checkPersonHubParity.js` are **ops/integrity** tools. Users need a correct unified list, not parity reports.
- Reconcile/sync remains necessary behind the scenes; it should not dominate the assessment UI.
- Person detail tabs can stay for deep dives but should not block simplifying the list page.

---

## Success criteria

1. Opening Data Hub: **one table** fills the viewport; filters in one toolbar row.
2. Any row answers **"connected where?"** and **"how recently active?"** without a click.
3. Analytics appear **once**, above the table, and respect the active filter.
4. No permanent left or right columns on the list view.

---

## Related docs

- `docs/FULL_APP_REVIEW_BACKLOG.md` — T3-2 reframed; simplified Data Hub tracked as product work (this doc).
- `docs/DATA_MASTER_ARCHITECTURE.md` — internal data model (reference only for UI work).
