# CoreKnot — Master Reference

> **Canonical product bible.** Every routed page, APIs, hooks, exports, and access rules.  
> **Product:** CoreKnot · **Repo:** `coreknot/Taskmaster` · **Version:** 1.0.7 · **Compiled:** 2026-07-06

---

## How to use this document

| Audience | Start here |
| --- | --- |
| **New engineer** | [Platform overview](#1-platform-overview) → your domain in [Page catalog](#3-page-catalog-by-domain) |
| **AI agent** | Full file + [`.specify/memory/INDEX.md`](../.specify/memory/INDEX.md) + locked zones in [`operations/conventions.md`](../.specify/memory/operations/conventions.md) |
| **Ops / deploy** | [`operations/deployment.md`](../operations/deployment.md) + [`operations/environments.md`](../operations/environments.md) |

**Live inventory:** Regenerate with `node scripts/generate-page-inventory.mjs && node scripts/generate-master-doc.mjs`.

---

## Table of contents

1. [Platform overview](#1-platform-overview)
2. [Routing & access control](#2-routing--access-control)
3. [Page catalog by domain](#3-page-catalog-by-domain)
4. [Hub layouts & tabs](#4-hub-layouts--tabs)
5. [Backend API surface](#5-backend-api-surface)
6. [Business rules (cross-cutting)](#6-business-rules-cross-cutting)
7. [Locked zones](#7-locked-zones)
8. [Documentation map](#8-documentation-map)

---

## 1. Platform overview

CoreKnot is TSC's multi-tenant CRM and operations hub: projects, CRM, email campaigns, finance, attendance, Artist OS, gamification, and admin tooling.

| Layer | Stack |
| --- | --- |
| Frontend | React 18, Vite 5, Tailwind v4, TanStack Query, React Router 6, PWA |
| API | Express + Mongoose on Render; NestJS (`nestjs-server/`) for Postgres/sync ETL |
| Data | MongoDB Atlas (primary), Redis/BullMQ, Supabase (secondary mirror), Postgres (Nest/local) |
| Auth | Clerk primary in production/preview, JWT cookie (`coreknot_token_v3` + `activeTenantId`) after establish, email/password fallback when Clerk is unconfigured |
| Deploy | Vercel (SPA) → same-origin `/api` proxy → Render API |

**Site modes** (`client/src/config/siteMode.js`):

| Mode | Host | Purpose |
| --- | --- | --- |
| `app` | `tsccoreknot.com` | Workspace |
| `auth` | `auth.tsccoreknot.com` | Login/register |
| `landing` | `landing.tsccoreknot.com` | Marketing |

---

## 2. Routing & access control

### Guard chain (authenticated app routes)

```
Request → ProtectedRoute (session) → MainLayout → PageRoute (page key) → Page component
```

| Guard | File | Rule |
| --- | --- | --- |
| `ProtectedRoute` | `components/ProtectedRoute.jsx` | Valid session; Clerk boot when configured |
| `PageRoute` | `components/PageRoute.jsx` | `hasPageAccess(user, pageKey)` — redirect to `/dashboard` if denied |
| `ArtistOrAdminRoute` | `components/ArtistOrAdminRoute.jsx` | Org accounts under `/assets/accounts` |
| `ArtistMembershipRoute` | `components/ArtistMembershipRoute.jsx` | Artist workspace membership |

### Page permission keys

Resolved via `getUserPagePermissions()` in `client/src/utils/pagePermissions.js`:

- Department **admin** preset → all keys
- User `pagePermissions[]` override when set
- Else department `permissionPreset` or `slug` → `PRESET_PAGES`

**Presets:** `admin`, `ops`, `sales`, `artist-management`, `artist-business`, `creative`, `standard`

**Special rules:**

- `emails` / `campaigns` — any authenticated user
- `admin_artist_path` — admin dept OR `admin_data` permission
- `admin_ops_hub` — admin OR ops-hub sub-permissions

### Route → permission mapping (`App.jsx`)

| Path pattern | Page key(s) |
| --- | --- |
| `/dashboard` | `dashboard` |
| `/projects/*` | `projects` |
| `/calendar` | `calendar` |
| `/settings` | `settings` |
| `/developers` | `admin_developers` |
| `/logs` | `logs` |
| `/attendance` | `attendance` |
| `/schedule` | `schedule` |
| `/inbox` | `inbox` |
| `/todo` | `todo` |
| `/notes/*` | `notes` |
| `/crm` | `leads`, `followups`, `bookings` (any) |
| `/office` | `equipment`, `contacts`, `subscriptions` (any) |
| `/management` | `finance`, `announcements`, `org_documents`, `artists` (any) |
| `/admin/console` | multiple `admin_*` keys |
| `/emails/*` | `emails` |
| `/artists/*` | `artists` |
| `/assets/*` | `assets` |
| `/admin/*` | per-route `admin_*` keys |
| `/org/pick`, `/org/create`, `/org/create/success` | session (no page key; tenant selection) |
| `/invites/:token/accept` | session + invite token |
| `/terms`, `/privacy` | public legal |

Legacy redirects: `/leads` → `/crm?tab=leads`, `/finance` → `/management?tab=finance`, `/data-hub` → `/admin`, etc.

### Multi-org & tenant session

**Isolation model:** Extend existing `Tenant` (no separate Organization collection). All tenant-scoped documents keep `tenantId` via `tenantPlugin`.

| Model | File | Purpose |
| --- | --- | --- |
| `Tenant` | `server/models/Tenant.js` | Org record: `plan`, `ownerId`, `settings`, `featureUnlocks`, `onboardingProgress` |
| `TenantMembership` | `server/models/TenantMembership.js` | `{ tenantId, userId, role, status }` — compound unique per pair |
| `TenantInvite` | `server/models/TenantInvite.js` | Pending email invite; `tokenHash`, `expiresAt`, `role` |

**One user, many orgs:** `User.email` stays globally unique. Invites attach to the existing user on accept (same person across orgs = one `User`, many `TenantMembership` rows).

**JWT payload** (`coreknot_token_v3`, `server/utils/authSession.js`): `{ id, loginAt, jti, activeTenantId? }`. Re-issued on org switch.

**Session resolution** (`server/middleware/authMiddleware.js` → `applySessionTenant`):

1. Login/register/clerk-establish → `backfillMembershipFromUser`, resolve `activeTenantId`
2. **One** active membership → auto-set tenant in JWT
3. **Two or more** memberships, no valid `activeTenantId` → `needsTenantSelection`; most routes return **409** `NEEDS_TENANT_SELECTION`
4. Whitelisted without active tenant: `/api/auth/me`, `/api/tenants/memberships`, `/api/tenants/select`, `/api/tenants/create`, `/api/invites/*`
5. Client axios interceptor → `/org/pick` on 409

**App routes (multi-org UX):**

| Route | Page | Notes |
| --- | --- | --- |
| `/org/pick` | `OrgPickerPage` | Shown only when `memberships.length >= 2` |
| `/org/create` | `CreateOrganizationPage` | Post-register or add org |
| `/invites/:token/accept` | `TenantInviteAcceptPage` | Accept email invite |
| `/terms` | `TermsOfService` | Public |

**Shell:** `OrgSwitcher` in `OutletSidebar.jsx` (hidden when single org). `OrgOnboardingChecklist` on dashboard.

**Tenant API** (`server/routes/tenantRoutes.js`, `server/routes/inviteRoutes.js`):

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/tenants/memberships` | List memberships + `activeTenantId` |
| `POST` | `/api/tenants/select` | Switch org; re-issue JWT |
| `POST` | `/api/tenants/create` | Create tenant + owner membership |
| `GET` | `/api/tenants/:id/unlocks` | `featureUnlocks` for nav gating |
| `PATCH` | `/api/tenants/:id/onboarding` | Checklist steps / dismiss |
| `POST` | `/api/tenants/:id/invites` | Send invite (tenant owner/admin) |
| `GET` | `/api/invites/:token` | Validate pending invite |
| `POST` | `/api/invites/:token/accept` | Create membership + select tenant |

**Backfill:** `node server/scripts/migrateTenantMemberships.js` — idempotent `TenantMembership` from `User.tenantId`.

**Platform vs org admin:**

| Layer | Gate | Routes |
| --- | --- | --- |
| Org admin | Department `admin_*` page keys | `/admin/users`, org settings, etc. |
| Platform admin | `requirePlatformAdmin` (`isRootAdminUser`) | `/api/admin/scripts`, `/api/admin/qa`, `/api/admin/security-audit` |

Clerk org switcher stays **hidden**; org selection is app-level (not Clerk organizations).

**Feature unlocks** (`Tenant.featureUnlocks`): `resend`, `google`, `meta`, `knowledgeEngine`, `finance`, `artistOs`. Client: `navPageAccess.getNavFeatureLock()` + locked `EmptyState` props.

**Credentials at rest:** `server/utils/credentialEncryption.js` (AES-256-GCM when `CREDENTIAL_ENCRYPTION_KEY` set).

**Launch ops:** [`operations/PUBLIC_LAUNCH_BETA.md`](../operations/PUBLIC_LAUNCH_BETA.md) — staging gate, migration, invite-only beta.

---

## 3. Page catalog by domain

_Total page files: 142. Each entry lists route, exports, hooks, components, and explicit API paths._


### Authentication & legal

#### `client/src/pages/auth/ForgotPasswordPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /forgot-password |
| **Default export** | `function` |
| **Lines** | 11 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/auth/GoogleSuccessPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /auth/google/success |
| **Default export** | `GoogleSuccessPage` |
| **Lines** | 24 |
| **Hooks** | `useEffect`, `useLocation`, `useNavigate` |
| **Key components** | `BootScreen` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/auth/LoginPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /login/* |
| **Default export** | `function` |
| **Lines** | 165 |
| **Hooks** | `useAuth`, `useClerkAuth`, `useEffect`, `useLocation`, `useMemo`, `useNavigate`, `useRef`, `useState` |
| **Key components** | `AppBootError`, `AuthMarketingShell`, `BootScreen`, `ClearSessionCookiesButton`, `ClerkSignInBlock`, `InstallGuideModal` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/auth/MetaOAuthCallback.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /oauth/meta/callback |
| **Default export** | `function` |
| **Lines** | 129 |
| **Hooks** | `useEffect`, `useLocation`, `useNavigate`, `useRef`, `useState` |

**API endpoints:**

- `/api/artists/${state}/auth/meta/callback`
#### `client/src/pages/auth/OrgChoosePage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /login/choose |
| **Default export** | `function` |
| **Lines** | 142 |
| **Hooks** | `useAuth`, `useCallback`, `useClerk`, `useClerkAuth`, `useEffect`, `useNavigate`, `useQueryClient`, `useRef`, `useState` |
| **Key components** | `AuthMarketingShell`, `BootScreen` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/auth/RegisterPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /register/* |
| **Default export** | `function` |
| **Lines** | 187 |
| **Hooks** | `useAuth`, `useClerkAuth`, `useEffect`, `useLocation`, `useNavigate`, `useRef`, `useState` |
| **Key components** | `AppBootError`, `AuthMarketingShell`, `BootScreen`, `ClearSessionCookiesButton` |

**API endpoints:**

- `/api/auth/access-request`
#### `client/src/pages/auth/ResetPasswordPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /reset-password |
| **Default export** | `function` |
| **Lines** | 11 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/LandingPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /, /landing |
| **Default export** | `function` |
| **Lines** | 377 |
| **Hooks** | `useAuth` |
| **Key components** | `BootScreen`, `BrandLogo`, `LandingDashboardPreview`, `WithClerkWhenConfigured` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/legal/PrivacyPolicy.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /privacy |
| **Default export** | `function` |
| **Lines** | 165 |
| **Key components** | `BrandLogo`, `MarketingPageBackground`, `MarketingThemeToggle` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/legal/TermsOfService.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 24 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/legal/UserDataDeletion.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /userdata |
| **Default export** | `function` |
| **Lines** | 231 |
| **Hooks** | `useEffect`, `useLocation`, `useState` |
| **Key components** | `BrandLogo`, `MarketingPageBackground`, `MarketingThemeToggle` |

**API endpoints:**

- `/api/crm/unsubscribe`
- `/api/webhooks/meta-data-deletion/${encodeURIComponent(code)}`
#### `client/src/pages/Unsubscribe.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /unsubscribe |
| **Default export** | `function` |
| **Lines** | 178 |
| **Hooks** | `useMemo`, `usePublicEmailStreams`, `useSearchParams`, `useState` |

**API endpoints:**

- `/api/track/unsubscribe`

### Dashboard & productivity

#### `client/src/pages/artists/PortfolioDashboard.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /artists/portfolio |
| **Default export** | `function` |
| **Lines** | 206 |
| **Hooks** | `useNavigate`, `usePortfolioSummary` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/calendar/CalendarView.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /calendar |
| **Default export** | `CalendarView` |
| **Lines** | 505 |
| **Hooks** | `useAuth`, `useCalendarEvents`, `useCallback`, `useDeferredQueryEnabled`, `useEffect`, `useMemo`, `useState`, `useStatusCounts`, `useToast` |
| **Key components** | `CalendarEntryModal` |

**API endpoints:**

- `/api/calendar/seed-music-content`
#### `client/src/pages/Dashboard.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /dashboard |
| **Default export** | `Dashboard` |
| **Lines** | 361 |
| **Hooks** | `useAttendance`, `useAttendanceCheck`, `useAuth`, `useDashboardPreset`, `useDashboardSummary`, `useDashboardTaskActions`, `useDashboardTasks`, `useEffect`, `useLocation`, `useMemo`, `useNavigate`, `useProjects`, `useReviewTasks`, `useState`, `useUndoAttendanceCheck`, `useUserDirectory`, `useWorkspaces` |
| **Key components** | `BrandedLoadingPanel`, `DashboardTierLayout`, `OrgOnboardingChecklist` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/inbox/InboxPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /inbox |
| **Default export** | `InboxPage` |
| **Lines** | 316 |
| **Hooks** | `useAuth`, `useCallback`, `useClearAllNotifications`, `useConfirm`, `useDebounce`, `useDeferredQueryEnabled`, `useEffect`, `useMarkAllNotificationsRead`, `useMarkNotificationRead`, `useMemo`, `useNavigate`, `useNotifications`, `useState`, `useStatusCounts` |
| **Key components** | `CountBadge`, `DataListRow`, `EmptyState`, `ListPageLayout`, `PageLoadGuard`, `PageSkeleton`, `RelativeTimestamp` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/notes/NoteEditorPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /notes/:id |
| **Default export** | `function` |
| **Lines** | 300 |
| **Hooks** | `useAuth`, `useCallback`, `useDeleteNote`, `useEffect`, `useIsMobile`, `useMemo`, `useNavigate`, `useNote`, `useParams`, `useRef`, `useState`, `useToast`, `useUnsavedChanges`, `useUpdateNote` |
| **Key components** | `NoteRichEditor`, `SaveNoteDialog` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/notes/NotesPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /notes, /notes/new |
| **Default export** | `function` |
| **Lines** | 236 |
| **Hooks** | `useAuth`, `useCallback`, `useDebounce`, `useMemo`, `useNavigate`, `useState`, `useUserNotes` |
| **Key components** | `NoteComposer`, `RelativeTimestamp` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/productivity/DailyLogPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /logs |
| **Default export** | `DailyLogPage` |
| **Lines** | 688 |
| **Hooks** | `useActivityGrid`, `useAttendance`, `useAuth`, `useCallback`, `useConfirm`, `useDeferredQueryEnabled`, `useDeleteLog`, `useEffect`, `useLogs`, `useMemo`, `useNavigate`, `useProjects`, `useSearchParams`, `useState`, `useSystemToast`, `useTasks`, `useUpdateLog`, `useUserDirectory`, `useWorkspaces` |
| **Key components** | `DailyLogActivityCalendar`, `DailyLogEntryModal`, `DailyLogTimeline`, `DataOverviewSection` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/productivity/WorkflowCanvas.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /workflows |
| **Default export** | `WorkflowCanvas` |
| **Lines** | 146 |
| **Hooks** | `useCallback`, `useEdgesState`, `useNodesState`, `useState`, `useUnsavedChanges` |
| **Key components** | `QueryErrorBanner` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/schedule/SchedulePage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /schedule |
| **Default export** | `SchedulePage` |
| **Lines** | 199 |
| **Named exports** | `MAX_SCHEDULE_DAYS` |
| **Hooks** | `useAuth`, `useDashboardTaskActions`, `useDeferredQueryEnabled`, `useEffect`, `useMemo`, `useProjects`, `useQueryClient`, `useSchedule`, `useState`, `useStatusCounts`, `useUserDirectory`, `useWorkspaces` |
| **Key components** | `EmptyState`, `ListPageLayout`, `ScheduleDayViewControl`, `ScheduleGrid`, `ScheduleMobileList`, `ScheduleSkeleton` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/settings/tabs/DashboardCustomizationTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 976 |
| **Hooks** | `useAuth`, `useDashboardPreset`, `useEffect`, `useIsMobile`, `useMemo`, `useNavigate`, `useQueryClient`, `useRef`, `useState`, `useUnsavedChanges` |

**API endpoints:**

- `/api/customization/dashboard/preset`
#### `client/src/pages/todo/TodoPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /todo |
| **Default export** | `TodoPage` |
| **Lines** | 768 |
| **Hooks** | `useAuth`, `useCallback`, `useDebounce`, `useDeferredQueryEnabled`, `useEffect`, `useMemo`, `useProjects`, `useQueryClient`, `useState`, `useSystemToast`, `useTaskCategoryOptions`, `useTodoTasks`, `useUserDirectory`, `useWorkspaces` |
| **Key components** | `CompletedTaskRollbackButton`, `FlashHighlightListener`, `ListCard`, `ListPageLayout`, `MentionTitle`, `PageLoadGuard`, `PageSkeleton`, `SearchInput`, `TaskMentionBadge`, `VirtualTaskList` |

**API endpoints:**

- `/api/tasks/${task?._id}`

### Projects & workspaces

#### `client/src/pages/projects/ProjectAnalyticsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /projects/:id/analytics |
| **Default export** | `ProjectAnalyticsPage` |
| **Lines** | 55 |
| **Hooks** | `useNavigate`, `useParams`, `useProject`, `useProjectReportRangeState` |
| **Key components** | `ProjectAnalyticsContent`, `ProjectReportRangeControls` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/projects/ProjectCreate.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /projects/new |
| **Default export** | `ProjectCreate` |
| **Lines** | 281 |
| **Hooks** | `useCallback`, `useEffect`, `useNavigate`, `useQueryClient`, `useRef`, `useSearchParams`, `useState`, `useToast` |
| **Key components** | `NexusDropdown`, `RoleOptionBoxes`, `WorkspaceSelect` |

**API endpoints:**

- `/api/projects`
- `/api/projects/workspaces/${encodeURIComponent(workspace)}`
- `/api/users/team`
#### `client/src/pages/projects/ProjectDetail.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /projects/:id |
| **Default export** | `ProjectDetail` |
| **Lines** | 576 |
| **Hooks** | `useAuth`, `useCallback`, `useDeferredQueryEnabled`, `useDeleteTask`, `useEffect`, `useLocation`, `useMemo`, `useNavigate`, `useParams`, `useProject`, `useProjectHoursSummary`, `useProjectTasks`, `useQueryClient`, `useReviewTasks`, `useSchedule`, `useState`, `useSystemToast`, `useUpdateTask`, `useUserDirectory`, `useWorkspaces` |
| **Key components** | `ProjectAssets`, `ProjectFinance`, `ProjectGoalsPanel`, `ProjectGoalsStrip`, `ProjectKanban`, `ProjectList`, `ProjectSettingsModal`, `ProjectTeam`, `ScheduleGrid`, `ScheduleSkeleton`, `TaskCompletionModal`, `TaskCreateModal`, `TaskDetailModal` |

**API endpoints:**

- `/api/projects/${id}`
- `/api/projects/${id}/remove-member`
- `/api/tasks/${taskId}`
#### `client/src/pages/projects/ProjectsView.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /projects |
| **Default export** | `ProjectsView` |
| **Lines** | 1406 |
| **Hooks** | `useAuth`, `useCallback`, `useConfirm`, `useDashboardTasks`, `useDeferredQueryEnabled`, `useEffect`, `useLocation`, `useMemo`, `useNavigate`, `useProjects`, `useQueryClient`, `useRef`, `useReviewTasks`, `useState`, `useToast`, `useUpdateProject`, `useWorkspaces` |
| **Key components** | `WorkspaceColorPicker`, `WorkspaceSelect` |

**API endpoints:**

- `/api/projects`
- `/api/projects/${id}`
- `/api/projects/workspaces`
- `/api/projects/workspaces/${group.name}`
#### `client/src/pages/projects/WorkspaceSettings.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /workspaces/:name |
| **Default export** | `WorkspaceSettings` |
| **Lines** | 469 |
| **Hooks** | `useAuth`, `useCallback`, `useEffect`, `useMemo`, `useNavigate`, `useParams`, `useQueryClient`, `useState`, `useUnsavedChanges` |
| **Key components** | `NexusDropdown`, `QueryErrorSlot`, `RoleOptionBoxes`, `WorkspaceColorPicker`, `WorkspaceGoalsPanel` |

**API endpoints:**

- `/api/projects/workspaces/${encodeURIComponent(workspaceApiName)}`
- `/api/users/team`

### CRM & sales

#### `client/src/pages/crm/ArtistBookingEnquiriesPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | (CRM sub) |
| **Default export** | `function` |
| **Lines** | 135 |
| **Hooks** | `useAuth`, `useDebounce`, `useLiveLeads`, `useMemo`, `useState` |
| **Key components** | `ArtistBookingEnquiryPanel` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/crm/ExlyBookingsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | (tab: bookings) |
| **Default export** | `ExlyBookingsPage` |
| **Lines** | 18 |
| **Key components** | `ExlyDataContent` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/crm/FollowupsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | (tab: followups) |
| **Default export** | `function` |
| **Lines** | 816 |
| **Hooks** | `useAuth`, `useCRMConfig`, `useCallback`, `useConfirm`, `useDeferredQueryEnabled`, `useEffect`, `useLiveLeads`, `useMemo`, `useQueryClient`, `useSalesReps`, `useSearchParams`, `useState`, `useToast`, `useUpdateLead` |
| **Key components** | `ArtistBookingEnquiryPanel`, `LeadLockIndicator`, `PhoneNumberFields` |

**API endpoints:**

- `/api/crm/leads/${selectedLead._id}/audit`
- `/api/crm/leads/${selectedLead._id}/lock-heartbeat`
- `/api/crm/leads/${selectedLead._id}/notes`
#### `client/src/pages/crm/LeadsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | (tab: leads) |
| **Default export** | `function` |
| **Lines** | 1311 |
| **Hooks** | `useArtistImportSheets`, `useArtistReps`, `useAuth`, `useCRMConfig`, `useCRMStats`, `useCallback`, `useConfirm`, `useCreateLead`, `useDebounce`, `useDeferredQueryEnabled`, `useEffect`, `useLeadDetail`, `useLiveLeads`, `useMemo`, `useQueryClient`, `useRef`, `useSalesReps`, `useSearchParams`, `useState`, `useToast`, `useUnsavedChanges`, `useUpdateLead` |
| **Key components** | `ArtistBookingEnquiryPanel`, `ArtistCrmImportPanel`, `LeadArtistJourneySection`, `LeadLockIndicator`, `LeadRowActions`, `PhoneNumberFields` |

**API endpoints:**

- `/api/crm/leads/${highlightId}`
- `/api/crm/leads/${selectedLead._id}`
- `/api/crm/leads/${selectedLead._id}/audit`
- `/api/crm/leads/${selectedLead._id}/lock-heartbeat`
- `/api/crm/leads/${selectedLead._id}/notes`
#### `client/src/pages/hubs/CrmHub.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /crm?tab=leads|followups|bookings |
| **Default export** | `function` |
| **Lines** | 31 |
| **Hooks** | `useAuth` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._

### Office hub

#### `client/src/pages/hubs/OfficeHub.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /office?tab=equipment|contacts|subscriptions |
| **Default export** | `function` |
| **Lines** | 19 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/management/ContactsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | (tab: contacts) |
| **Default export** | `ContactsPage` |
| **Lines** | 287 |
| **Hooks** | `useMemo`, `useMutation`, `useQuery`, `useQueryClient`, `useState`, `useUnsavedChanges` |
| **Key components** | `ContactMobileRow`, `ListPageLayout`, `ListPageSkeleton`, `SearchInput` |

**API endpoints:**

- `/api/contacts`
- `/api/contacts/${editingContact._id}`
#### `client/src/pages/management/EquipmentPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | (tab: equipment) |
| **Default export** | `EquipmentPage` |
| **Lines** | 358 |
| **Hooks** | `useDeferredQueryEnabled`, `useMemo`, `useMutation`, `useQuery`, `useQueryClient`, `useState`, `useUnsavedChanges`, `useUserDirectory` |
| **Key components** | `EquipmentMobileRow`, `ListPageLayout`, `ListPageSkeleton`, `SearchInput`, `StatusBadge` |

**API endpoints:**

- `/api/office-assets`
- `/api/office-assets/${editingAsset._id}`
#### `client/src/pages/office/OfficeAssetsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /office-assets |
| **Default export** | `OfficeAssetsPage` |
| **Lines** | 665 |
| **Hooks** | `useCallback`, `useConfirm`, `useDeferredQueryEnabled`, `useEffect`, `useMemo`, `useMutation`, `useQuery`, `useQueryClient`, `useState`, `useUnsavedChanges`, `useUserDirectory` |
| **Key components** | `ContactMobileRow`, `EquipmentMobileRow` |

**API endpoints:**

- `/api/contacts`
- `/api/contacts/${editingContact._id}`
- `/api/contacts/${id}`
- `/api/office-assets`
- `/api/office-assets/${editingAsset._id}`
- `/api/office-assets/${id}`
#### `client/src/pages/office/SubscriptionsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | (tab: subscriptions) |
| **Default export** | `SubscriptionsPage` |
| **Lines** | 536 |
| **Hooks** | `useConfirm`, `useEffect`, `useMemo`, `useMutation`, `useQuery`, `useQueryClient`, `useRef`, `useState`, `useUnsavedChanges`, `useUsdInrRate` |
| **Key components** | `MemberSelect`, `SubscriptionMobileRow`, `UsdInrAmountFields` |

**API endpoints:**

- `/api/subscriptions`
- `/api/subscriptions/${editing._id}`
- `/api/subscriptions/${id}`

### Management hub

#### `client/src/pages/artists/ArtistsCollection.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | (tab: artists) |
| **Default export** | `function` |
| **Lines** | 333 |
| **Hooks** | `useArtists`, `useCallback`, `useCreateArtist`, `useMemo`, `useNavigate`, `useState`, `useSyncArtistStats` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/finance/FinancePage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | (tab: finance) |
| **Default export** | `FinancePage` |
| **Lines** | 1314 |
| **Hooks** | `useAuth`, `useCallback`, `useConfirm`, `useDeferredQueryEnabled`, `useEffect`, `useMemo`, `useMutation`, `useQuery`, `useQueryClient`, `useSearchParams`, `useState`, `useUsdInrRate`, `useWorkspaces` |
| **Key components** | `FinanceDocumentPreview`, `NeedsAttentionAccordion`, `UploadDocumentModal`, `UsdInrAmountFields` |

**API endpoints:**

- `/api/finance/${id}`
- `/api/finance/${id}/approve`
- `/api/finance/${id}/reject`
- `/api/finance/bulk`
- `/api/finance/folders`
- `/api/finance/folders/${currentFolderId}/breadcrumb`
- `/api/finance/folders/${folderId}`
- `/api/finance/folders?project=${selectedProject}`
- `/api/finance/pending`
- `/api/finance?${params}`
- `/api/projects`
#### `client/src/pages/hubs/ManagementHub.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /management?tab=finance|announcements|documents|artists |
| **Default export** | `function` |
| **Lines** | 21 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/management/AnnouncementsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | (tab: announcements) |
| **Default export** | `AnnouncementsPage` |
| **Lines** | 251 |
| **Hooks** | `useAnnouncementTargets`, `useAnnouncements`, `useCallback`, `useConfirm`, `useCreateAnnouncement`, `useDeferredQueryEnabled`, `useDeleteAnnouncement`, `useMemo`, `useState` |
| **Key components** | `WorkspaceProjectFields` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/management/AttendancePage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /attendance, /attendance/all |
| **Default export** | `AttendancePage` |
| **Lines** | 744 |
| **Hooks** | `useApproveAttendance`, `useApproveLeaveRequest`, `useAttendance`, `useAttendanceCheck`, `useAttendanceRosterUsers`, `useAuth`, `useDeferredQueryEnabled`, `useEffect`, `useLeaveRequests`, `useLocation`, `useMemo`, `useNavigate`, `useRejectLeaveRequest`, `useResetAttendance`, `useState`, `useSystemToast`, `useUndoAttendanceCheck`, `useUnsavedChanges`, `useUpsertAttendance` |
| **Key components** | `AttendanceStatusLegend`, `MonthlyAttendanceGrid`, `SelfMonthlyAttendanceCalendar`, `TeamAttendanceMobileList`, `UnifiedTimeCard` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._

### Email & campaigns

#### `client/src/pages/CampaignDetails.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /campaign/:campaignId |
| **Default export** | `function` |
| **Lines** | 853 |
| **Hooks** | `useCallback`, `useCampaignAnalytics`, `useCampaignDetails`, `useCampaignRecipients`, `useEffect`, `useLocation`, `useMailProfiles`, `useMemo`, `useNavigate`, `useParams`, `useResendCampaign`, `useResendFilteredCampaign`, `useState`, `useStopCampaign`, `useToast` |
| **Key components** | `RegisteredLocationBarChart`, `ResendFromEmailPicker` |

**API endpoints:**

- `/api/campaigns/${campaignApiId}/recipients/export?${params}`
#### `client/src/pages/emails/EmailHubLayout.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 29 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/emails/EmailsAnalyticsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /emails/analytics |
| **Default export** | `function` |
| **Lines** | 59 |
| **Hooks** | `useCumulativeAnalytics`, `useDeferredQueryEnabled`, `useMailStats`, `useState` |
| **Key components** | `MailCumulativeAnalyticsPanel`, `MailLocationLeadsModal`, `MailStatsSummary` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/emails/EmailsCampaignsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /emails/campaigns |
| **Default export** | `function` |
| **Lines** | 50 |
| **Hooks** | `useDeferredQueryEnabled`, `useMailProfiles`, `useNavigate`, `useScanBounces`, `useToast` |
| **Key components** | `MailCampaignList` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/emails/EmailsOverviewPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /emails |
| **Default export** | `function` |
| **Lines** | 115 |
| **Hooks** | `useDeferredQueryEnabled`, `useMailCampaigns`, `useMailStats`, `useNavigate` |
| **Key components** | `MailCampaignList`, `MailStatsSummary` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/emails/EmailsProfilesPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /emails/profiles |
| **Default export** | `function` |
| **Lines** | 32 |
| **Hooks** | `useMailProfiles` |
| **Key components** | `MailProfilesPanel` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/emails/EmailsStreamsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /emails/streams |
| **Default export** | `function` |
| **Lines** | 33 |
| **Hooks** | `useEmailStreams` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/emails/EmailsTemplatesPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /emails/templates |
| **Default export** | `function` |
| **Lines** | 37 |
| **Hooks** | `useNavigate` |
| **Key components** | `MailTemplateStudio` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/workspace/CreateCampaignPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /emails/create |
| **Default export** | `CreateCampaignPage` |
| **Lines** | 28 |
| **Hooks** | `useNavigate` |
| **Key components** | `CampaignWizardShell` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/workspace/NewsletterCuratePage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /emails/newsletter/curate |
| **Default export** | `NewsletterCuratePage` |
| **Lines** | 62 |
| **Hooks** | `useAuth`, `useCurrentNewsletterIssue`, `useNavigate`, `useNewsletterCategories`, `useNewsletterIssue`, `useSearchParams` |
| **Key components** | `NewsletterCuratorPanel` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/workspace/NewsletterPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /emails/newsletter |
| **Default export** | `NewsletterPage` |
| **Lines** | 123 |
| **Hooks** | `useAuth`, `useCurrentNewsletterIssue`, `useNavigate`, `useNewsletterCategories` |
| **Key components** | `NewsletterLinkForm`, `NewsletterWeekBoard` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/workspace/NewsletterSendPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /emails/newsletter/send/:issueId |
| **Default export** | `NewsletterSendPage` |
| **Lines** | 63 |
| **Hooks** | `useAuth`, `useNavigate`, `useNewsletterIssue`, `useParams` |
| **Key components** | `NewsletterSendWizard` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._

### Artist OS & workspace

#### `client/src/pages/artists/ArtistDetail.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /artists/:id/*, /preview/artist/:id/* |
| **Default export** | `function` |
| **Lines** | 326 |
| **Hooks** | `useArtistDashboard`, `useConfirm`, `useNavigate`, `useParams`, `useState` |
| **Key components** | `ArtistEditDrawer`, `ArtistShareModal`, `ClaimWorkspaceBanner` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/artists/ArtistOSLayout.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 112 |
| **Hooks** | `useEffect`, `useMemo`, `useSearchParams` |
| **Key components** | `ArtistProductHint`, `PageSkeleton` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/artists/ArtistPublicProfile.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /artist/:slug |
| **Default export** | `function` |
| **Lines** | 311 |
| **Hooks** | `useEffect`, `useMemo`, `useMutation`, `useParams`, `usePublicArtist`, `useQuery`, `useState` |
| **Key components** | `BrandLogo` |

**API endpoints:**

- `/api/artists/public/${slug}`
- `/api/artists/public/${slug}/inquiry`
#### `client/src/pages/artists/artistTabLoaders.js`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `—` |
| **Lines** | 58 |
| **Named exports** | `getLazyArtistOsTab`, `getLazyArtistWorkspaceTab`, `ARTIST_OS_TAB_LOADERS`, `ARTIST_WORKSPACE_TAB_LOADERS` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/artists/os/ArtistAnalyticsTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 328 |
| **Hooks** | `useArtistAnalytics`, `useArtistOsScores`, `useCallback`, `useEffect`, `useMemo`, `useSearchParams`, `useState`, `useTimeRange` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/artists/os/ArtistCalendarTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 113 |
| **Hooks** | `useArtistOsCalendar`, `useCreateArtistCalendarEvent`, `useState` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/artists/os/ArtistCommandCenter.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 27 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/artists/os/ArtistConnectOnboarding.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 96 |
| **Hooks** | `useAuth` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/artists/os/ArtistContentTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 188 |
| **Hooks** | `useArtistOsAssets`, `useCreateArtistAsset`, `useDeleteArtistAsset`, `useMemo`, `useState`, `useUpdateArtistAsset` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/artists/os/ArtistContractsTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 57 |
| **Hooks** | `useArtistOsContracts`, `useCreateArtistContract`, `useState` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/artists/os/ArtistDocumentsTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 69 |
| **Named exports** | `getArtistDocumentsDescription` |
| **Hooks** | `useArtistOsDocuments`, `useSearchParams` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/artists/os/ArtistDocumentsTab.test.js`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `—` |
| **Lines** | 19 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/artists/os/ArtistDocumentsTab.test.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `—` |
| **Lines** | 44 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/artists/os/ArtistFinanceTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 136 |
| **Hooks** | `useArtistOsFinance`, `useCreateArtistFinanceEntry`, `useState` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/artists/os/ArtistGigsTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 100 |
| **Hooks** | `useArtistOsGigs`, `useCreateArtistGig`, `useState`, `useUpdateArtistGig` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/artists/os/ArtistInquiriesTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 131 |
| **Hooks** | `useArtistOsInquiries`, `useCreateArtistInquiry`, `useState`, `useUpdateArtistInquiry` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/artists/os/ArtistNotesTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 42 |
| **Hooks** | `useArtistOsNotes`, `useCreateArtistNote`, `useState` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/artists/os/artistOsConstants.js`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `—` |
| **Lines** | 68 |
| **Named exports** | `ARTIST_OS_TABS`, `CALENDAR_EVENT_COLORS`, `BOOKING_PIPELINE_STAGES`, `INQUIRY_STATUSES`, `ASSET_TYPES`, `EXPENSE_CATEGORIES`, `REVENUE_CATEGORIES`, `formatInr` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/artists/os/ArtistOsQueryShell.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 27 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/artists/os/ArtistOsQueryShell.test.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `—` |
| **Lines** | 41 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/artists/os/ArtistOverviewPanel.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 471 |
| **Hooks** | `useArtistOsCalendar`, `useArtistOsContent`, `useArtistOsGigs`, `useArtistOsInquiries`, `useArtistOsOverview`, `useArtistOsScores`, `useArtistOsTimeline`, `useConnectionHealth`, `useConnectionHub`, `useMemo`, `useSyncPlatformConnection` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/artists/workspace/ArtistBookingsTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 64 |
| **Hooks** | `useArtistOsInquiries`, `useMemo`, `useState` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/artists/workspace/ArtistMembershipAccept.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /artist-workspace/:id/accept |
| **Default export** | `function` |
| **Lines** | 139 |
| **Hooks** | `useAcceptArtistMembership`, `useEffect`, `useNavigate`, `useParams`, `useRef`, `useSearchParams`, `useState` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/artists/workspace/ArtistReleasesTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 225 |
| **Hooks** | `useArtistOsReleases`, `useCreateArtistRelease`, `useDeleteArtistRelease`, `useState`, `useUpdateArtistRelease` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/artists/workspace/ArtistTeamTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 150 |
| **Hooks** | `useArtistMemberships`, `useInviteArtistMembership`, `useRemoveArtistMembership`, `useState`, `useUpdateArtistMembership` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/artists/workspace/artistWorkspaceConstants.js`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `—` |
| **Lines** | 21 |
| **Named exports** | `ARTIST_WORKSPACE_TABS`, `ARTIST_WORKSPACE_NAV`, `DEFAULT_WORKSPACE_TAB` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/artists/workspace/ArtistWorkspaceDetail.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | (workspace routes) |
| **Default export** | `function` |
| **Lines** | 109 |
| **Hooks** | `useArtistDashboard`, `useArtistMembership`, `useAuth`, `useMemo`, `useParams`, `useState` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/artists/workspace/ArtistWorkspaceLayout.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 155 |
| **Hooks** | `useEffect`, `useMemo`, `useSearchParams` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/artists/workspace/ArtistWorkspaceNoAccess.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 37 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/artists/workspace/ArtistWorkspaceShell.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /artist-workspace/:id/* (shell) |
| **Default export** | `function` |
| **Lines** | 151 |
| **Hooks** | `useArtist`, `useArtistMembership`, `useAuth`, `useMemo`, `useParams`, `useSearchParams`, `useState` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/artists/workspace/tabs/ArtistWorkspaceHome.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 26 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/artists/workspace/tabs/ArtistWorkspaceSettings.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 95 |
| **Hooks** | `useEffect`, `useState`, `useUpdateArtist` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._

### Assets

#### `client/src/pages/assets/AssetsHubLayout.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 35 |
| **Hooks** | `useAuth` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/assets/AssetsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /assets |
| **Default export** | `AssetsPage` |
| **Lines** | 871 |
| **Hooks** | `useAssets`, `useAuth`, `useCallback`, `useCreateAsset`, `useDeferredQueryEnabled`, `useDeleteAsset`, `useEffect`, `useGoogleAccounts`, `useMemo`, `useProjects`, `useQueryClient`, `useSearchParams`, `useState`, `useUnlinkGoogleAccount`, `useUnsavedChanges`, `useUpdateAsset`, `useWorkspaces` |
| **Key components** | `MentionTextarea`, `ProjectMultiSelect` |

**API endpoints:**

- `/api/auth/google?state=link_${user?._id}`
- `/api/google/accounts/manual`
- `/api/google/accounts/simulate`
#### `client/src/pages/assets/OrgAccountsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /assets/accounts |
| **Default export** | `OrgAccountsPage` |
| **Lines** | 768 |
| **Hooks** | `useCallback`, `useConfirm`, `useDeferredQueryEnabled`, `useEffect`, `useMemo`, `useMutation`, `useQuery`, `useQueryClient`, `useState`, `useToast`, `useUnsavedChanges` |
| **Key components** | `MemberSelect`, `ProjectMultiSelect` |

**API endpoints:**

- `/api/org-accounts`
- `/api/org-accounts/${account._id}`
- `/api/org-accounts/${editing._id}`
- `/api/org-accounts/${id}`
- `/api/org-accounts/import-sheet`
- `/api/projects`

### Admin & Data Hub

#### `client/src/pages/admin/AdminCRM.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /admin |
| **Default export** | `AdminCRM` |
| **Lines** | 7 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/admin/AdminExly.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `AdminExly` |
| **Lines** | 15 |
| **Key components** | `ExlyDataContent` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/admin/AdminGamification.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /admin/gamification |
| **Default export** | `AdminGamification` |
| **Lines** | 369 |
| **Hooks** | `useCallback`, `useConfirm`, `useEffect`, `useMemo`, `useQueryClient`, `useState`, `useUnsavedChanges` |

**API endpoints:**

- `/api/gamification-admin/config`
- `/api/gamification-admin/recalculate-all-levels`
- `/api/gamification-admin/rules`
#### `client/src/pages/admin/AdminPanel.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /admin/control |
| **Default export** | `AdminPanel` |
| **Lines** | 483 |
| **Hooks** | `useAuth`, `useCRMStats`, `useCallback`, `useConfirm`, `useCreateTeam`, `useDataHubFolders`, `useDeferredQueryEnabled`, `useDeleteTeam`, `useDeleteUser`, `useEffect`, `useMailStats`, `useMemo`, `usePlatformExclusions`, `useSearchParams`, `useState`, `useTeams`, `useToast`, `useUpdateUser`, `useUserDirectory` |
| **Key components** | `AdminUserGridCard`, `ClerkDashboardUsersButton`, `MonthlyReportPanel`, `UserDeleteAction` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/admin/AdminPlatformSettings.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /admin/platform-settings |
| **Default export** | `AdminPlatformSettings` |
| **Lines** | 161 |
| **Hooks** | `useCallback`, `useDeferredQueryEnabled`, `useEffect`, `useMemo`, `useQueryClient`, `useState`, `useToast`, `useUserDirectory` |
| **Key components** | `PlatformSettingsUserField`, `QueryErrorSlot` |

**API endpoints:**

- `/api/admin/platform-settings`
#### `client/src/pages/admin/AdminProjectAnalyticsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /admin/project-analytics |
| **Default export** | `AdminProjectAnalyticsPage` |
| **Lines** | 446 |
| **Hooks** | `useDeferredQueryEnabled`, `useEffect`, `useMemo`, `useProjectReportRangeState`, `useProjects`, `useProjectsAnalyticsSummary`, `useRef`, `useSearchParams`, `useState` |
| **Key components** | `ProjectAnalyticsContent`, `ProjectAnalyticsKpiGrid`, `ProjectReportRangeControls` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/admin/AdminRolesPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /admin/roles |
| **Default export** | `AdminRolesPage` |
| **Lines** | 120 |
| **Hooks** | `useAdminRoles`, `useMemo` |
| **Key components** | `OrgRolesPanel` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/admin/AdminScriptsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /admin/scripts |
| **Default export** | `AdminScriptsPage` |
| **Lines** | 273 |
| **Hooks** | `useDeferredQueryEnabled`, `useMemo`, `useQuery`, `useState` |
| **Key components** | `RelativeTimestamp` |

**API endpoints:**

- `/api/admin/queues/status`
- `/api/admin/scripts`
- `/api/admin/scripts/${scriptId}/run`
#### `client/src/pages/admin/AdminTeamsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /admin/teams |
| **Default export** | `AdminTeamsPage` |
| **Lines** | 168 |
| **Hooks** | `useCallback`, `useDepartments`, `useMemo`, `useState`, `useUpdateUser`, `useUserDirectory` |
| **Key components** | `AdminBulkActionBar`, `DepartmentsPanel` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/admin/AdminTenantSsoPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /admin/tenant-sso |
| **Default export** | `function` |
| **Lines** | 114 |
| **Hooks** | `useCallback`, `useEffect`, `useState`, `useToast` |
| **Key components** | `QueryErrorSlot` |

**API endpoints:**

- `/api/admin/tenants`
- `/api/admin/tenants/${tenant._id}`
#### `client/src/pages/admin/AdminUsers.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /admin/users |
| **Default export** | `AdminUsers` |
| **Lines** | 565 |
| **Hooks** | `useAuth`, `useCRMStats`, `useCallback`, `useConfirm`, `useCreateUser`, `useDataHubFolders`, `useDeferredQueryEnabled`, `useDeleteUser`, `useDepartments`, `useEffect`, `useMailStats`, `useMemo`, `usePlatformExclusions`, `useState`, `useUpdateUser`, `useUserDirectory` |
| **Key components** | `AdminBulkActionBar`, `AdminUserGridCard`, `ClerkDashboardUsersButton`, `CreateUserModal`, `MonthlyReportPanel`, `PagePermissionsEditor`, `UserDeleteAction` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/admin/ArtistPathPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /admin/artist-path |
| **Default export** | `function` |
| **Lines** | 110 |
| **Hooks** | `useArtistPathPeople`, `useArtistPathSync`, `useDebounce`, `useState`, `useToast` |
| **Key components** | `ArtistPathCardGrid`, `ArtistProductHint`, `SearchInput` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/admin/AuditLogPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `AuditLogPage` |
| **Lines** | 66 |
| **Hooks** | `useEffect`, `useState` |

**API endpoints:**

- `/api/enterprise/audit`
#### `client/src/pages/admin/CrmStatsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /admin/crm-stats |
| **Default export** | `function` |
| **Lines** | 438 |
| **Hooks** | `useAuth`, `useCrmStats`, `useCrmStatsTrends`, `useMemo`, `useState` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/admin/DataHubPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | (AdminCRM tab) |
| **Default export** | `function` |
| **Lines** | 531 |
| **Named exports** | `DataHubContent` |
| **Hooks** | `useCallback`, `useConfirm`, `useDataHubAnalytics`, `useDataHubBackups`, `useDataHubFolders`, `useDataHubPeople`, `useDataHubProductionBackup`, `useDataHubReconcile`, `useDataHubSyncStatus`, `useDebounce`, `useDeferredQueryEnabled`, `useEffect`, `useMemo`, `useQueryClient`, `useRef`, `useState`, `useToast` |
| **Key components** | `DataHubInletCluster`, `DataHubOpsMenu`, `DataHubTemporalColumn`, `ListPageLayout`, `SearchInput`, `StatusBadge` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/admin/ExlyCampaignsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /admin/exly-campaigns |
| **Default export** | `ExlyCampaignsPage` |
| **Lines** | 75 |
| **Hooks** | `useState` |
| **Key components** | `ExlyDataContent`, `MasterclassFunnelPanel` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/admin/KnowledgeEnginePage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /admin/knowledge-engine |
| **Default export** | `function` |
| **Lines** | 401 |
| **Hooks** | `useApproveKnowledgeArticle`, `useCreateDistribution`, `useCreateKnowledgeArticle`, `useEffect`, `useGenerateBrief`, `useHook`, `useKnowledgeAnalytics`, `useKnowledgeArticles`, `useKnowledgeBriefs`, `useKnowledgeChunks`, `useKnowledgeConnections`, `useKnowledgeDashboard`, `useKnowledgeDistribution`, `useKnowledgeJobTrigger`, `useKnowledgeOpportunities`, `useKnowledgeSettings`, `useKnowledgeSources`, `useMediumPrep`, `useMemo`, `usePublishKnowledgeArticle`, `useRunArticlePipeline`, `useSearchParams`, `useSetMediumUrl`, `useState`, `useToast`, `useUpdateKnowledgeSettings` |
| **Key components** | `AdminConsoleBackButton`, `PageHeader`, `SearchInput` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/admin/LeadAuditsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /admin/lead-audits |
| **Default export** | `LeadAuditsPage` |
| **Lines** | 69 |
| **Hooks** | `useAuth`, `useConfirm`, `useLeadAudits`, `useState` |
| **Key components** | `LeadAuditsContent` |

**API endpoints:**

- `/api/crm/leads/audit-logs/purge`
#### `client/src/pages/admin/MediaListPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /admin/media-list |
| **Default export** | `MediaListPage` |
| **Lines** | 283 |
| **Hooks** | `useCallback`, `useDeferredQueryEnabled`, `useMemo`, `useQuery`, `useState` |
| **Key components** | `ListPageLayout`, `PageSkeleton`, `SearchInput` |

**API endpoints:**

- `/api/admin/media-contacts`
- `/api/admin/media-contacts/filters`
#### `client/src/pages/admin/OpsHubPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /admin/ops-hub |
| **Default export** | `function` |
| **Lines** | 305 |
| **Hooks** | `useAuth`, `useCreateOpsEntity`, `useDebounce`, `useEffect`, `useMemo`, `useOpsHubAnalytics`, `useOpsHubEntities`, `useOpsHubEntity`, `useOpsHubTaxonomy`, `useOpsHubWeekly`, `useSearchParams`, `useState`, `useToast` |
| **Key components** | `OpsEntityDetail`, `OpsHubAnalyticsPanel`, `OpsMondayBoard`, `PageToolbar`, `SearchInput`, `StatusBadge` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/admin/QATestingPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /admin/qa |
| **Default export** | `QATestingPage` |
| **Lines** | 1324 |
| **Hooks** | `useCallback`, `useConfirm`, `useDeferredQueryEnabled`, `useEffect`, `useMemo`, `useMutation`, `useProjects`, `useQAProgress`, `useQuery`, `useQueryClient`, `useState`, `useSystemToast` |

**API endpoints:**

- `/api/crm/leads/cleanup-test-data`
- `/api/qa/cancel/${testRunId}`
- `/api/qa/history`
- `/api/qa/lighthouse-routes`
- `/api/qa/progress`
- `/api/qa/progress?testRunId=${testRunId}`
- `/api/qa/purge-test-data`
- `/api/qa/resolve/${testRunId}/${testCaseId}`
- `/api/qa/results/${latestRunId}`
- `/api/qa/start`
#### `client/src/pages/admin/SecurityAuditPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /admin/security-audit |
| **Default export** | `function` |
| **Lines** | 83 |
| **Hooks** | `useMemo`, `useQuery`, `useState` |
| **Key components** | `QueryErrorSlot` |

**API endpoints:**

- `/api/admin/security-audit`
#### `client/src/pages/hubs/AdminConsole.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /admin/console |
| **Default export** | `function` |
| **Lines** | 344 |
| **Hooks** | `useAdminConsoleSummary`, `useAuth`, `useCallback`, `useMemo`, `useNavigate`, `useState`, `useTenantUnlocks` |
| **Key components** | `DataListRow`, `DataOverviewSection`, `PageHeader` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._

### Settings

#### `client/src/pages/settings/DevelopersPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /developers |
| **Default export** | `DevelopersPage` |
| **Lines** | 375 |
| **Hooks** | `useEffect`, `useState`, `useWebhookDeliveries` |

**API endpoints:**

- `/api/enterprise/api-keys`
- `/api/enterprise/usage`
- `/api/enterprise/webhooks`
- `/api/enterprise/webhooks/${id}`
- `/api/openapi.json`
#### `client/src/pages/settings/SettingsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /settings |
| **Default export** | `SettingsPage` |
| **Lines** | 185 |
| **Hooks** | `useAuth`, `useEffect`, `useNavigate`, `useSearchParams`, `useState` |
| **Key components** | `PageSkeleton` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/settings/tabs/AttendanceTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 81 |
| **Hooks** | `useAttendance`, `useAuth` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/settings/tabs/IntegrationsTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 153 |
| **Hooks** | `useConnectIntegration`, `useDisconnectIntegration`, `useIntegrationHealth`, `useIntegrationProviders`, `useIntegrationSync`, `useMemo`, `usePatchIntegrationMetadata`, `useSearchParams`, `useState` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/settings/tabs/InvoiceTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 410 |
| **Hooks** | `useEffect`, `useMemo`, `useMyReimbursements`, `useProjects`, `useQueryClient`, `useRef`, `useState`, `useWorkspaces` |

**API endpoints:**

- `/api/finance/submit-invoice`
#### `client/src/pages/settings/tabs/KeyboardShortcutsTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `KeyboardShortcutsTab` |
| **Lines** | 401 |
| **Hooks** | `useAuth`, `useCallback`, `useEffect`, `useMemo`, `useQueryClient`, `useRef`, `useShortcutPreferences`, `useState` |

**API endpoints:**

- `/api/customization/shortcuts`
- `/api/customization/shortcuts/reset`
#### `client/src/pages/settings/tabs/LeaveTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 114 |
| **Hooks** | `useApplyLeave`, `useAuth`, `useCallback`, `useLeaveRequests`, `useMemo`, `useState` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/settings/tabs/NotificationsTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 184 |
| **Hooks** | `useCallback`, `useEffect`, `useState` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/settings/tabs/OrganizationTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 183 |
| **Hooks** | `useAuth`, `useNavigate`, `useOffboardOrganization`, `useOrgSettings`, `useQuery`, `useQueryClient`, `useUpdateOrgSettings` |

**API endpoints:**

- `/api/tenants/memberships`
- `/api/tenants/select`
#### `client/src/pages/settings/tabs/ProfileTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 523 |
| **Hooks** | `useAuth`, `useCallback`, `useDateFormat`, `useEffect`, `useMemo`, `useNavigate`, `useState`, `useUnsavedChanges` |

**API endpoints:**

- `/api/auth/change-required-password`
- `/api/teams`
- `/api/users/profile`
#### `client/src/pages/settings/tabs/ProgressTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 222 |
| **Hooks** | `useGamificationHistory`, `useGamificationMissions`, `useGamificationProgress`, `useMemo`, `useState` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/settings/tabs/SessionsTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `SessionsTab` |
| **Lines** | 169 |
| **Hooks** | `useAuth`, `useCallback`, `useMutation`, `useQuery`, `useQueryClient`, `useState` |

**API endpoints:**

- `/api/auth/sessions`
- `/api/auth/sessions/${jti}`
- `/api/auth/sessions/revoke-others`

### Marketing, dev & misc

#### `client/src/pages/billing/UpgradePage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 160 |
| **Hooks** | `useAuth`, `useMemo`, `useQueryClient`, `useState`, `useTenantUnlocks`, `useToast` |

**API endpoints:**

- `/api/tenants/${tenantId}/billing/checkout`
#### `client/src/pages/dev/ComponentsShowcase.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /components |
| **Default export** | `ComponentsShowcase` |
| **Lines** | 803 |
| **Hooks** | `useMemo`, `useState` |
| **Key components** | `AppErrorPage`, `FluidRibbonLoaderGallery` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/hubs/TabHubLayout.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 75 |
| **Hooks** | `useAuth`, `useEffect`, `useMemo`, `useSearchParams` |
| **Key components** | `HubPageLayout`, `ModuleSubnav` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/management/DocumentsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 296 |
| **Hooks** | `useConfirm`, `useCreateOrgDocument`, `useDeleteOrgDocument`, `useMemo`, `useOrgDocuments`, `useState`, `useUpdateOrgDocument` |
| **Key components** | `ListPageLayout`, `ListPageSkeleton`, `OrgDocumentModal`, `SearchInput` |

**API endpoints:**

- `/api/org-documents/${doc._id}/file`
#### `client/src/pages/management/DocumentsPage.test.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `—` |
| **Lines** | 82 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/marketing/FeaturesPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /features |
| **Default export** | `FeaturesPage` |
| **Lines** | 120 |
| **Hooks** | `useMemo` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/NotFoundPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | * (in MainLayout) |
| **Default export** | `function` |
| **Lines** | 22 |
| **Hooks** | `useNavigate` |
| **Key components** | `EmptyState` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/org/create/OrgCreateProgress.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 44 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/org/create/OrgLogoPicker.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 79 |
| **Hooks** | `useRef` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/org/create/steps/StepIdentity.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 75 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/org/create/steps/StepInvites.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 87 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/org/create/steps/StepProfile.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 87 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/org/create/steps/StepReview.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 73 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/org/CreateOrganizationPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /org/create |
| **Default export** | `function` |
| **Lines** | 153 |
| **Hooks** | `useNavigate`, `useState` |

**API endpoints:**

- `/api/tenants/create`
#### `client/src/pages/org/OrgCreateSuccessPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /org/create/success |
| **Default export** | `function` |
| **Lines** | 53 |
| **Hooks** | `useCallback`, `useEffect`, `useLocation`, `useNavigate`, `useRef` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `client/src/pages/org/OrgPickerPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /org/pick |
| **Default export** | `function` |
| **Lines** | 82 |
| **Hooks** | `useEffect`, `useMutation`, `useNavigate`, `useQuery`, `useQueryClient`, `useState` |

**API endpoints:**

- `/api/tenants/memberships`
- `/api/tenants/select`
#### `client/src/pages/org/TenantInviteAcceptPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /invites/:token/accept |
| **Default export** | `function` |
| **Lines** | 63 |
| **Hooks** | `useAuth`, `useEffect`, `useNavigate`, `useParams`, `useState` |

**API endpoints:**

- `/api/invites/${token}`
- `/api/invites/${token}/accept`

---

## 4. Hub layouts & tabs

### CRM Hub (`/crm`)

| Tab | Component | Permission |
| --- | --- | --- |
| `leads` | `LeadsPage` | `leads` |
| `followups` | `FollowupsPage` | `followups` |
| `bookings` | `ExlyBookingsPage` | `bookings` |

File: `client/src/pages/hubs/CrmHub.jsx` — URL query `?tab=` drives active panel.

### Office Hub (`/office`)

| Tab | Component | Permission |
| --- | --- | --- |
| `equipment` | `EquipmentPage` | `equipment` |
| `contacts` | `ContactsPage` | `contacts` |
| `subscriptions` | `SubscriptionsPage` | `subscriptions` |

### Management Hub (`/management`)

| Tab | Component | Permission |
| --- | --- | --- |
| `finance` | `FinancePage` | `finance` |
| `announcements` | `AnnouncementsPage` | `announcements` |
| `documents` | Org documents panel | `org_documents` |
| `artists` | `ArtistsCollection` | `artists` |

### Admin Console (`/admin/console`)

Aggregates admin tools behind `admin_*` permissions — users, teams, roles, developers, scripts, gamification, project analytics, exly, artist path, ops hub.

Standalone admin routes (same permission model):

| Route | Page | API prefix |
| --- | --- | --- |
| `/admin/knowledge-engine` | `KnowledgeEnginePage` | `/api/knowledge-engine` |
| `/admin/security-audit` | `SecurityAuditPage` | `/api/admin/security-audit` |
| `/admin/tenant-sso` | `AdminTenantSsoPage` | `/api/admin/tenants` |

### Email Hub (`/emails/*`)

Layout: `EmailHubLayout.jsx`. Sub-routes: overview, campaigns, templates, profiles, **streams**, analytics, newsletter (curate/send). Streams power Resend from-address pickers and public unsubscribe (`/unsubscribe?stream=`).

### Settings (`/settings`)

Tabs in `settings/tabs/`: Profile, Notifications, Progress, Leave, Keyboard shortcuts, Dashboard customization.

### Artist detail (`/artists/:id/*`)

`ArtistDetail.jsx` + `ArtistOSLayout` tabs: Overview, Analytics, Calendar, Inquiries, Gigs, Finance, Contracts, Content, Team, etc. (`pages/artists/os/*`).

### Artist workspace (`/artist-workspace/:id/*`)

Membership-gated shell: `ArtistWorkspaceShell` → `ArtistWorkspaceDetail` with releases/team sub-tabs.


---

## 5. Backend API surface

Express mounts route modules from `server/routes/` (see `server/server.js` for prefix map). Primary domains:

| Domain | Route file | Typical prefix |
| --- | --- | --- |
| Auth | `authRoutes.js`, `authConnectRoutes.js` | `/api/auth` |
| Tenants / invites | `tenantRoutes.js`, `inviteRoutes.js` | `/api/tenants`, `/api/invites` |
| Users / teams | `userRoutes.js`, `teamRoutes.js` | `/api/users`, `/api/teams` |
| Projects / tasks | `projectRoutes.js`, `taskRoutes.js` | `/api/projects`, `/api/tasks` |
| CRM | `crmRoutes.js`, `crmStatsRoutes.js` | `/api/crm` |
| Data Hub | `dataHubRoutes.js` | `/api/data-hub` |
| Mail / campaigns | `mailRoutes.js`, `campaignRoutes.js`, `domains/mail/routes/streamsRouter.js` | `/api/mail`, `/api/campaigns`, `/api/mail/streams` |
| Integrations | `domains/integrations/integrationsRoutes.js` | `/api/integrations` |
| Knowledge Engine | `knowledgeEngineRoutes.js` | `/api/knowledge-engine` |
| Tenant SSO (admin) | `tenantAdminRoutes.js` | `/api/admin/tenants` |
| Security audit (admin) | `securityAuditRoutes.js` | `/api/admin/security-audit` |
| Finance | `financeRoutes.js` | `/api/finance` |
| Artists | `artistRoutes.js`, `artistV2Routes.js`, `artistPathRoutes.js` | `/api/artists` |
| Attendance / logs | `attendanceRoutes.js`, `logRoutes.js` | `/api/attendance`, `/api/logs` |
| Admin | `adminScriptsRoutes.js`, `platformSettingsRoutes.js`, `qaRoutes.js` | `/api/admin/*` (scripts/QA/security-audit = **platform admin only**) |
| Webhooks | `webhookRoutes.js` | `/api/webhooks/*` |
| Health / public | `publicRoutes.js`, `openApiRoutes.js` | `/api/health`, public |

**All route modules:**

- `server/routes/adminConsoleRoutes.js`
- `server/routes/adminRolesRoutes.js`
- `server/routes/adminScriptsRoutes.js`
- `server/routes/analyticsRoutes.js`
- `server/routes/announcementRoutes.js`
- `server/routes/artistPathRoutes.handlers.js`
- `server/routes/artistPathRoutes.js`
- `server/routes/artistRoutes.js`
- `server/routes/artistV2Routes.js`
- `server/routes/assetRoutes.js`
- `server/routes/attendanceRoutes.js`
- `server/routes/authConnectRoutes.js`
- `server/routes/authRoutes.js`
- `server/routes/calendarRoutes.js`
- `server/routes/campaignRoutes.js`
- `server/routes/contactRoutes.js`
- `server/routes/crmRoutes.js`
- `server/routes/crmStatsRoutes.js`
- `server/routes/customizationRoutes.js`
- `server/routes/dashboardRoutes.js`
- `server/routes/dataHubRoutes.js`
- `server/routes/departmentRoutes.js`
- `server/routes/enterpriseRoutes.js`
- `server/routes/exlyRoutes.js`
- `server/routes/financeRoutes.js`
- `server/routes/gamificationAdminRoutes.js`
- `server/routes/gamificationRoutes.js`
- `server/routes/googleAccounts.js`
- `server/routes/googleRoutes.js`
- `server/routes/integrationsRoutes.js`
- `server/routes/inviteRoutes.js`
- `server/routes/knowledgeEngineRoutes.js`
- `server/routes/logRoutes.js`
- `server/routes/mailRoutes.js`
- `server/routes/masterclassReviewAdminRoutes.js`
- `server/routes/mediaContactRoutes.js`
- `server/routes/newsletterRoutes.js`
- `server/routes/noteRoutes.js`
- `server/routes/notificationRoutes.js`
- `server/routes/officeAssetRoutes.js`
- `server/routes/openApiRoutes.js`
- `server/routes/opsHubRoutes.js`
- `server/routes/orgAccountRoutes.js`
- `server/routes/orgDocumentRoutes.js`
- `server/routes/pinBoardRoutes.js`
- `server/routes/platformSettingsRoutes.js`
- `server/routes/platformSupportRoutes.js`
- `server/routes/projectRoutes.js`
- `server/routes/proxyRoutes.js`
- `server/routes/publicApiRoutes.js`
- `server/routes/publicRoutes.js`
- `server/routes/qaRoutes.js`
- `server/routes/queueAdminRoutes.js`
- `server/routes/scheduleRoutes.js`
- `server/routes/scimRoutes.js`
- `server/routes/searchRoutes.js`
- `server/routes/securityAuditRoutes.js`
- `server/routes/sesRoutes.js`
- `server/routes/subscriptionRoutes.js`
- `server/routes/supabaseAdminRoutes.js`
- `server/routes/syncRoutes.js`
- `server/routes/systemHealthAdminRoutes.js`
- `server/routes/taskRoutes.js`
- `server/routes/teamRoutes.js`
- `server/routes/tenantAdminRoutes.js`
- `server/routes/tenantRoutes.js`
- `server/routes/track.js`
- `server/routes/tscRoutes.js`
- `server/routes/userRoutes.js`
- `server/routes/webhookRoutes.js`

Full endpoint listing: `.specify/memory/backend/express.md` and `.specify/memory/MASTER.md` §12.

---

## 6. Business rules (cross-cutting)

| Area | Rule | Source |
| --- | --- | --- |
| Multi-org | `Tenant` + `TenantMembership` + `TenantInvite`; JWT `activeTenantId`; org picker when 2+ memberships | `server/services/tenantMembershipService.js`, `server/middleware/authMiddleware.js` |
| Tenant isolation | `tenantPlugin` on models; `req.tenantId` from session; cross-tenant spoof rejected | `server/plugins/tenantPlugin.js`, `server/middleware/rejectClientTenantSpoof.js` |
| Feature unlocks | Progressive nav/features per tenant (`featureUnlocks` + onboarding checklist) | `server/services/tenantUnlockService.js`, `client/src/utils/navPageAccess.js` |
| Task review | Creator cannot approve own task; assignee submits for review; done-task rollback window 24h unless admin/platform owner | `shared/taskReviewRules.js` |
| Project analytics | Hours summary uses unified `aggregateProjectEffort`; `budgetSource` tracked vs calculated on `Project` | `server/domains/projects/services/projectAnalyticsService.js`, `shared/projectAnalyticsCore.cjs` |
| Finance FX | `conversionRate` snapshot on `FinanceDocument` write for rollup | `shared/projectFinanceRollup.js` |
| Daily logs | Optional `clientRequestId` idempotency per tenant | `server/models/Log.js`, `server/routes/logRoutes.js` |
| Attendance | Office/WFH check-in; 1h lunch; worked vs daily-log reconciliation | `shared/attendanceMetrics.js` |
| Dates (UI) | User format via `DateFormatContext` + `shared/dateFormatPreference.js`; default DD/MM/YYYY; ISO in `<input type="date">` | `client/src/utils/dateDisplay.js`, `client/src/contexts/DateFormatContext.jsx` |
| Email streams | Branded from-address + unsubscribe slug per stream; catalog in `shared/emailStreams.cjs` | `shared/emailStreams.cjs`, `server/services/emailStreamService.js` |
| CRM locks | Lead lock/audit on sensitive edits | server CRM controllers |
| Email tracking | Locked engine — do not change pixel/redirect behavior | `docs/reference/EMAIL_ENGINE_LOCKED.md` |
| Gamification | XP on task completion; weekly leaderboard IST Monday reset; idempotent recalc via audit trail | `shared/gamificationRules.js`, `server/services/gamificationService.js` |
| Credentials | OAuth/Resend tokens encrypted at rest when `CREDENTIAL_ENCRYPTION_KEY` set | `server/utils/credentialEncryption.js` |

---

## 7. Locked zones

| Asset | Doc |
| --- | --- |
| Email open/click tracking | [`EMAIL_ENGINE_LOCKED.md`](../reference/EMAIL_ENGINE_LOCKED.md) |
| Logo + default spinner | [`LOGO_LOCKED.md`](../reference/LOGO_LOCKED.md) |
| Production hosts | `.cursor/production-hosts.local.json` (gitignored) |
| Legacy APIs | [`LEGACY_FREEZE.md`](../architecture/LEGACY_FREEZE.md) |

---

## 8. Documentation map

| Path | Purpose |
| --- | --- |
| [`DOCUMENTATION_INDEX.md`](../DOCUMENTATION_INDEX.md) | Human navigation hub |
| [`.specify/memory/INDEX.md`](../.specify/memory/INDEX.md) | Agent memory hub |
| [`reference/COREKNOT_MASTER.md`](./COREKNOT_MASTER.md) | **This file** — page-level truth |
| [`operations/`](../operations/) | Deploy, startup, scripts, environments, [`PUBLIC_LAUNCH_BETA.md`](../operations/PUBLIC_LAUNCH_BETA.md) |
| [`architecture/`](../architecture/) | System design, data, security, debt |
| [`features/`](../features/) | Domain deep-dives (Artist OS, Data Hub, integrations) |
| [`auth/`](../auth/) | OAuth, Clerk, subdomain setup |
| [`design/`](../design/) | UI reference (`DESIGN-REFERENCE.md`, component standards) |
| [`reference/COMPONENT_STANDARDS.md`](./COMPONENT_STANDARDS.md) | Client component patterns |

