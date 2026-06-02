# Component standards (CoreKnot client)

Global UI rules for `client/src`. Aligns with [design_guidelines.md](../client/design_guidelines.md) (UDIF).

## Global choices

| Concern | Standard |
|---------|----------|
| **List pages** | `ListPageLayout` → overview (optional) → `PageToolbar` → table/workspace. |
| **Page chrome** | No `subtitle` on pages. No `PageHeader` title when `DataOverviewSection` is shown. |
| **Overview** | `DataOverviewSection` + `DataMiniChart`; helpers in `utils/buildChartSeries.js`. |
| **Toolbar** | `PageToolbar` — single nowrap row for search, filters, actions. |
| **Modals** | `NexusModal` first (confirms, simple forms). `ModalShell` + `ModalHeader` / `ModalBody` / `ModalFooter` when layout is custom or non-dismissible. Never nest `NexusModal` around `ModalShell`. |
| **Detail overlays** | `FullScreenWorkspace` for row-click detail (70/30). |
| **Tables** | `DataTable` from `components/ui` for list UIs. Column sort: asc → desc → default. |
| **User display** | `UserAvatar` / `UserLabel` from `components/ui` whenever a user name appears in lists, tables, or detail chrome. Pass `user` object with `name` + `avatar`. |
| **Loading** | `PageLoadGuard` at route level + `PageSkeleton` or `DashboardSkeleton`. `DataLoading` / `Spinner` inside panels only. |
| **Selects** | `NexusDropdown` or thin wrappers (`PrioritySelect`, `ProjectSelect`, …). |
| **Buttons** | `Button` from `primitives.jsx` only. |
| **Confirms** | `globalConfirm` from `confirmContext` (uses `NexusModal`). No `window.alert` / `confirm`. |
| **Toasts** | `useToast()` from `ToastContext`. |

## Modal decision tree

```
Need a dialog?
├─ Yes → Simple confirm / alert / short message?
│        ├─ Yes → NexusModal (isConfirm / type / message)
│        └─ No → Custom header, steps, or full-bleed content?
│                 ├─ Yes → ModalShell + Header/Body/Footer (no outer NexusModal)
│                 └─ No → NexusModal (showFooter={false}, children)
└─ No → Row opened from table?
         └─ Yes → FullScreenWorkspace
```

**Deprecated:** `CenteredModal` — use `ModalShell` instead.  
**Removed:** `InputFormDrawer`, shadcn `button.jsx`, `CustomizationTab`, `DashboardEditor`.

## DataTable column sort

```js
{ header: 'Name', sortKey: 'name' }
// optional: sortFn: (row) => ..., sortable: false
```

- Client-side: omit `sortState` — table sorts before pagination.
- Server-side: `sortState={{ key, direction }}`, `onSortChange`, refetch with API `sort` / `order`.
- Default order: pass `null` sort state; map to API default (e.g. `createdAt` desc).

## DataTable exceptions

Use `DataTable` for CRUD lists and report tables. Documented exceptions (grid/calendar semantics):

| Area | Reason |
|------|--------|
| `schedule/ScheduleGrid` | Week grid + member rows (not a flat list) |
| `attendance/*` calendars | Month grid cells |
| `dashboard/TaskTable` | Inline dashboard widget layout |
| `TodoPage`, `ProjectList` | Workspace row accents, active/done section headers, inline skeleton rows |
| `AdminMailContent` campaign preview | Rich HTML / nested tooling (migrate inner lists only) |
| `AdminGamification` | Inline cell editing |

## Page loading

```jsx
<PageLoadGuard loading={isLoading} skeleton={PageSkeleton}>
  {/* page content */}
</PageLoadGuard>
```

- **Dashboard:** `DashboardSkeleton`
- **Other routes:** `PageSkeleton`

## Import path

Prefer barrel: `import { Button, DataTable, NexusModal, PageLoadGuard } from '../components/ui';`

## Catalog

~131 files under `client/src/components/`. Living reference: `/components` dev route (`ComponentsShowcase.jsx`).

## Migration backlog (bespoke tables)

Still on raw `<table>` until migrated: `TodoPage`, `ProjectList`, `ScheduleGrid`, `AdminGamification`, `AttendancePage`, `ExlyDataContent` lists, `ProjectFinance`, `ProjectAssets`, `FinancePage` (folder table), `AssetsPage` inner tables. **Done:** `OfficeAssetsPage`, `InvoiceTab`, `SubscriptionsPage`, `CampaignDetails` recipients, `CsvImporter` preview. CRM/Leads use `FullScreenWorkspace` + `DataTable`.

**PageLoadGuard:** Dashboard, Todo, Inbox, Subscriptions, OfficeAssets. Leads uses inline `PageSkeleton` (equivalent).
