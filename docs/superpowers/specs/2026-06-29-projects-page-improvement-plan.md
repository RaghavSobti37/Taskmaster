# CoreKnot Projects Page — Improvement Plan

> Target: `coreknot/Taskmaster` · Date: 2026-06-29 · Planning only

## 1. Executive summary

- **Projects page is functional but data-light** — cards show name, task count, progress %, review/overdue pings; API returns much more (status, tags, members, color, dates) that is not surfaced.
- **Workspace moves work via HTML5 drag-drop** on desktop only; no picker, no confirm, errors use `alert()`, no toast on success; mobile (`MOBILE_PAGE_LEVEL.FULL` on `/projects`) has no move path.
- **Creation is a full desktop-gated page** (`/projects/new` = `DESKTOP` in `mobilePageSupport.js`); always defaults workspace to `GENERAL`; no deep-link pre-select from workspace context.
- **Enhance existing patterns** (`ListPageLayout`, `ProjectPreview`, `WorkspaceSelect`, `useProjects`, `NexusModal`) rather than greenfield redesign.
- **Backend is mostly sufficient** for showcase + single moves; analytics-summary is admin-gated; bulk move would need new work.

---

## 2. Current state

### Architecture & key files

| Layer | File | Role |
|-------|------|------|
| Main page | `client/src/pages/projects/ProjectsView.jsx` | Browse, filter, sort, workspace grid / all-projects grid, drag-drop moves, workspace create modal |
| Creation | `client/src/pages/projects/ProjectCreate.jsx` | Full-page form: name, description, workspace, members |
| Workspace admin | `client/src/pages/projects/WorkspaceSettings.jsx` | Color, default members, goals, project name list |
| Status UI | `client/src/components/project/ProjectStatusPing.jsx` | Review/overdue accent on cards |
| Data hooks | `client/src/hooks/queries/projects.js` | `useProjects`, `useWorkspaces`; `useUpdateProject` exists but **not exported** |
| Mobile gating | `client/src/utils/mobilePageSupport.js` | `/projects` = FULL; `/projects/new` & `/workspaces/:name` = DESKTOP |
| API routes | `server/domains/projects/routes.js` | REST under `/api/projects` |
| Controller | `server/domains/projects/controllers/projectController.js` | CRUD, workspaces, analytics |
| Model | `server/domains/projects/models/Project.js` | Schema fields |

### Routes (`App.jsx`)

- `/projects` → `ProjectsView`
- `/projects/new` → `ProjectCreate`
- `/workspaces/:name` → `WorkspaceSettings`
- `/projects/:id` → `ProjectDetail`

### Data shown per project today

**Workspace grid (`ProjectPreview`):**
- Name (uppercase), star toggle
- Review/overdue counts (`useReviewTasks` + `useDashboardTasks`)
- `totalTasks`, `progress` %, `ProgressBar`
- “Analytics” link
- Drag handle (if `canMoveProject`)

**All-projects view adds:**
- Workspace name + color dot
- Status badge (`active` / `completed` / etc.)
- Starred top border accent

**Overview stats (`ListPageLayout`):**
- Total filtered projects, active count, global review count, workspace group count

### Available from API but not shown on list

From `GET /api/projects` (`getProjects` + `attachAggregatedTaskCounts`):

| Field | In API | On cards |
|-------|--------|----------|
| `description` | ✓ | ✗ |
| `tags` | ✓ | ✗ (search only) |
| `status` | ✓ | All view only |
| `color` | ✓ | ✗ (workspace color used instead) |
| `members[]` (populated: name, avatar, teams) | ✓ | ✗ |
| `owner` | ✓ (not populated on list) | ✗ |
| `starred` | ✓ | Star icon only |
| `createdAt` / `updatedAt` | ✓ | ✗ |
| `completedTasks` | ✓ | ✗ (only in tooltip) |
| `workspace` | ✓ | All view only |

From `GET /api/projects/analytics-summary` (admin page access): hours, log count, tasks completed in range — **not available to regular users on Projects page**.

From `GET /api/projects/workspaces/:name`: `allMembers`, richer project list — only on Workspace Settings.

### User flows

**Browse**
1. Load `useProjects` + deferred `useWorkspaces`, `useReviewTasks`, `useDashboardTasks`
2. Toggle **Workspaces** (grouped 2-col grid) vs **All** (responsive card grid)
3. Search (name, tags, workspace substring), status filter, sort (starred first, then newest/oldest/progress/name)

**Create project**
1. “New Project” → navigate `/projects/new`
2. Form: name, description, `WorkspaceSelect` (default `GENERAL`), members from workspace defaults + manual add
3. `POST /api/projects` → redirect `/projects`

**Create workspace**
1. “Add Workspace” → `NexusModal` (name + `WorkspaceColorPicker`)
2. `POST /api/projects/workspaces`

**Move project**
1. Drag grip on card → drop on workspace column or floating drop-zone chips
2. `PUT /api/projects/:id` `{ workspace }` — client-side `canMoveProject` (admin, owner, or member); server allows members workspace-only updates

**Reorder workspaces**
- Drag workspace header grip → `PUT /api/projects/workspaces` `{ order: string[] }` (per-user `WorkspacePreference`)

### Mobile vs desktop

- `/projects`: full mobile support — browse, star, filters OK
- Drag-drop moves: **desktop-only UX** (no touch alternative)
- `/projects/new`: **blocked on mobile** (desktop gate)
- Typography very small on workspace nested grid (`text-[8px]`–`text-[10px]`)

### Code pain points (no TODOs in folder, but observable gaps)

- `moveProjectToWorkspace` uses `alert()` on error; create workspace errors only `console.error`
- `ProjectsView` uses raw `axios.put` instead of unexported `useUpdateProject` (no optimistic UI)
- No workspace filter dropdown (unlike `TodoPage`, `FinancePage`)
- `ProjectPreview` in workspace grid omits status badge present in all view
- `createWorkspace` has no user-facing error toast
- Members cannot create projects on mobile (route gated)
- Analytics link goes to desktop-gated `/projects/:id/analytics`

---

## 3. Problems / gaps

### A. Data showcase

- Cards are **minimal** vs rich API payload
- Workspace nested grid is **cramped** (2-col `gap-px`, tiny type)
- No **table/dense view** for power users (contrast: `AdminProjectAnalyticsPage` uses `DataTable`)
- No **workspace filter** chip/dropdown
- No **starred-only** filter
- Empty states are generic (“No projects yet”) — no CTA to create in that workspace
- `description` / `tags` never visible without opening project

### B. Workspace moves

- **Drag-only** — undiscoverable; fails on touch devices
- **No confirmation** — accidental drops
- **No undo** / optimistic rollback pattern
- **No bulk move**
- **No “Move to…”** in card overflow menu
- Silent success (only invalidate queries)
- Moving to misspelled/non-existent workspace string is allowed (no server validation against `Workspace` collection)

### C. Project creation friction

- **Leaves list context** for full page
- **Mobile blocked** entirely
- **Always starts at GENERAL** — no `?workspace=` from workspace card
- No **quick create** (name + workspace only)
- No templates / duplicate-from-project
- Tags, status, color not settable at create (API supports tags, color, starred)
- Workspace defaults load is good but **heavy** for a quick add

---

## 4. Proposed improvements

### A. Data showcase

| Idea | Detail |
|------|--------|
| Card v2 | Add status pill, member avatar stack (max 3 +N), `updatedAt` relative time, optional 1-line description clamp |
| Project color | Left border or dot from `project.color` in addition to workspace color |
| Workspace summary row | Per workspace header: aggregate progress, total tasks, overdue/review sums |
| Filters | Workspace dropdown, starred toggle, “has overdue” quick filter |
| Sort | Add “most overdue”, “most review”, “recently updated” |
| View modes | Keep workspace + all; add optional **compact list** (reuse `DataTable` patterns) |
| Empty states | “Create project in {workspace}” button → `/projects/new?workspace=...` |
| Tags | Show up to 2 tag chips on all view |

### B. Workspace moves

| Idea | Detail |
|------|--------|
| Move menu | Card `⋯` → “Move to workspace” → `WorkspaceSelect` modal |
| Confirm | `useConfirm`: “Move {name} from X to Y?” |
| Keep drag-drop | Desktop power users |
| Mobile | Picker path required |
| Feedback | `useToast` success/error; export `useUpdateProject` for optimistic cache |
| Bulk (P2) | Multi-select in all view → batch `PUT` or new `PATCH /api/projects/bulk` |
| Permissions | Keep `canMoveProject`; disable UI with tooltip for non-members |

### C. Project creation

| Idea | Detail |
|------|--------|
| Context CTA | Each workspace header: `+ Project` → `/projects/new?workspace=TSC+TECH` |
| Query param | `ProjectCreate` reads `workspace` from URL |
| Quick create modal | Name + workspace on `ProjectsView` (POST minimal body); “Add details” → full page |
| Mobile | Either lift desktop gate for simplified modal OR allow mobile quick-create only |
| Defaults | Inherit workspace default members (already implemented) |
| Optional fields | Collapsible tags; color picker (API `pickDistinctColor` on server if omitted) |
| Templates (P2) | Duplicate project structure without tasks |

---

## 5. Recommended approach (top picks + trade-offs)

| Area | Recommendation | Trade-off |
|------|----------------|-----------|
| **Showcase** | Incremental card enrichment + workspace filter | Faster than table rewrite; table view as P2 |
| **Moves** | Picker + confirm alongside existing drag-drop | Slightly more UI; much better mobile + discoverability |
| **Creation** | URL pre-select + per-workspace CTA first; quick modal second | Full page stays for member-heavy setup; modal avoids mobile gate for simple case |

**Avoid:** New analytics fetch on list (admin-gated endpoint). Use list API + existing review/overdue hooks.

---

## 6. Implementation slices

### P0 — High impact, low risk

| # | Task | Files | Acceptance criteria |
|---|------|-------|---------------------|
| P0-1 | Export `useUpdateProject`; use in move + star | `hooks/queries/projects.js`, `ProjectsView.jsx` | Move/star optimistic; toast on error |
| P0-2 | Move-to-workspace modal + confirm | `ProjectsView.jsx`, maybe `components/project/MoveProjectModal.jsx` | Non-drag move works; confirm shown |
| P0-3 | Workspace filter in toolbar | `ProjectsView.jsx` | Dropdown filters both views |
| P0-4 | Status badge on `ProjectPreview` | `ProjectsView.jsx` | Workspace grid shows status |
| P0-5 | `?workspace=` on create | `ProjectCreate.jsx`, workspace CTAs in `ProjectsView.jsx` | Create opens with correct workspace |
| P0-6 | Empty state CTAs | `ProjectsView.jsx` | Empty workspace offers create link |

### P1 — UX polish

| # | Task | Files | Acceptance criteria |
|---|------|-------|---------------------|
| P1-1 | Member avatars + count on cards | `ProjectsView.jsx` | Shows populated `members` |
| P1-2 | `updatedAt` / created relative date | `ProjectsView.jsx` | Visible on all view |
| P1-3 | Starred filter toggle | `ProjectsView.jsx` | Filters starred only |
| P1-4 | Quick-create modal (name + workspace) | `ProjectsView.jsx`, `NexusModal` | POST + navigate or stay on list |
| P1-5 | Mobile: allow quick-create OR downgrade gate | `mobilePageSupport.js`, modal | Mobile users can create minimal project |
| P1-6 | Workspace header aggregates | `ProjectsView.jsx` | Sum tasks/overdue per group |
| P1-7 | Create workspace error toast | `ProjectsView.jsx` | User sees API error |

### P2 — Larger scope

| # | Task | Files | Acceptance criteria |
|---|------|-------|---------------------|
| P2-1 | Compact table view | `ProjectsView.jsx`, `DataTable` | Sortable columns |
| P2-2 | Bulk workspace move | New API optional, `ProjectsView.jsx` | 2+ projects moved |
| P2-3 | Light metrics row (30d hours) | New endpoint or relax analytics-summary ACL | Non-admin sees hours on card |
| P2-4 | Project templates / duplicate | `ProjectCreate.jsx`, controller | Clone members/phases optional |
| P2-5 | Validate workspace on update | `projectController.js` `updateProject` | 400 if workspace name unknown |

---

## 7. Risks

| Risk | Mitigation |
|------|------------|
| **Permissions** | Member can move but not rename — keep move UI separate from edit |
| **Mobile drag** | Don’t rely on drag; picker is primary on small screens |
| **Analytics endpoint** | `requirePageAccess('admin_project_analytics')` — don’t depend on it for main users |
| **Workspace string drift** | Projects can reference workspaces not in `Workspace` collection — validate or auto-create on move (product decision) |
| **Default member sync** | Moving workspace doesn’t auto-add target workspace defaults — document or add optional “apply defaults” |
| **Performance** | Review/overdue already deferred; avoid N+1 analytics calls |
| **Version conflicts** | `updateProject` uses `__v` — optimistic moves should pass version or handle 409 |

---

## 8. Open questions (max 3)

1. **Quick create on mobile:** Lift full `/projects/new` gate, or only allow minimal modal create on mobile?
2. **Moving workspaces:** Should moving a project auto-merge workspace default members into the project (like `syncWorkspaceDefaultsToProjects` on settings save)?
3. **List metrics:** Should non-admins see any time/log metrics on cards, or stay task-only unless we add a lighter public summary endpoint?

---

## Phase 3 — Quick wins (&lt;1 hour each)

1. **Read `?workspace=` in `ProjectCreate`** + “New project” button on each workspace header.
2. **Status badge on `ProjectPreview`** (copy from all view).
3. **Toast on move failure** — replace `alert()`; add success toast.
4. **Workspace filter dropdown** in toolbar (reuse `NexusDropdown` + `useWorkspaces`).
5. **Show `members.length` + 2 avatars** on all-projects cards (data already in list response).

---
