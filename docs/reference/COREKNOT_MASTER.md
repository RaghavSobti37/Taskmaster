# CoreKnot — Master Reference

> **Canonical product bible.** Every routed page, APIs, hooks, exports, and access rules.  
> **Product:** CoreKnot · **Repo:** `coreknot/Taskmaster` · **Version:** 1.0.7 · **Compiled:** 2026-07-14

---

## How to use this document

| Audience | Start here |
| --- | --- |
| **New engineer** | [Platform overview](#1-platform-overview) → your domain in [Page catalog](#3-page-catalog-by-domain) |
| **AI agent** | Full file + [`memory/obsidian/INDEX.md`](../../../../memory/obsidian/INDEX.md) (canonical) + [`.specify/memory/INDEX.md`](../.specify/memory/INDEX.md) (compat) |
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

### Naming convention (Org vs Tenant)

- **Organization/Org** is the public UX term (routes, components, labels).
- **Tenant** is internal persistence + API namespace terminology.
- Org-facing UX intentionally talks to `/api/tenants/*`.
- Platform-admin tenant controls are separate under `/api/admin/tenants/*`.

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

Full merged routing table (path + page key + tab + redirect + feature lock): [`docs/.generated/route-access-matrix.json`](../.generated/route-access-matrix.json)

Preset matrix source of truth: [`docs/.generated/preset-page-matrix.json`](../.generated/preset-page-matrix.json)

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

**Feature unlocks** default to disabled on new organizations and are enabled per organization on request. Canonical matrix: [`docs/.generated/feature-unlock-matrix.json`](../.generated/feature-unlock-matrix.json). Client lock resolution: `navPageAccess.getNavFeatureLock()` + locked `EmptyState` props.

**Credentials at rest:** `server/utils/credentialEncryption.js` (AES-256-GCM when `CREDENTIAL_ENCRYPTION_KEY` set).

**Launch ops:** [`operations/PUBLIC_LAUNCH_BETA.md`](../operations/PUBLIC_LAUNCH_BETA.md) — staging gate, migration, invite-only beta.

---

## 3. Page catalog by domain

_Total page files: 140. Each entry lists route, exports, hooks, components, and explicit API paths._


### Authentication & legal

#### `Taskmaster/client/src/pages/auth/ForgotPasswordPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /forgot-password |
| **Default export** | `function` |
| **Lines** | 11 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/auth/GoogleSuccessPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /auth/google/success |
| **Default export** | `GoogleSuccessPage` |
| **Lines** | 24 |
| **Hooks** | `useEffect`, `useLocation`, `useNavigate` |
| **Key components** | `BootScreen` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/auth/LoginPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /login/* |
| **Default export** | `function` |
| **Lines** | 165 |
| **Hooks** | `useAuth`, `useClerkAuth`, `useEffect`, `useLocation`, `useMemo`, `useNavigate`, `useRef`, `useState` |
| **Data hooks** | `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members · `useClerkAuth` → /api/auth/access-request, /api/auth/clerk-establish, /api/tenants/memberships |
| **Key components** | `AppBootError`, `AuthMarketingShell`, `BootScreen`, `ClearSessionCookiesButton`, `ClerkSignInBlock`, `InstallGuideModal` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/auth/MetaOAuthCallback.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /oauth/meta/callback |
| **Default export** | `function` |
| **Lines** | 129 |
| **Hooks** | `useEffect`, `useLocation`, `useNavigate`, `useRef`, `useState` |

**API endpoints:**

- `/api/artists/${state}/auth/meta/callback`
#### `Taskmaster/client/src/pages/auth/OrgChoosePage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /login/choose |
| **Default export** | `function` |
| **Lines** | 142 |
| **Hooks** | `useAuth`, `useCallback`, `useClerk`, `useClerkAuth`, `useEffect`, `useNavigate`, `useQueryClient`, `useRef`, `useState` |
| **Data hooks** | `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members · `useClerk` → /api/auth/clerk-establish, /api/tenants/memberships, /api/tenants/select · `useClerkAuth` → /api/auth/access-request, /api/auth/clerk-establish, /api/tenants/memberships |
| **Key components** | `AuthMarketingShell`, `BootScreen` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/auth/RegisterPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /register/* |
| **Default export** | `function` |
| **Lines** | 187 |
| **Hooks** | `useAuth`, `useClerkAuth`, `useEffect`, `useLocation`, `useNavigate`, `useRef`, `useState` |
| **Data hooks** | `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members · `useClerkAuth` → /api/auth/access-request, /api/auth/clerk-establish, /api/tenants/memberships |
| **Key components** | `AppBootError`, `AuthMarketingShell`, `BootScreen`, `ClearSessionCookiesButton` |

**API endpoints:**

- `/api/auth/access-request`
#### `Taskmaster/client/src/pages/auth/ResetPasswordPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /reset-password |
| **Default export** | `function` |
| **Lines** | 11 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/LandingPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /, /landing |
| **Default export** | `function` |
| **Lines** | 377 |
| **Hooks** | `useAuth` |
| **Data hooks** | `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members |
| **Key components** | `BootScreen`, `BrandLogo`, `LandingDashboardPreview`, `WithClerkWhenConfigured` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/legal/PrivacyPolicy.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /privacy |
| **Default export** | `function` |
| **Lines** | 165 |
| **Key components** | `BrandLogo`, `MarketingPageBackground`, `MarketingThemeToggle` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/legal/TermsOfService.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 24 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/legal/UserDataDeletion.jsx`

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
#### `Taskmaster/client/src/pages/Unsubscribe.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /unsubscribe |
| **Default export** | `function` |
| **Lines** | 179 |
| **Hooks** | `useMemo`, `usePublicEmailStreams`, `useSearchParams`, `useState` |
| **Data hooks** | `usePublicEmailStreams` → /api/campaigns, /api/campaigns/${id}, /api/campaigns/${id}/analytics · `useSearchParams` → /api/auth/google?state=link_${user?._id}, /api/crm/leads/${highlightId}, /api/crm/leads/${id} |

**API endpoints:**

- `/api/track/unsubscribe`

### Dashboard & productivity

#### `Taskmaster/client/src/pages/artists/PortfolioDashboard.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /artists/portfolio |
| **Default export** | `function` |
| **Lines** | 206 |
| **Hooks** | `useNavigate`, `usePortfolioSummary` |
| **Data hooks** | `usePortfolioSummary` → /api/artists, /api/artists/${artistId}/connections/${connectionId}/primary, /api/artists/${artistId}/connections/${platform}/manual |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/calendar/CalendarView.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /calendar |
| **Default export** | `CalendarView` |
| **Lines** | 505 |
| **Hooks** | `useAuth`, `useCalendarEvents`, `useCallback`, `useDeferredQueryEnabled`, `useEffect`, `useMemo`, `useState`, `useStatusCounts`, `useToast` |
| **Data hooks** | `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members · `useCalendarEvents` → /api/calendar, /api/calendar/${id}, /api/calendar/seed-music-content · `useDeferredQueryEnabled` → /api/admin/media-contacts, /api/admin/media-contacts/filters, /api/admin/platform-settings · `useStatusCounts` → /api/calendar/seed-music-content, /api/notifications/status-counts · `useToast` → /api/admin/platform-settings, /api/admin/tenants, /api/admin/tenants/${tenant._id} |
| **Key components** | `CalendarEntryModal` |

**API endpoints:**

- `/api/calendar/seed-music-content`
#### `Taskmaster/client/src/pages/Dashboard.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /dashboard |
| **Default export** | `Dashboard` |
| **Lines** | 361 |
| **Hooks** | `useAttendance`, `useAttendanceCheck`, `useAuth`, `useDashboardPreset`, `useDashboardSummary`, `useDashboardTaskActions`, `useDashboardTasks`, `useEffect`, `useLocation`, `useMemo`, `useNavigate`, `useProjects`, `useReviewTasks`, `useState`, `useUndoAttendanceCheck`, `useUserDirectory`, `useWorkspaces` |
| **Data hooks** | `useAttendance` → /api/attendance, /api/attendance/${id}/approve, /api/attendance/check · `useAttendanceCheck` → /api/attendance, /api/attendance/${id}/approve, /api/attendance/check · `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members · `useDashboardPreset` → /api/customization/dashboard/preset, /api/dashboard/attendance-overview?timeframe=${timeframe}, /api/dashboard/dept-stats?timeframe=${timeframe} · `useDashboardSummary` → /api/customization/dashboard/preset, /api/dashboard/attendance-overview?timeframe=${timeframe}, /api/dashboard/dept-stats?timeframe=${timeframe} · `useDashboardTaskActions` → /api/tasks/${taskId} · `useDashboardTasks` → /api/projects, /api/projects/${id}, /api/projects/workspaces · `useProjects` → /api/auth/google?state=link_${user?._id}, /api/calendar, /api/calendar/${initialData._id} · `useReviewTasks` → /api/projects, /api/projects/${id}, /api/projects/${id}/remove-member · `useUndoAttendanceCheck` → /api/attendance, /api/attendance/${id}/approve, /api/attendance/check · `useUserDirectory` → /api/admin/platform-settings, /api/assets, /api/contacts · `useWorkspaces` → /api/auth/google?state=link_${user?._id}, /api/finance/${id}, /api/finance/${id}/approve |
| **Key components** | `BrandedLoadingPanel`, `DashboardTierLayout`, `OrgOnboardingChecklist` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/inbox/InboxPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /inbox |
| **Default export** | `InboxPage` |
| **Lines** | 316 |
| **Hooks** | `useAuth`, `useCallback`, `useClearAllNotifications`, `useConfirm`, `useDebounce`, `useDeferredQueryEnabled`, `useEffect`, `useMarkAllNotificationsRead`, `useMarkNotificationRead`, `useMemo`, `useNavigate`, `useNotifications`, `useState`, `useStatusCounts` |
| **Data hooks** | `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members · `useClearAllNotifications` → /api/notifications, /api/notifications/${id}/read, /api/notifications/read-all · `useConfirm` → /api/contacts, /api/contacts/${editingContact._id}, /api/contacts/${id} · `useDebounce` → /api/crm/leads/${highlightId}, /api/crm/leads/${id}, /api/crm/leads/${leadId}/audit · `useDeferredQueryEnabled` → /api/admin/media-contacts, /api/admin/media-contacts/filters, /api/admin/platform-settings · `useMarkAllNotificationsRead` → /api/notifications, /api/notifications/${id}/read, /api/notifications/read-all · `useMarkNotificationRead` → /api/notifications, /api/notifications/${id}/read, /api/notifications/read-all · `useNotifications` → /api/notifications, /api/notifications/${id}/read, /api/notifications/read-all · `useStatusCounts` → /api/calendar/seed-music-content, /api/notifications/status-counts |
| **Key components** | `CountBadge`, `DataListRow`, `EmptyState`, `ListPageLayout`, `PageLoadGuard`, `PageSkeleton`, `RelativeTimestamp` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/notes/NoteEditorPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /notes/:id |
| **Default export** | `function` |
| **Lines** | 300 |
| **Hooks** | `useAuth`, `useCallback`, `useDeleteNote`, `useEffect`, `useIsMobile`, `useMemo`, `useNavigate`, `useNote`, `useParams`, `useRef`, `useState`, `useToast`, `useUnsavedChanges`, `useUpdateNote` |
| **Data hooks** | `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members · `useDeleteNote` → /api/notes, /api/notes/${id}, /api/pinboard · `useIsMobile` → /api/customization/dashboard/preset · `useNote` → /api/notes, /api/notes/${id}, /api/pinboard · `useToast` → /api/admin/platform-settings, /api/admin/tenants, /api/admin/tenants/${tenant._id} · `useUnsavedChanges` → /api/admin/platform-settings, /api/auth/change-required-password, /api/auth/google?state=link_${user?._id} · `useUpdateNote` → /api/notes, /api/notes/${id}, /api/pinboard |
| **Key components** | `NoteRichEditor`, `SaveNoteDialog` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/notes/NotesPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /notes, /notes/new |
| **Default export** | `function` |
| **Lines** | 236 |
| **Hooks** | `useAuth`, `useCallback`, `useDebounce`, `useMemo`, `useNavigate`, `useState`, `useUserNotes` |
| **Data hooks** | `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members · `useDebounce` → /api/crm/leads/${highlightId}, /api/crm/leads/${id}, /api/crm/leads/${leadId}/audit · `useUserNotes` → /api/notes, /api/notes/${id}, /api/pinboard |
| **Key components** | `NoteComposer`, `RelativeTimestamp` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/productivity/DailyLogPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /logs |
| **Default export** | `DailyLogPage` |
| **Lines** | 688 |
| **Hooks** | `useActivityGrid`, `useAttendance`, `useAuth`, `useCallback`, `useConfirm`, `useDeferredQueryEnabled`, `useDeleteLog`, `useEffect`, `useLogs`, `useMemo`, `useNavigate`, `useProjects`, `useSearchParams`, `useState`, `useSystemToast`, `useTasks`, `useUpdateLog`, `useUserDirectory`, `useWorkspaces` |
| **Data hooks** | `useActivityGrid` → /api/logs, /api/logs/${id}, /api/logs/activity-grid · `useAttendance` → /api/attendance, /api/attendance/${id}/approve, /api/attendance/check · `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members · `useConfirm` → /api/contacts, /api/contacts/${editingContact._id}, /api/contacts/${id} · `useDeferredQueryEnabled` → /api/admin/media-contacts, /api/admin/media-contacts/filters, /api/admin/platform-settings · `useDeleteLog` → /api/logs, /api/logs/${id}, /api/logs/activity-grid · `useLogs` → /api/logs, /api/logs/${id}, /api/logs/activity-grid · `useProjects` → /api/auth/google?state=link_${user?._id}, /api/calendar, /api/calendar/${initialData._id} · `useSearchParams` → /api/auth/google?state=link_${user?._id}, /api/crm/leads/${highlightId}, /api/crm/leads/${id} · `useSystemToast` → /api/calendar, /api/calendar/${initialData._id}, /api/crm/leads/cleanup-test-data · `useTasks` → /api/tasks, /api/tasks/${id}, /api/tasks/${taskId} · `useUpdateLog` → /api/logs, /api/logs/${id}, /api/logs/activity-grid · `useUserDirectory` → /api/admin/platform-settings, /api/assets, /api/contacts · `useWorkspaces` → /api/auth/google?state=link_${user?._id}, /api/finance/${id}, /api/finance/${id}/approve |
| **Key components** | `DailyLogActivityCalendar`, `DailyLogEntryModal`, `DailyLogTimeline`, `DataOverviewSection` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/productivity/WorkflowCanvas.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /workflows |
| **Default export** | `WorkflowCanvas` |
| **Lines** | 146 |
| **Hooks** | `useCallback`, `useEdgesState`, `useNodesState`, `useState`, `useUnsavedChanges` |
| **Data hooks** | `useUnsavedChanges` → /api/admin/platform-settings, /api/auth/change-required-password, /api/auth/google?state=link_${user?._id} |
| **Key components** | `QueryErrorBanner` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/schedule/SchedulePage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /schedule |
| **Default export** | `SchedulePage` |
| **Lines** | 199 |
| **Named exports** | `MAX_SCHEDULE_DAYS` |
| **Hooks** | `useAuth`, `useDashboardTaskActions`, `useDeferredQueryEnabled`, `useEffect`, `useMemo`, `useProjects`, `useQueryClient`, `useSchedule`, `useState`, `useStatusCounts`, `useUserDirectory`, `useWorkspaces` |
| **Data hooks** | `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members · `useDashboardTaskActions` → /api/tasks/${taskId} · `useDeferredQueryEnabled` → /api/admin/media-contacts, /api/admin/media-contacts/filters, /api/admin/platform-settings · `useProjects` → /api/auth/google?state=link_${user?._id}, /api/calendar, /api/calendar/${initialData._id} · `useSchedule` → /api/projects/${id}, /api/projects/${id}/remove-member, /api/projects/${projectId}/hours-summary · `useStatusCounts` → /api/calendar/seed-music-content, /api/notifications/status-counts · `useUserDirectory` → /api/admin/platform-settings, /api/assets, /api/contacts · `useWorkspaces` → /api/auth/google?state=link_${user?._id}, /api/finance/${id}, /api/finance/${id}/approve |
| **Key components** | `EmptyState`, `ListPageLayout`, `ScheduleDayViewControl`, `ScheduleGrid`, `ScheduleMobileList`, `ScheduleSkeleton` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/settings/tabs/DashboardCustomizationTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 976 |
| **Hooks** | `useAuth`, `useDashboardPreset`, `useEffect`, `useIsMobile`, `useMemo`, `useNavigate`, `useQueryClient`, `useRef`, `useState`, `useUnsavedChanges` |
| **Data hooks** | `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members · `useDashboardPreset` → /api/customization/dashboard/preset, /api/dashboard/attendance-overview?timeframe=${timeframe}, /api/dashboard/dept-stats?timeframe=${timeframe} · `useIsMobile` → /api/customization/dashboard/preset · `useUnsavedChanges` → /api/admin/platform-settings, /api/auth/change-required-password, /api/auth/google?state=link_${user?._id} |

**API endpoints:**

- `/api/customization/dashboard/preset`
#### `Taskmaster/client/src/pages/todo/TodoPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /todo |
| **Default export** | `TodoPage` |
| **Lines** | 768 |
| **Hooks** | `useAuth`, `useCallback`, `useDebounce`, `useDeferredQueryEnabled`, `useEffect`, `useMemo`, `useProjects`, `useQueryClient`, `useState`, `useSystemToast`, `useTaskCategoryOptions`, `useTodoTasks`, `useUserDirectory`, `useWorkspaces` |
| **Data hooks** | `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members · `useDebounce` → /api/crm/leads/${highlightId}, /api/crm/leads/${id}, /api/crm/leads/${leadId}/audit · `useDeferredQueryEnabled` → /api/admin/media-contacts, /api/admin/media-contacts/filters, /api/admin/platform-settings · `useProjects` → /api/auth/google?state=link_${user?._id}, /api/calendar, /api/calendar/${initialData._id} · `useSystemToast` → /api/calendar, /api/calendar/${initialData._id}, /api/crm/leads/cleanup-test-data · `useTaskCategoryOptions` → /api/departments/task-types, /api/tasks/${task?._id} · `useTodoTasks` → /api/tasks, /api/tasks/${id}, /api/tasks/${task?._id} · `useUserDirectory` → /api/admin/platform-settings, /api/assets, /api/contacts · `useWorkspaces` → /api/auth/google?state=link_${user?._id}, /api/finance/${id}, /api/finance/${id}/approve |
| **Key components** | `CompletedTaskRollbackButton`, `FlashHighlightListener`, `ListCard`, `ListPageLayout`, `MentionTitle`, `PageLoadGuard`, `PageSkeleton`, `SearchInput`, `TaskMentionBadge`, `VirtualTaskList` |

**API endpoints:**

- `/api/tasks/${task?._id}`

### Projects & workspaces

#### `Taskmaster/client/src/pages/projects/ProjectAnalyticsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /projects/:id/analytics |
| **Default export** | `ProjectAnalyticsPage` |
| **Lines** | 55 |
| **Hooks** | `useNavigate`, `useParams`, `useProject`, `useProjectReportRangeState` |
| **Data hooks** | `useProject` → /api/projects, /api/projects/${id}, /api/projects/${id}/remove-member |
| **Key components** | `ProjectAnalyticsContent`, `ProjectReportRangeControls` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/projects/ProjectCreate.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /projects/new |
| **Default export** | `ProjectCreate` |
| **Lines** | 281 |
| **Hooks** | `useCallback`, `useEffect`, `useNavigate`, `useQueryClient`, `useRef`, `useSearchParams`, `useState`, `useToast` |
| **Data hooks** | `useSearchParams` → /api/auth/google?state=link_${user?._id}, /api/crm/leads/${highlightId}, /api/crm/leads/${id} · `useToast` → /api/admin/platform-settings, /api/admin/tenants, /api/admin/tenants/${tenant._id} |
| **Key components** | `NexusDropdown`, `RoleOptionBoxes`, `WorkspaceSelect` |

**API endpoints:**

- `/api/projects`
- `/api/projects/workspaces/${encodeURIComponent(workspace)}`
- `/api/users/team`
#### `Taskmaster/client/src/pages/projects/ProjectDetail.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /projects/:id |
| **Default export** | `ProjectDetail` |
| **Lines** | 584 |
| **Hooks** | `useAuth`, `useCallback`, `useDeferredQueryEnabled`, `useDeleteTask`, `useEffect`, `useLocation`, `useMemo`, `useNavigate`, `useParams`, `useProject`, `useProjectHoursSummary`, `useProjectTasks`, `useQueryClient`, `useReviewTasks`, `useSchedule`, `useState`, `useSystemToast`, `useUpdateTask`, `useUserDirectory`, `useWorkspaces` |
| **Data hooks** | `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members · `useDeferredQueryEnabled` → /api/admin/media-contacts, /api/admin/media-contacts/filters, /api/admin/platform-settings · `useDeleteTask` → /api/projects/${id}, /api/projects/${id}/remove-member, /api/tasks · `useProject` → /api/projects, /api/projects/${id}, /api/projects/${id}/remove-member · `useProjectHoursSummary` → /api/projects/${id}, /api/projects/${id}/remove-member, /api/projects/${projectId}/hours-summary · `useProjectTasks` → /api/projects/${id}, /api/projects/${id}/remove-member, /api/tasks · `useReviewTasks` → /api/projects, /api/projects/${id}, /api/projects/${id}/remove-member · `useSchedule` → /api/projects/${id}, /api/projects/${id}/remove-member, /api/projects/${projectId}/hours-summary · `useSystemToast` → /api/calendar, /api/calendar/${initialData._id}, /api/crm/leads/cleanup-test-data · `useUpdateTask` → /api/projects/${id}, /api/projects/${id}/remove-member, /api/tasks · `useUserDirectory` → /api/admin/platform-settings, /api/assets, /api/contacts · `useWorkspaces` → /api/auth/google?state=link_${user?._id}, /api/finance/${id}, /api/finance/${id}/approve |
| **Key components** | `ProjectAssets`, `ProjectFinance`, `ProjectGoalsPanel`, `ProjectGoalsStrip`, `ProjectKanban`, `ProjectList`, `ProjectSettingsModal`, `ProjectTeam`, `ScheduleGrid`, `ScheduleSkeleton`, `TaskCompletionModal`, `TaskCreateModal`, `TaskDetailModal` |

**API endpoints:**

- `/api/projects/${id}`
- `/api/projects/${id}/remove-member`
- `/api/tasks/${taskId}`
#### `Taskmaster/client/src/pages/projects/ProjectsView.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /projects |
| **Default export** | `ProjectsView` |
| **Lines** | 1406 |
| **Hooks** | `useAuth`, `useCallback`, `useConfirm`, `useDashboardTasks`, `useDeferredQueryEnabled`, `useEffect`, `useLocation`, `useMemo`, `useNavigate`, `useProjects`, `useQueryClient`, `useRef`, `useReviewTasks`, `useState`, `useToast`, `useUpdateProject`, `useWorkspaces` |
| **Data hooks** | `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members · `useConfirm` → /api/contacts, /api/contacts/${editingContact._id}, /api/contacts/${id} · `useDashboardTasks` → /api/projects, /api/projects/${id}, /api/projects/workspaces · `useDeferredQueryEnabled` → /api/admin/media-contacts, /api/admin/media-contacts/filters, /api/admin/platform-settings · `useProjects` → /api/auth/google?state=link_${user?._id}, /api/calendar, /api/calendar/${initialData._id} · `useReviewTasks` → /api/projects, /api/projects/${id}, /api/projects/${id}/remove-member · `useToast` → /api/admin/platform-settings, /api/admin/tenants, /api/admin/tenants/${tenant._id} · `useUpdateProject` → /api/projects, /api/projects/${id}, /api/projects/${projectId}/analytics · `useWorkspaces` → /api/auth/google?state=link_${user?._id}, /api/finance/${id}, /api/finance/${id}/approve |
| **Key components** | `WorkspaceColorPicker`, `WorkspaceSelect` |

**API endpoints:**

- `/api/projects`
- `/api/projects/${id}`
- `/api/projects/workspaces`
- `/api/projects/workspaces/${group.name}`
#### `Taskmaster/client/src/pages/projects/WorkspaceSettings.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /workspaces/:name |
| **Default export** | `WorkspaceSettings` |
| **Lines** | 469 |
| **Hooks** | `useAuth`, `useCallback`, `useEffect`, `useMemo`, `useNavigate`, `useParams`, `useQueryClient`, `useState`, `useUnsavedChanges` |
| **Data hooks** | `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members · `useUnsavedChanges` → /api/admin/platform-settings, /api/auth/change-required-password, /api/auth/google?state=link_${user?._id} |
| **Key components** | `NexusDropdown`, `QueryErrorSlot`, `RoleOptionBoxes`, `WorkspaceColorPicker`, `WorkspaceGoalsPanel` |

**API endpoints:**

- `/api/projects/workspaces/${encodeURIComponent(workspaceApiName)}`
- `/api/users/team`

### CRM & sales

#### `Taskmaster/client/src/pages/crm/ArtistBookingEnquiriesPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | (CRM sub) |
| **Default export** | `function` |
| **Lines** | 135 |
| **Hooks** | `useAuth`, `useDebounce`, `useLiveLeads`, `useMemo`, `useState` |
| **Data hooks** | `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members · `useDebounce` → /api/crm/leads/${highlightId}, /api/crm/leads/${id}, /api/crm/leads/${leadId}/audit · `useLiveLeads` → /api/crm/artist/import-sheets, /api/crm/config, /api/crm/imports |
| **Key components** | `ArtistBookingEnquiryPanel` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/crm/ExlyBookingsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | (tab: bookings) |
| **Default export** | `ExlyBookingsPage` |
| **Lines** | 18 |
| **Key components** | `ExlyDataContent` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/crm/FollowupsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | (tab: followups) |
| **Default export** | `function` |
| **Lines** | 814 |
| **Hooks** | `useAuth`, `useCRMConfig`, `useCallback`, `useConfirm`, `useDeferredQueryEnabled`, `useEffect`, `useLiveLeads`, `useMemo`, `useQueryClient`, `useSalesReps`, `useSearchParams`, `useState`, `useToast`, `useUpdateLead` |
| **Data hooks** | `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members · `useCRMConfig` → /api/crm/artist/import-sheets, /api/crm/config, /api/crm/imports · `useConfirm` → /api/contacts, /api/contacts/${editingContact._id}, /api/contacts/${id} · `useDeferredQueryEnabled` → /api/admin/media-contacts, /api/admin/media-contacts/filters, /api/admin/platform-settings · `useLiveLeads` → /api/crm/artist/import-sheets, /api/crm/config, /api/crm/imports · `useSalesReps` → /api/crm/artist/import-sheets, /api/crm/config, /api/crm/imports · `useSearchParams` → /api/auth/google?state=link_${user?._id}, /api/crm/leads/${highlightId}, /api/crm/leads/${id} · `useToast` → /api/admin/platform-settings, /api/admin/tenants, /api/admin/tenants/${tenant._id} · `useUpdateLead` → /api/crm/artist/import-sheets, /api/crm/config, /api/crm/imports |
| **Key components** | `ArtistBookingEnquiryPanel`, `LeadLockIndicator`, `PhoneNumberFields` |

**API endpoints:**

- `/api/crm/leads/${leadId}/audit`
- `/api/crm/leads/${selectedLead._id}/audit`
- `/api/crm/leads/${selectedLead._id}/notes`
#### `Taskmaster/client/src/pages/crm/LeadsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | (tab: leads) |
| **Default export** | `function` |
| **Lines** | 1349 |
| **Hooks** | `useArtistImportSheets`, `useArtistReps`, `useAuth`, `useCRMConfig`, `useCRMStats`, `useCallback`, `useConfirm`, `useCreateLead`, `useDebounce`, `useDeferredQueryEnabled`, `useEffect`, `useLeadDetail`, `useLiveLeads`, `useMemo`, `useQueryClient`, `useRef`, `useSalesReps`, `useSearchParams`, `useState`, `useToast`, `useUnsavedChanges`, `useUpdateLead` |
| **Data hooks** | `useArtistImportSheets` → /api/crm/artist/import-sheets, /api/crm/config, /api/crm/imports · `useArtistReps` → /api/crm/artist/import-sheets, /api/crm/config, /api/crm/imports · `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members · `useCRMConfig` → /api/crm/artist/import-sheets, /api/crm/config, /api/crm/imports · `useCRMStats` → /api/crm/artist/import-sheets, /api/crm/config, /api/crm/imports · `useConfirm` → /api/contacts, /api/contacts/${editingContact._id}, /api/contacts/${id} · `useCreateLead` → /api/crm/artist/import-sheets, /api/crm/config, /api/crm/imports · `useDebounce` → /api/crm/leads/${highlightId}, /api/crm/leads/${id}, /api/crm/leads/${leadId}/audit · `useDeferredQueryEnabled` → /api/admin/media-contacts, /api/admin/media-contacts/filters, /api/admin/platform-settings · `useLeadDetail` → /api/crm/artist/import-sheets, /api/crm/config, /api/crm/imports · `useLiveLeads` → /api/crm/artist/import-sheets, /api/crm/config, /api/crm/imports · `useSalesReps` → /api/crm/artist/import-sheets, /api/crm/config, /api/crm/imports · `useSearchParams` → /api/auth/google?state=link_${user?._id}, /api/crm/leads/${highlightId}, /api/crm/leads/${id} · `useToast` → /api/admin/platform-settings, /api/admin/tenants, /api/admin/tenants/${tenant._id} · `useUnsavedChanges` → /api/admin/platform-settings, /api/auth/change-required-password, /api/auth/google?state=link_${user?._id} · `useUpdateLead` → /api/crm/artist/import-sheets, /api/crm/config, /api/crm/imports |
| **Key components** | `ArtistBookingEnquiryPanel`, `ArtistCrmImportPanel`, `LeadArtistJourneySection`, `LeadLockIndicator`, `LeadRowActions`, `PhoneNumberFields` |

**API endpoints:**

- `/api/crm/leads/${highlightId}`
- `/api/crm/leads/${id}`
- `/api/crm/leads/${leadId}/audit`
- `/api/crm/leads/${selectedLead._id}`
- `/api/crm/leads/${selectedLead._id}/notes`
#### `Taskmaster/client/src/pages/hubs/CrmHub.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /crm?tab=leads|followups|bookings |
| **Default export** | `function` |
| **Lines** | 31 |
| **Hooks** | `useAuth` |
| **Data hooks** | `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._

### Office hub

#### `Taskmaster/client/src/pages/hubs/OfficeHub.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /office?tab=equipment|contacts|subscriptions |
| **Default export** | `function` |
| **Lines** | 19 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/management/ContactsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | (tab: contacts) |
| **Default export** | `ContactsPage` |
| **Lines** | 287 |
| **Hooks** | `useMemo`, `useMutation`, `useQuery`, `useQueryClient`, `useState`, `useUnsavedChanges` |
| **Data hooks** | `useUnsavedChanges` → /api/admin/platform-settings, /api/auth/change-required-password, /api/auth/google?state=link_${user?._id} |
| **Key components** | `ContactMobileRow`, `ListPageLayout`, `ListPageSkeleton`, `SearchInput` |

**API endpoints:**

- `/api/contacts`
- `/api/contacts/${editingContact._id}`
#### `Taskmaster/client/src/pages/management/EquipmentPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | (tab: equipment) |
| **Default export** | `EquipmentPage` |
| **Lines** | 358 |
| **Hooks** | `useDeferredQueryEnabled`, `useMemo`, `useMutation`, `useQuery`, `useQueryClient`, `useState`, `useUnsavedChanges`, `useUserDirectory` |
| **Data hooks** | `useDeferredQueryEnabled` → /api/admin/media-contacts, /api/admin/media-contacts/filters, /api/admin/platform-settings · `useUnsavedChanges` → /api/admin/platform-settings, /api/auth/change-required-password, /api/auth/google?state=link_${user?._id} · `useUserDirectory` → /api/admin/platform-settings, /api/assets, /api/contacts |
| **Key components** | `EquipmentMobileRow`, `ListPageLayout`, `ListPageSkeleton`, `SearchInput`, `StatusBadge` |

**API endpoints:**

- `/api/office-assets`
- `/api/office-assets/${editingAsset._id}`
#### `Taskmaster/client/src/pages/office/OfficeAssetsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /office-assets |
| **Default export** | `OfficeAssetsPage` |
| **Lines** | 665 |
| **Hooks** | `useCallback`, `useConfirm`, `useDeferredQueryEnabled`, `useEffect`, `useMemo`, `useMutation`, `useQuery`, `useQueryClient`, `useState`, `useUnsavedChanges`, `useUserDirectory` |
| **Data hooks** | `useConfirm` → /api/contacts, /api/contacts/${editingContact._id}, /api/contacts/${id} · `useDeferredQueryEnabled` → /api/admin/media-contacts, /api/admin/media-contacts/filters, /api/admin/platform-settings · `useUnsavedChanges` → /api/admin/platform-settings, /api/auth/change-required-password, /api/auth/google?state=link_${user?._id} · `useUserDirectory` → /api/admin/platform-settings, /api/assets, /api/contacts |
| **Key components** | `ContactMobileRow`, `EquipmentMobileRow` |

**API endpoints:**

- `/api/contacts`
- `/api/contacts/${editingContact._id}`
- `/api/contacts/${id}`
- `/api/office-assets`
- `/api/office-assets/${editingAsset._id}`
- `/api/office-assets/${id}`
#### `Taskmaster/client/src/pages/office/SubscriptionsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | (tab: subscriptions) |
| **Default export** | `SubscriptionsPage` |
| **Lines** | 536 |
| **Hooks** | `useConfirm`, `useEffect`, `useMemo`, `useMutation`, `useQuery`, `useQueryClient`, `useRef`, `useState`, `useUnsavedChanges`, `useUsdInrRate` |
| **Data hooks** | `useConfirm` → /api/contacts, /api/contacts/${editingContact._id}, /api/contacts/${id} · `useUnsavedChanges` → /api/admin/platform-settings, /api/auth/change-required-password, /api/auth/google?state=link_${user?._id} · `useUsdInrRate` → /api/exly/config, /api/exly/dashboard-stats, /api/exly/offerings |
| **Key components** | `MemberSelect`, `SubscriptionMobileRow`, `UsdInrAmountFields` |

**API endpoints:**

- `/api/subscriptions`
- `/api/subscriptions/${editing._id}`
- `/api/subscriptions/${id}`

### Management hub

#### `Taskmaster/client/src/pages/artists/ArtistsCollection.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | (tab: artists) |
| **Default export** | `function` |
| **Lines** | 333 |
| **Hooks** | `useArtists`, `useCallback`, `useCreateArtist`, `useMemo`, `useNavigate`, `useState`, `useSyncArtistStats` |
| **Data hooks** | `useArtists` → /api/artists, /api/artists/${artistId}/connections/${connectionId}/primary, /api/artists/${artistId}/connections/${platform}/manual · `useCreateArtist` → /api/artists, /api/artists/${artistId}/connections/${connectionId}/primary, /api/artists/${artistId}/connections/${platform}/manual · `useSyncArtistStats` → /api/artists, /api/artists/${artistId}/connections/${connectionId}/primary, /api/artists/${artistId}/connections/${platform}/manual |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/finance/FinancePage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | (tab: finance) |
| **Default export** | `FinancePage` |
| **Lines** | 1378 |
| **Hooks** | `useAuth`, `useCallback`, `useConfirm`, `useDeferredQueryEnabled`, `useEffect`, `useMemo`, `useMutation`, `useQuery`, `useQueryClient`, `useSearchParams`, `useState`, `useUsdInrRate`, `useWorkspaces` |
| **Data hooks** | `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members · `useConfirm` → /api/contacts, /api/contacts/${editingContact._id}, /api/contacts/${id} · `useDeferredQueryEnabled` → /api/admin/media-contacts, /api/admin/media-contacts/filters, /api/admin/platform-settings · `useSearchParams` → /api/auth/google?state=link_${user?._id}, /api/crm/leads/${highlightId}, /api/crm/leads/${id} · `useUsdInrRate` → /api/exly/config, /api/exly/dashboard-stats, /api/exly/offerings · `useWorkspaces` → /api/auth/google?state=link_${user?._id}, /api/finance/${id}, /api/finance/${id}/approve |
| **Key components** | `FinanceAssignProjectsBanner`, `FinanceDocumentPreview`, `NeedsAttentionAccordion`, `UploadDocumentModal`, `UsdInrAmountFields` |

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
#### `Taskmaster/client/src/pages/hubs/ManagementHub.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /management?tab=finance|announcements|documents|artists |
| **Default export** | `function` |
| **Lines** | 21 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/management/AnnouncementsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | (tab: announcements) |
| **Default export** | `AnnouncementsPage` |
| **Lines** | 251 |
| **Hooks** | `useAnnouncementTargets`, `useAnnouncements`, `useCallback`, `useConfirm`, `useCreateAnnouncement`, `useDeferredQueryEnabled`, `useDeleteAnnouncement`, `useMemo`, `useState` |
| **Data hooks** | `useAnnouncementTargets` → /api/announcements, /api/announcements/${id}, /api/announcements/targets · `useAnnouncements` → /api/announcements, /api/announcements/${id}, /api/announcements/targets · `useConfirm` → /api/contacts, /api/contacts/${editingContact._id}, /api/contacts/${id} · `useCreateAnnouncement` → /api/announcements, /api/announcements/${id}, /api/announcements/targets · `useDeferredQueryEnabled` → /api/admin/media-contacts, /api/admin/media-contacts/filters, /api/admin/platform-settings · `useDeleteAnnouncement` → /api/announcements, /api/announcements/${id}, /api/announcements/targets |
| **Key components** | `WorkspaceProjectFields` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/management/AttendancePage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /attendance, /attendance/all |
| **Default export** | `AttendancePage` |
| **Lines** | 782 |
| **Hooks** | `useApproveAttendance`, `useApproveLeaveRequest`, `useAttendance`, `useAttendanceCheck`, `useAttendanceRosterUsers`, `useAuth`, `useDeferredQueryEnabled`, `useEffect`, `useLeaveRequests`, `useLocation`, `useMemo`, `useNavigate`, `useRejectLeaveRequest`, `useResetAttendance`, `useState`, `useSystemToast`, `useUndoAttendanceCheck`, `useUnsavedChanges`, `useUpsertAttendance` |
| **Data hooks** | `useApproveAttendance` → /api/attendance, /api/attendance/${id}/approve, /api/attendance/check · `useApproveLeaveRequest` → /api/attendance, /api/attendance/${id}/approve, /api/attendance/check · `useAttendance` → /api/attendance, /api/attendance/${id}/approve, /api/attendance/check · `useAttendanceCheck` → /api/attendance, /api/attendance/${id}/approve, /api/attendance/check · `useAttendanceRosterUsers` → /api/attendance, /api/attendance/${id}/approve, /api/attendance/check · `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members · `useDeferredQueryEnabled` → /api/admin/media-contacts, /api/admin/media-contacts/filters, /api/admin/platform-settings · `useLeaveRequests` → /api/attendance, /api/attendance/${id}/approve, /api/attendance/check · `useRejectLeaveRequest` → /api/attendance, /api/attendance/${id}/approve, /api/attendance/check · `useResetAttendance` → /api/attendance, /api/attendance/${id}/approve, /api/attendance/check · `useSystemToast` → /api/calendar, /api/calendar/${initialData._id}, /api/crm/leads/cleanup-test-data · `useUndoAttendanceCheck` → /api/attendance, /api/attendance/${id}/approve, /api/attendance/check · `useUnsavedChanges` → /api/admin/platform-settings, /api/auth/change-required-password, /api/auth/google?state=link_${user?._id} · `useUpsertAttendance` → /api/attendance, /api/attendance/${id}/approve, /api/attendance/check |
| **Key components** | `AttendanceStatusLegend`, `MonthlyAttendanceGrid`, `SelfMonthlyAttendanceCalendar`, `TeamAttendanceMobileList`, `UnifiedTimeCard` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._

### Email & campaigns

#### `Taskmaster/client/src/pages/CampaignDetails.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /campaign/:campaignId |
| **Default export** | `function` |
| **Lines** | 853 |
| **Hooks** | `useCallback`, `useCampaignAnalytics`, `useCampaignDetails`, `useCampaignRecipients`, `useEffect`, `useLocation`, `useMailProfiles`, `useMemo`, `useNavigate`, `useParams`, `useResendCampaign`, `useResendFilteredCampaign`, `useState`, `useStopCampaign`, `useToast` |
| **Data hooks** | `useCampaignAnalytics` → /api/campaigns, /api/campaigns/${campaignApiId}/recipients/export?${params}, /api/campaigns/${id} · `useCampaignDetails` → /api/campaigns, /api/campaigns/${campaignApiId}/recipients/export?${params}, /api/campaigns/${id} · `useCampaignRecipients` → /api/campaigns, /api/campaigns/${campaignApiId}/recipients/export?${params}, /api/campaigns/${id} · `useMailProfiles` → /api/campaigns, /api/campaigns/${campaignApiId}/recipients/export?${params}, /api/campaigns/${id} · `useResendCampaign` → /api/campaigns, /api/campaigns/${campaignApiId}/recipients/export?${params}, /api/campaigns/${id} · `useResendFilteredCampaign` → /api/campaigns, /api/campaigns/${campaignApiId}/recipients/export?${params}, /api/campaigns/${id} · `useStopCampaign` → /api/campaigns, /api/campaigns/${campaignApiId}/recipients/export?${params}, /api/campaigns/${id} · `useToast` → /api/admin/platform-settings, /api/admin/tenants, /api/admin/tenants/${tenant._id} |
| **Key components** | `RegisteredLocationBarChart`, `ResendFromEmailPicker` |

**API endpoints:**

- `/api/campaigns/${campaignApiId}/recipients/export?${params}`
#### `Taskmaster/client/src/pages/emails/AutoMailerRedirectPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 60 |
| **Hooks** | `useMemo` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/emails/EmailHubLayout.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 29 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/emails/EmailsCampaignsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /emails/campaigns |
| **Default export** | `function` |
| **Lines** | 50 |
| **Hooks** | `useDeferredQueryEnabled`, `useMailProfiles`, `useNavigate`, `useScanBounces`, `useToast` |
| **Data hooks** | `useDeferredQueryEnabled` → /api/admin/media-contacts, /api/admin/media-contacts/filters, /api/admin/platform-settings · `useMailProfiles` → /api/campaigns, /api/campaigns/${campaignApiId}/recipients/export?${params}, /api/campaigns/${id} · `useScanBounces` → /api/campaigns, /api/campaigns/${id}, /api/campaigns/${id}/analytics · `useToast` → /api/admin/platform-settings, /api/admin/tenants, /api/admin/tenants/${tenant._id} |
| **Key components** | `MailCampaignList` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/emails/EmailsOverviewPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /emails |
| **Default export** | `function` |
| **Lines** | 109 |
| **Hooks** | `useDeferredQueryEnabled`, `useMailCampaigns`, `useMailStats`, `useNavigate` |
| **Data hooks** | `useDeferredQueryEnabled` → /api/admin/media-contacts, /api/admin/media-contacts/filters, /api/admin/platform-settings · `useMailCampaigns` → /api/campaigns, /api/campaigns/${id}, /api/campaigns/${id}/analytics · `useMailStats` → /api/campaigns, /api/campaigns/${id}, /api/campaigns/${id}/analytics |
| **Key components** | `MailCampaignList`, `MailStatsSummary` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/emails/EmailsProfilesPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /emails/profiles |
| **Default export** | `function` |
| **Lines** | 32 |
| **Hooks** | `useMailProfiles` |
| **Data hooks** | `useMailProfiles` → /api/campaigns, /api/campaigns/${campaignApiId}/recipients/export?${params}, /api/campaigns/${id} |
| **Key components** | `MailProfilesPanel` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/emails/EmailsStreamsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /emails/streams |
| **Default export** | `function` |
| **Lines** | 33 |
| **Hooks** | `useEmailStreams` |
| **Data hooks** | `useEmailStreams` → /api/campaigns, /api/campaigns/${id}, /api/campaigns/${id}/analytics |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/emails/EmailsTemplatesPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /emails/templates |
| **Default export** | `function` |
| **Lines** | 37 |
| **Hooks** | `useNavigate` |
| **Key components** | `MailTemplateStudio` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/workspace/CreateCampaignPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /emails/create |
| **Default export** | `CreateCampaignPage` |
| **Lines** | 28 |
| **Hooks** | `useNavigate` |
| **Key components** | `CampaignWizardShell` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/workspace/NewsletterCuratePage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /emails/newsletter/curate |
| **Default export** | `NewsletterCuratePage` |
| **Lines** | 62 |
| **Hooks** | `useAuth`, `useCurrentNewsletterIssue`, `useNavigate`, `useNewsletterCategories`, `useNewsletterIssue`, `useSearchParams` |
| **Data hooks** | `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members · `useCurrentNewsletterIssue` → /api/newsletter/articles, /api/newsletter/articles/${id}, /api/newsletter/categories · `useNewsletterCategories` → /api/newsletter/articles, /api/newsletter/articles/${id}, /api/newsletter/categories · `useNewsletterIssue` → /api/newsletter/articles, /api/newsletter/articles/${id}, /api/newsletter/categories · `useSearchParams` → /api/auth/google?state=link_${user?._id}, /api/crm/leads/${highlightId}, /api/crm/leads/${id} |
| **Key components** | `NewsletterCuratorPanel` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/workspace/NewsletterPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /emails/newsletter |
| **Default export** | `NewsletterPage` |
| **Lines** | 123 |
| **Hooks** | `useAuth`, `useCurrentNewsletterIssue`, `useNavigate`, `useNewsletterCategories` |
| **Data hooks** | `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members · `useCurrentNewsletterIssue` → /api/newsletter/articles, /api/newsletter/articles/${id}, /api/newsletter/categories · `useNewsletterCategories` → /api/newsletter/articles, /api/newsletter/articles/${id}, /api/newsletter/categories |
| **Key components** | `NewsletterLinkForm`, `NewsletterWeekBoard` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/workspace/NewsletterSendPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /emails/newsletter/send/:issueId |
| **Default export** | `NewsletterSendPage` |
| **Lines** | 63 |
| **Hooks** | `useAuth`, `useNavigate`, `useNewsletterIssue`, `useParams` |
| **Data hooks** | `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members · `useNewsletterIssue` → /api/newsletter/articles, /api/newsletter/articles/${id}, /api/newsletter/categories |
| **Key components** | `NewsletterSendWizard` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._

### Artist OS & workspace

#### `Taskmaster/client/src/pages/artists/ArtistDetail.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /artists/:id/*, /preview/artist/:id/* |
| **Default export** | `function` |
| **Lines** | 326 |
| **Hooks** | `useArtistDashboard`, `useConfirm`, `useNavigate`, `useParams`, `useState` |
| **Data hooks** | `useConfirm` → /api/contacts, /api/contacts/${editingContact._id}, /api/contacts/${id} |
| **Key components** | `ArtistEditDrawer`, `ArtistShareModal`, `ClaimWorkspaceBanner` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/artists/ArtistOSLayout.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 112 |
| **Hooks** | `useEffect`, `useMemo`, `useSearchParams` |
| **Data hooks** | `useSearchParams` → /api/auth/google?state=link_${user?._id}, /api/crm/leads/${highlightId}, /api/crm/leads/${id} |
| **Key components** | `ArtistProductHint`, `PageSkeleton` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/artists/ArtistPublicProfile.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /artist/:slug |
| **Default export** | `function` |
| **Lines** | 311 |
| **Hooks** | `useEffect`, `useMemo`, `useMutation`, `useParams`, `usePublicArtist`, `useQuery`, `useState` |
| **Data hooks** | `usePublicArtist` → /api/artists/public/${slug}, /api/artists/public/${slug}/inquiry |
| **Key components** | `BrandLogo` |

**API endpoints:**

- `/api/artists/public/${slug}`
- `/api/artists/public/${slug}/inquiry`
#### `Taskmaster/client/src/pages/artists/artistTabLoaders.js`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `—` |
| **Lines** | 58 |
| **Named exports** | `getLazyArtistOsTab`, `getLazyArtistWorkspaceTab`, `ARTIST_OS_TAB_LOADERS`, `ARTIST_WORKSPACE_TAB_LOADERS` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/artists/os/ArtistAnalyticsTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 328 |
| **Hooks** | `useArtistAnalytics`, `useArtistOsScores`, `useCallback`, `useEffect`, `useMemo`, `useSearchParams`, `useState`, `useTimeRange` |
| **Data hooks** | `useArtistAnalytics` → /api/artists, /api/artists/${artistId}/connections/${connectionId}/primary, /api/artists/${artistId}/connections/${platform}/manual · `useArtistOsScores` → /api/artists/${artistId}/os/analytics/scores, /api/artists/${artistId}/os/assets, /api/artists/${artistId}/os/assets/${assetId} · `useSearchParams` → /api/auth/google?state=link_${user?._id}, /api/crm/leads/${highlightId}, /api/crm/leads/${id} |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/artists/os/ArtistCalendarTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 113 |
| **Hooks** | `useArtistOsCalendar`, `useCreateArtistCalendarEvent`, `useState` |
| **Data hooks** | `useArtistOsCalendar` → /api/artists/${artistId}/os/analytics/scores, /api/artists/${artistId}/os/assets, /api/artists/${artistId}/os/assets/${assetId} · `useCreateArtistCalendarEvent` → /api/artists/${artistId}/os/analytics/scores, /api/artists/${artistId}/os/assets, /api/artists/${artistId}/os/assets/${assetId} |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/artists/os/ArtistCommandCenter.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 27 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/artists/os/ArtistConnectOnboarding.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 96 |
| **Hooks** | `useAuth` |
| **Data hooks** | `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/artists/os/ArtistContentTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 188 |
| **Hooks** | `useArtistOsAssets`, `useCreateArtistAsset`, `useDeleteArtistAsset`, `useMemo`, `useState`, `useUpdateArtistAsset` |
| **Data hooks** | `useArtistOsAssets` → /api/artists/${artistId}/os/analytics/scores, /api/artists/${artistId}/os/assets, /api/artists/${artistId}/os/assets/${assetId} · `useCreateArtistAsset` → /api/artists/${artistId}/os/analytics/scores, /api/artists/${artistId}/os/assets, /api/artists/${artistId}/os/assets/${assetId} · `useDeleteArtistAsset` → /api/artists/${artistId}/os/analytics/scores, /api/artists/${artistId}/os/assets, /api/artists/${artistId}/os/assets/${assetId} · `useUpdateArtistAsset` → /api/artists/${artistId}/os/analytics/scores, /api/artists/${artistId}/os/assets, /api/artists/${artistId}/os/assets/${assetId} |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/artists/os/ArtistContractsTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 57 |
| **Hooks** | `useArtistOsContracts`, `useCreateArtistContract`, `useState` |
| **Data hooks** | `useArtistOsContracts` → /api/artists/${artistId}/os/analytics/scores, /api/artists/${artistId}/os/assets, /api/artists/${artistId}/os/assets/${assetId} · `useCreateArtistContract` → /api/artists/${artistId}/os/analytics/scores, /api/artists/${artistId}/os/assets, /api/artists/${artistId}/os/assets/${assetId} |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/artists/os/ArtistDocumentsTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 69 |
| **Named exports** | `getArtistDocumentsDescription` |
| **Hooks** | `useArtistOsDocuments`, `useSearchParams` |
| **Data hooks** | `useArtistOsDocuments` → /api/artists/${artistId}/os/analytics/scores, /api/artists/${artistId}/os/assets, /api/artists/${artistId}/os/assets/${assetId} · `useSearchParams` → /api/auth/google?state=link_${user?._id}, /api/crm/leads/${highlightId}, /api/crm/leads/${id} |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/artists/os/ArtistDocumentsTab.test.js`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `—` |
| **Lines** | 19 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/artists/os/ArtistDocumentsTab.test.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `—` |
| **Lines** | 44 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/artists/os/ArtistFinanceTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 136 |
| **Hooks** | `useArtistOsFinance`, `useCreateArtistFinanceEntry`, `useState` |
| **Data hooks** | `useArtistOsFinance` → /api/artists/${artistId}/os/analytics/scores, /api/artists/${artistId}/os/assets, /api/artists/${artistId}/os/assets/${assetId} · `useCreateArtistFinanceEntry` → /api/artists/${artistId}/os/analytics/scores, /api/artists/${artistId}/os/assets, /api/artists/${artistId}/os/assets/${assetId} |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/artists/os/ArtistGigsTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 100 |
| **Hooks** | `useArtistOsGigs`, `useCreateArtistGig`, `useState`, `useUpdateArtistGig` |
| **Data hooks** | `useArtistOsGigs` → /api/artists/${artistId}/os/analytics/scores, /api/artists/${artistId}/os/assets, /api/artists/${artistId}/os/assets/${assetId} · `useCreateArtistGig` → /api/artists/${artistId}/os/analytics/scores, /api/artists/${artistId}/os/assets, /api/artists/${artistId}/os/assets/${assetId} · `useUpdateArtistGig` → /api/artists/${artistId}/os/analytics/scores, /api/artists/${artistId}/os/assets, /api/artists/${artistId}/os/assets/${assetId} |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/artists/os/ArtistInquiriesTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 131 |
| **Hooks** | `useArtistOsInquiries`, `useCreateArtistInquiry`, `useState`, `useUpdateArtistInquiry` |
| **Data hooks** | `useArtistOsInquiries` → /api/artists/${artistId}/os/analytics/scores, /api/artists/${artistId}/os/assets, /api/artists/${artistId}/os/assets/${assetId} · `useCreateArtistInquiry` → /api/artists/${artistId}/os/analytics/scores, /api/artists/${artistId}/os/assets, /api/artists/${artistId}/os/assets/${assetId} · `useUpdateArtistInquiry` → /api/artists/${artistId}/os/analytics/scores, /api/artists/${artistId}/os/assets, /api/artists/${artistId}/os/assets/${assetId} |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/artists/os/ArtistNotesTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 42 |
| **Hooks** | `useArtistOsNotes`, `useCreateArtistNote`, `useState` |
| **Data hooks** | `useArtistOsNotes` → /api/artists/${artistId}/os/analytics/scores, /api/artists/${artistId}/os/assets, /api/artists/${artistId}/os/assets/${assetId} · `useCreateArtistNote` → /api/artists/${artistId}/os/analytics/scores, /api/artists/${artistId}/os/assets, /api/artists/${artistId}/os/assets/${assetId} |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/artists/os/artistOsConstants.js`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `—` |
| **Lines** | 68 |
| **Named exports** | `ARTIST_OS_TABS`, `CALENDAR_EVENT_COLORS`, `BOOKING_PIPELINE_STAGES`, `INQUIRY_STATUSES`, `ASSET_TYPES`, `EXPENSE_CATEGORIES`, `REVENUE_CATEGORIES`, `formatInr` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/artists/os/ArtistOsQueryShell.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 27 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/artists/os/ArtistOsQueryShell.test.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `—` |
| **Lines** | 41 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/artists/os/ArtistOverviewPanel.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 471 |
| **Hooks** | `useArtistOsCalendar`, `useArtistOsContent`, `useArtistOsGigs`, `useArtistOsInquiries`, `useArtistOsOverview`, `useArtistOsScores`, `useArtistOsTimeline`, `useConnectionHealth`, `useConnectionHub`, `useMemo`, `useSyncPlatformConnection` |
| **Data hooks** | `useArtistOsCalendar` → /api/artists/${artistId}/os/analytics/scores, /api/artists/${artistId}/os/assets, /api/artists/${artistId}/os/assets/${assetId} · `useArtistOsContent` → /api/artists/${artistId}/os/analytics/scores, /api/artists/${artistId}/os/assets, /api/artists/${artistId}/os/assets/${assetId} · `useArtistOsGigs` → /api/artists/${artistId}/os/analytics/scores, /api/artists/${artistId}/os/assets, /api/artists/${artistId}/os/assets/${assetId} · `useArtistOsInquiries` → /api/artists/${artistId}/os/analytics/scores, /api/artists/${artistId}/os/assets, /api/artists/${artistId}/os/assets/${assetId} · `useArtistOsOverview` → /api/artists/${artistId}/os/analytics/scores, /api/artists/${artistId}/os/assets, /api/artists/${artistId}/os/assets/${assetId} · `useArtistOsScores` → /api/artists/${artistId}/os/analytics/scores, /api/artists/${artistId}/os/assets, /api/artists/${artistId}/os/assets/${assetId} · `useArtistOsTimeline` → /api/artists/${artistId}/os/analytics/scores, /api/artists/${artistId}/os/assets, /api/artists/${artistId}/os/assets/${assetId} · `useConnectionHealth` → /api/artists, /api/artists/${artistId}/connections/${connectionId}/primary, /api/artists/${artistId}/connections/${platform}/manual · `useConnectionHub` → /api/artists, /api/artists/${artistId}/connections/${connectionId}/primary, /api/artists/${artistId}/connections/${platform}/manual · `useSyncPlatformConnection` → /api/artists, /api/artists/${artistId}/connections/${connectionId}/primary, /api/artists/${artistId}/connections/${platform}/manual |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/artists/workspace/ArtistBookingsTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 64 |
| **Hooks** | `useArtistOsInquiries`, `useMemo`, `useState` |
| **Data hooks** | `useArtistOsInquiries` → /api/artists/${artistId}/os/analytics/scores, /api/artists/${artistId}/os/assets, /api/artists/${artistId}/os/assets/${assetId} |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/artists/workspace/ArtistMembershipAccept.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /artist-workspace/:id/accept |
| **Default export** | `function` |
| **Lines** | 139 |
| **Hooks** | `useAcceptArtistMembership`, `useEffect`, `useNavigate`, `useParams`, `useRef`, `useSearchParams`, `useState` |
| **Data hooks** | `useAcceptArtistMembership` → /api/artists/${artistId}, /api/artists/${artistId}/members, /api/artists/${artistId}/members/${membershipId} · `useSearchParams` → /api/auth/google?state=link_${user?._id}, /api/crm/leads/${highlightId}, /api/crm/leads/${id} |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/artists/workspace/ArtistReleasesTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 225 |
| **Hooks** | `useArtistOsReleases`, `useCreateArtistRelease`, `useDeleteArtistRelease`, `useState`, `useUpdateArtistRelease` |
| **Data hooks** | `useArtistOsReleases` → /api/artists/${artistId}/os/analytics/scores, /api/artists/${artistId}/os/assets, /api/artists/${artistId}/os/assets/${assetId} · `useCreateArtistRelease` → /api/artists/${artistId}/os/analytics/scores, /api/artists/${artistId}/os/assets, /api/artists/${artistId}/os/assets/${assetId} · `useDeleteArtistRelease` → /api/artists/${artistId}/os/analytics/scores, /api/artists/${artistId}/os/assets, /api/artists/${artistId}/os/assets/${assetId} · `useUpdateArtistRelease` → /api/artists/${artistId}/os/analytics/scores, /api/artists/${artistId}/os/assets, /api/artists/${artistId}/os/assets/${assetId} |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/artists/workspace/ArtistTeamTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 150 |
| **Hooks** | `useArtistMemberships`, `useInviteArtistMembership`, `useRemoveArtistMembership`, `useState`, `useUpdateArtistMembership` |
| **Data hooks** | `useArtistMemberships` → /api/artists/${artistId}, /api/artists/${artistId}/members, /api/artists/${artistId}/members/${membershipId} · `useInviteArtistMembership` → /api/artists/${artistId}, /api/artists/${artistId}/members, /api/artists/${artistId}/members/${membershipId} · `useRemoveArtistMembership` → /api/artists/${artistId}, /api/artists/${artistId}/members, /api/artists/${artistId}/members/${membershipId} · `useUpdateArtistMembership` → /api/artists/${artistId}, /api/artists/${artistId}/members, /api/artists/${artistId}/members/${membershipId} |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/artists/workspace/artistWorkspaceConstants.js`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `—` |
| **Lines** | 21 |
| **Named exports** | `ARTIST_WORKSPACE_TABS`, `ARTIST_WORKSPACE_NAV`, `DEFAULT_WORKSPACE_TAB` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/artists/workspace/ArtistWorkspaceDetail.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | (workspace routes) |
| **Default export** | `function` |
| **Lines** | 109 |
| **Hooks** | `useArtistDashboard`, `useArtistMembership`, `useAuth`, `useMemo`, `useParams`, `useState` |
| **Data hooks** | `useArtistMembership` → /api/artists/${artistId}, /api/artists/${artistId}/members, /api/artists/${artistId}/members/${membershipId} · `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/artists/workspace/ArtistWorkspaceLayout.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 155 |
| **Hooks** | `useEffect`, `useMemo`, `useSearchParams` |
| **Data hooks** | `useSearchParams` → /api/auth/google?state=link_${user?._id}, /api/crm/leads/${highlightId}, /api/crm/leads/${id} |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/artists/workspace/ArtistWorkspaceNoAccess.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 37 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/artists/workspace/ArtistWorkspaceShell.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /artist-workspace/:id/* (shell) |
| **Default export** | `function` |
| **Lines** | 151 |
| **Hooks** | `useArtist`, `useArtistMembership`, `useAuth`, `useMemo`, `useParams`, `useSearchParams`, `useState` |
| **Data hooks** | `useArtist` → /api/artists, /api/artists/${artistId}/connections/${connectionId}/primary, /api/artists/${artistId}/connections/${platform}/manual · `useArtistMembership` → /api/artists/${artistId}, /api/artists/${artistId}/members, /api/artists/${artistId}/members/${membershipId} · `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members · `useSearchParams` → /api/auth/google?state=link_${user?._id}, /api/crm/leads/${highlightId}, /api/crm/leads/${id} |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/artists/workspace/tabs/ArtistWorkspaceHome.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 26 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/artists/workspace/tabs/ArtistWorkspaceSettings.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 95 |
| **Hooks** | `useEffect`, `useState`, `useUpdateArtist` |
| **Data hooks** | `useUpdateArtist` → /api/artists, /api/artists/${artistId}/connections/${connectionId}/primary, /api/artists/${artistId}/connections/${platform}/manual |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._

### Assets

#### `Taskmaster/client/src/pages/assets/AssetsHubLayout.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 35 |
| **Hooks** | `useAuth` |
| **Data hooks** | `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/assets/AssetsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /assets |
| **Default export** | `AssetsPage` |
| **Lines** | 871 |
| **Hooks** | `useAssets`, `useAuth`, `useCallback`, `useCreateAsset`, `useDeferredQueryEnabled`, `useDeleteAsset`, `useEffect`, `useGoogleAccounts`, `useMemo`, `useProjects`, `useQueryClient`, `useSearchParams`, `useState`, `useUnlinkGoogleAccount`, `useUnsavedChanges`, `useUpdateAsset`, `useWorkspaces` |
| **Data hooks** | `useAssets` → /api/assets, /api/assets/${id}, /api/auth/google?state=link_${user?._id} · `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members · `useCreateAsset` → /api/assets, /api/assets/${id}, /api/auth/google?state=link_${user?._id} · `useDeferredQueryEnabled` → /api/admin/media-contacts, /api/admin/media-contacts/filters, /api/admin/platform-settings · `useDeleteAsset` → /api/assets, /api/assets/${id}, /api/auth/google?state=link_${user?._id} · `useGoogleAccounts` → /api/assets, /api/assets/${id}, /api/auth/google?state=link_${user?._id} · `useProjects` → /api/auth/google?state=link_${user?._id}, /api/calendar, /api/calendar/${initialData._id} · `useSearchParams` → /api/auth/google?state=link_${user?._id}, /api/crm/leads/${highlightId}, /api/crm/leads/${id} · `useUnlinkGoogleAccount` → /api/assets, /api/assets/${id}, /api/auth/google?state=link_${user?._id} · `useUnsavedChanges` → /api/admin/platform-settings, /api/auth/change-required-password, /api/auth/google?state=link_${user?._id} · `useUpdateAsset` → /api/assets, /api/assets/${id}, /api/auth/google?state=link_${user?._id} · `useWorkspaces` → /api/auth/google?state=link_${user?._id}, /api/finance/${id}, /api/finance/${id}/approve |
| **Key components** | `MentionTextarea`, `ProjectMultiSelect` |

**API endpoints:**

- `/api/auth/google?state=link_${user?._id}`
- `/api/google/accounts/manual`
- `/api/google/accounts/simulate`
#### `Taskmaster/client/src/pages/assets/OrgAccountsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /assets/accounts |
| **Default export** | `OrgAccountsPage` |
| **Lines** | 768 |
| **Hooks** | `useCallback`, `useConfirm`, `useDeferredQueryEnabled`, `useEffect`, `useMemo`, `useMutation`, `useQuery`, `useQueryClient`, `useState`, `useToast`, `useUnsavedChanges` |
| **Data hooks** | `useConfirm` → /api/contacts, /api/contacts/${editingContact._id}, /api/contacts/${id} · `useDeferredQueryEnabled` → /api/admin/media-contacts, /api/admin/media-contacts/filters, /api/admin/platform-settings · `useToast` → /api/admin/platform-settings, /api/admin/tenants, /api/admin/tenants/${tenant._id} · `useUnsavedChanges` → /api/admin/platform-settings, /api/auth/change-required-password, /api/auth/google?state=link_${user?._id} |
| **Key components** | `MemberSelect`, `ProjectMultiSelect` |

**API endpoints:**

- `/api/org-accounts`
- `/api/org-accounts/${account._id}`
- `/api/org-accounts/${editing._id}`
- `/api/org-accounts/${id}`
- `/api/org-accounts/import-sheet`
- `/api/projects`

### Admin & Data Hub

#### `Taskmaster/client/src/pages/admin/AdminCRM.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /admin |
| **Default export** | `AdminCRM` |
| **Lines** | 7 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/admin/AdminExly.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `AdminExly` |
| **Lines** | 15 |
| **Key components** | `ExlyDataContent` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/admin/AdminGamification.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /admin/gamification |
| **Default export** | `AdminGamification` |
| **Lines** | 368 |
| **Hooks** | `useCallback`, `useConfirm`, `useEffect`, `useMemo`, `useQueryClient`, `useState`, `useUnsavedChanges` |
| **Data hooks** | `useConfirm` → /api/contacts, /api/contacts/${editingContact._id}, /api/contacts/${id} · `useUnsavedChanges` → /api/admin/platform-settings, /api/auth/change-required-password, /api/auth/google?state=link_${user?._id} |

**API endpoints:**

- `/api/gamification-admin/config`
- `/api/gamification-admin/recalculate-all-levels`
- `/api/gamification-admin/rules`
#### `Taskmaster/client/src/pages/admin/AdminPanel.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /admin/control |
| **Default export** | `AdminPanel` |
| **Lines** | 483 |
| **Hooks** | `useAuth`, `useCRMStats`, `useCallback`, `useConfirm`, `useCreateTeam`, `useDataHubFolders`, `useDeferredQueryEnabled`, `useDeleteTeam`, `useDeleteUser`, `useEffect`, `useMailStats`, `useMemo`, `usePlatformExclusions`, `useSearchParams`, `useState`, `useTeams`, `useToast`, `useUpdateUser`, `useUserDirectory` |
| **Data hooks** | `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members · `useCRMStats` → /api/crm/artist/import-sheets, /api/crm/config, /api/crm/imports · `useConfirm` → /api/contacts, /api/contacts/${editingContact._id}, /api/contacts/${id} · `useCreateTeam` → /api/admin/platform-settings/exclusions, /api/departments/users/${userId}, /api/teams · `useDataHubFolders` → /api/data-hub/analytics, /api/data-hub/backup, /api/data-hub/backup/progress · `useDeferredQueryEnabled` → /api/admin/media-contacts, /api/admin/media-contacts/filters, /api/admin/platform-settings · `useDeleteTeam` → /api/admin/platform-settings/exclusions, /api/departments/users/${userId}, /api/teams · `useDeleteUser` → /api/admin/platform-settings/exclusions, /api/departments/users/${userId}, /api/teams · `useMailStats` → /api/campaigns, /api/campaigns/${id}, /api/campaigns/${id}/analytics · `usePlatformExclusions` → /api/admin/platform-settings/exclusions, /api/departments/users/${userId}, /api/mail/preview · `useSearchParams` → /api/auth/google?state=link_${user?._id}, /api/crm/leads/${highlightId}, /api/crm/leads/${id} · `useTeams` → /api/admin/platform-settings/exclusions, /api/departments/users/${userId}, /api/teams · `useToast` → /api/admin/platform-settings, /api/admin/tenants, /api/admin/tenants/${tenant._id} · `useUpdateUser` → /api/admin/platform-settings/exclusions, /api/departments/users/${userId}, /api/teams · `useUserDirectory` → /api/admin/platform-settings, /api/assets, /api/contacts |
| **Key components** | `AdminUserGridCard`, `ClerkDashboardUsersButton`, `MonthlyReportPanel`, `UserDeleteAction` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/admin/AdminPlatformSettings.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /admin/platform-settings |
| **Default export** | `AdminPlatformSettings` |
| **Lines** | 161 |
| **Hooks** | `useCallback`, `useDeferredQueryEnabled`, `useEffect`, `useMemo`, `useQueryClient`, `useState`, `useToast`, `useUserDirectory` |
| **Data hooks** | `useDeferredQueryEnabled` → /api/admin/media-contacts, /api/admin/media-contacts/filters, /api/admin/platform-settings · `useToast` → /api/admin/platform-settings, /api/admin/tenants, /api/admin/tenants/${tenant._id} · `useUserDirectory` → /api/admin/platform-settings, /api/assets, /api/contacts |
| **Key components** | `PlatformSettingsUserField`, `QueryErrorSlot` |

**API endpoints:**

- `/api/admin/platform-settings`
#### `Taskmaster/client/src/pages/admin/AdminProjectAnalyticsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /admin/project-analytics |
| **Default export** | `AdminProjectAnalyticsPage` |
| **Lines** | 503 |
| **Hooks** | `useCallback`, `useDeferredQueryEnabled`, `useEffect`, `useMemo`, `useProjectReportRangeState`, `useProjects`, `useProjectsAnalyticsSummary`, `useRef`, `useSearchParams`, `useState` |
| **Data hooks** | `useDeferredQueryEnabled` → /api/admin/media-contacts, /api/admin/media-contacts/filters, /api/admin/platform-settings · `useProjects` → /api/auth/google?state=link_${user?._id}, /api/calendar, /api/calendar/${initialData._id} · `useProjectsAnalyticsSummary` → /api/projects, /api/projects/${id}, /api/projects/${projectId}/analytics · `useSearchParams` → /api/auth/google?state=link_${user?._id}, /api/crm/leads/${highlightId}, /api/crm/leads/${id} |
| **Key components** | `ProjectAnalyticsContent`, `ProjectAnalyticsKpiGrid`, `ProjectReportRangeControls` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/admin/AdminRolesPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /admin/roles |
| **Default export** | `AdminRolesPage` |
| **Lines** | 120 |
| **Hooks** | `useAdminRoles`, `useMemo` |
| **Data hooks** | `useAdminRoles` → /api/admin/roles, /api/admin/roles/${id} |
| **Key components** | `OrgRolesPanel` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/admin/AdminScriptsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /admin/scripts |
| **Default export** | `AdminScriptsPage` |
| **Lines** | 273 |
| **Hooks** | `useDeferredQueryEnabled`, `useMemo`, `useQuery`, `useState` |
| **Data hooks** | `useDeferredQueryEnabled` → /api/admin/media-contacts, /api/admin/media-contacts/filters, /api/admin/platform-settings |
| **Key components** | `RelativeTimestamp` |

**API endpoints:**

- `/api/admin/queues/status`
- `/api/admin/scripts`
- `/api/admin/scripts/${scriptId}/run`
#### `Taskmaster/client/src/pages/admin/AdminTeamsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /admin/teams |
| **Default export** | `AdminTeamsPage` |
| **Lines** | 168 |
| **Hooks** | `useCallback`, `useDepartments`, `useMemo`, `useState`, `useUpdateUser`, `useUserDirectory` |
| **Data hooks** | `useDepartments` → /api/departments, /api/departments/${departmentId}/monthly-report, /api/departments/${id} · `useUpdateUser` → /api/admin/platform-settings/exclusions, /api/departments/users/${userId}, /api/teams · `useUserDirectory` → /api/admin/platform-settings, /api/assets, /api/contacts |
| **Key components** | `AdminBulkActionBar`, `DepartmentsPanel` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/admin/AdminTenantSsoPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /admin/tenant-sso |
| **Default export** | `function` |
| **Lines** | 114 |
| **Hooks** | `useCallback`, `useEffect`, `useState`, `useToast` |
| **Data hooks** | `useToast` → /api/admin/platform-settings, /api/admin/tenants, /api/admin/tenants/${tenant._id} |
| **Key components** | `QueryErrorSlot` |

**API endpoints:**

- `/api/admin/tenants`
- `/api/admin/tenants/${tenant._id}`
#### `Taskmaster/client/src/pages/admin/AdminUsers.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /admin/users |
| **Default export** | `AdminUsers` |
| **Lines** | 565 |
| **Hooks** | `useAuth`, `useCRMStats`, `useCallback`, `useConfirm`, `useCreateUser`, `useDataHubFolders`, `useDeferredQueryEnabled`, `useDeleteUser`, `useDepartments`, `useEffect`, `useMailStats`, `useMemo`, `usePlatformExclusions`, `useState`, `useUpdateUser`, `useUserDirectory` |
| **Data hooks** | `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members · `useCRMStats` → /api/crm/artist/import-sheets, /api/crm/config, /api/crm/imports · `useConfirm` → /api/contacts, /api/contacts/${editingContact._id}, /api/contacts/${id} · `useCreateUser` → /api/admin/platform-settings/exclusions, /api/departments/users/${userId}, /api/teams · `useDataHubFolders` → /api/data-hub/analytics, /api/data-hub/backup, /api/data-hub/backup/progress · `useDeferredQueryEnabled` → /api/admin/media-contacts, /api/admin/media-contacts/filters, /api/admin/platform-settings · `useDeleteUser` → /api/admin/platform-settings/exclusions, /api/departments/users/${userId}, /api/teams · `useDepartments` → /api/departments, /api/departments/${departmentId}/monthly-report, /api/departments/${id} · `useMailStats` → /api/campaigns, /api/campaigns/${id}, /api/campaigns/${id}/analytics · `usePlatformExclusions` → /api/admin/platform-settings/exclusions, /api/departments/users/${userId}, /api/mail/preview · `useUpdateUser` → /api/admin/platform-settings/exclusions, /api/departments/users/${userId}, /api/teams · `useUserDirectory` → /api/admin/platform-settings, /api/assets, /api/contacts |
| **Key components** | `AdminBulkActionBar`, `AdminUserGridCard`, `ClerkDashboardUsersButton`, `CreateUserModal`, `MonthlyReportPanel`, `PagePermissionsEditor`, `UserDeleteAction` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/admin/ArtistPathPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /admin/artist-path |
| **Default export** | `function` |
| **Lines** | 110 |
| **Hooks** | `useArtistPathPeople`, `useArtistPathSync`, `useDebounce`, `useState`, `useToast` |
| **Data hooks** | `useArtistPathPeople` → /api/artist-path/people, /api/artist-path/people/${personId}, /api/artist-path/sync · `useArtistPathSync` → /api/artist-path/people, /api/artist-path/people/${personId}, /api/artist-path/sync · `useDebounce` → /api/crm/leads/${highlightId}, /api/crm/leads/${id}, /api/crm/leads/${leadId}/audit · `useToast` → /api/admin/platform-settings, /api/admin/tenants, /api/admin/tenants/${tenant._id} |
| **Key components** | `ArtistPathCardGrid`, `ArtistProductHint`, `SearchInput` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/admin/CrmStatsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /admin/crm-stats |
| **Default export** | `function` |
| **Lines** | 438 |
| **Hooks** | `useAuth`, `useCrmStats`, `useCrmStatsTrends`, `useMemo`, `useState` |
| **Data hooks** | `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members · `useCrmStats` → /api/admin/crm-stats, /api/admin/crm-stats/trends · `useCrmStatsTrends` → /api/admin/crm-stats, /api/admin/crm-stats/trends |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/admin/DataHubPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | (AdminCRM tab) |
| **Default export** | `function` |
| **Lines** | 793 |
| **Named exports** | `DataHubContent` |
| **Hooks** | `useCallback`, `useConfirm`, `useDataHubAnalytics`, `useDataHubBackups`, `useDataHubBulkDeletePeople`, `useDataHubFolders`, `useDataHubPeople`, `useDataHubProductionBackup`, `useDataHubRebuildPersonHub`, `useDataHubReconcile`, `useDataHubSyncStatus`, `useDebounce`, `useDeferredQueryEnabled`, `useEffect`, `useMemo`, `useQueryClient`, `useRef`, `useState`, `useToast` |
| **Data hooks** | `useConfirm` → /api/contacts, /api/contacts/${editingContact._id}, /api/contacts/${id} · `useDataHubAnalytics` → /api/data-hub/analytics, /api/data-hub/backup, /api/data-hub/backup/progress · `useDataHubBackups` → /api/data-hub/analytics, /api/data-hub/backup, /api/data-hub/backup/progress · `useDataHubBulkDeletePeople` → /api/data-hub/analytics, /api/data-hub/backup, /api/data-hub/backup/progress · `useDataHubFolders` → /api/data-hub/analytics, /api/data-hub/backup, /api/data-hub/backup/progress · `useDataHubPeople` → /api/data-hub/analytics, /api/data-hub/backup, /api/data-hub/backup/progress · `useDataHubProductionBackup` → /api/data-hub/analytics, /api/data-hub/backup, /api/data-hub/backup/progress · `useDataHubRebuildPersonHub` → /api/data-hub/analytics, /api/data-hub/backup, /api/data-hub/backup/progress · `useDataHubReconcile` → /api/data-hub/analytics, /api/data-hub/backup, /api/data-hub/backup/progress · `useDataHubSyncStatus` → /api/data-hub/analytics, /api/data-hub/backup, /api/data-hub/backup/progress · `useDebounce` → /api/crm/leads/${highlightId}, /api/crm/leads/${id}, /api/crm/leads/${leadId}/audit · `useDeferredQueryEnabled` → /api/admin/media-contacts, /api/admin/media-contacts/filters, /api/admin/platform-settings · `useToast` → /api/admin/platform-settings, /api/admin/tenants, /api/admin/tenants/${tenant._id} |
| **Key components** | `DataHubCampaignOutcomes`, `DataHubInletCluster`, `DataHubOpsMenu`, `DataHubTemporalColumn`, `ListPageLayout`, `SearchInput`, `StatusBadge` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/admin/ExlyCampaignsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /admin/exly-campaigns |
| **Default export** | `ExlyCampaignsPage` |
| **Lines** | 75 |
| **Hooks** | `useState` |
| **Key components** | `ExlyDataContent`, `MasterclassFunnelPanel` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/admin/LeadAuditsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /admin/lead-audits |
| **Default export** | `LeadAuditsPage` |
| **Lines** | 69 |
| **Hooks** | `useAuth`, `useConfirm`, `useLeadAudits`, `useState` |
| **Data hooks** | `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members · `useConfirm` → /api/contacts, /api/contacts/${editingContact._id}, /api/contacts/${id} · `useLeadAudits` → /api/crm/artist/import-sheets, /api/crm/config, /api/crm/imports |
| **Key components** | `LeadAuditsContent` |

**API endpoints:**

- `/api/crm/leads/audit-logs/purge`
#### `Taskmaster/client/src/pages/admin/MediaListPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /admin/media-list |
| **Default export** | `MediaListPage` |
| **Lines** | 283 |
| **Hooks** | `useCallback`, `useDeferredQueryEnabled`, `useMemo`, `useQuery`, `useState` |
| **Data hooks** | `useDeferredQueryEnabled` → /api/admin/media-contacts, /api/admin/media-contacts/filters, /api/admin/platform-settings |
| **Key components** | `ListPageLayout`, `PageSkeleton`, `SearchInput` |

**API endpoints:**

- `/api/admin/media-contacts`
- `/api/admin/media-contacts/filters`
#### `Taskmaster/client/src/pages/admin/OpsHubPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /admin/ops-hub |
| **Default export** | `function` |
| **Lines** | 305 |
| **Hooks** | `useAuth`, `useCreateOpsEntity`, `useDebounce`, `useEffect`, `useMemo`, `useOpsHubAnalytics`, `useOpsHubEntities`, `useOpsHubEntity`, `useOpsHubTaxonomy`, `useOpsHubWeekly`, `useSearchParams`, `useState`, `useToast` |
| **Data hooks** | `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members · `useCreateOpsEntity` → /api/ops-hub/analytics, /api/ops-hub/entities, /api/ops-hub/entities/${id} · `useDebounce` → /api/crm/leads/${highlightId}, /api/crm/leads/${id}, /api/crm/leads/${leadId}/audit · `useOpsHubAnalytics` → /api/ops-hub/analytics, /api/ops-hub/entities, /api/ops-hub/entities/${id} · `useOpsHubEntities` → /api/ops-hub/analytics, /api/ops-hub/entities, /api/ops-hub/entities/${id} · `useOpsHubEntity` → /api/ops-hub/analytics, /api/ops-hub/entities, /api/ops-hub/entities/${id} · `useOpsHubTaxonomy` → /api/ops-hub/analytics, /api/ops-hub/entities, /api/ops-hub/entities/${id} · `useOpsHubWeekly` → /api/ops-hub/analytics, /api/ops-hub/entities, /api/ops-hub/entities/${id} · `useSearchParams` → /api/auth/google?state=link_${user?._id}, /api/crm/leads/${highlightId}, /api/crm/leads/${id} · `useToast` → /api/admin/platform-settings, /api/admin/tenants, /api/admin/tenants/${tenant._id} |
| **Key components** | `OpsEntityDetail`, `OpsHubAnalyticsPanel`, `OpsMondayBoard`, `PageToolbar`, `SearchInput`, `StatusBadge` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/admin/QATestingPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /admin/qa |
| **Default export** | `QATestingPage` |
| **Lines** | 1324 |
| **Hooks** | `useCallback`, `useConfirm`, `useDeferredQueryEnabled`, `useEffect`, `useMemo`, `useMutation`, `useProjects`, `useQAProgress`, `useQuery`, `useQueryClient`, `useState`, `useSystemToast` |
| **Data hooks** | `useConfirm` → /api/contacts, /api/contacts/${editingContact._id}, /api/contacts/${id} · `useDeferredQueryEnabled` → /api/admin/media-contacts, /api/admin/media-contacts/filters, /api/admin/platform-settings · `useProjects` → /api/auth/google?state=link_${user?._id}, /api/calendar, /api/calendar/${initialData._id} · `useQAProgress` → /api/crm/leads/cleanup-test-data, /api/qa/cancel/${testRunId}, /api/qa/history · `useSystemToast` → /api/calendar, /api/calendar/${initialData._id}, /api/crm/leads/cleanup-test-data |

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
#### `Taskmaster/client/src/pages/hubs/AdminConsole.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /admin/console |
| **Default export** | `function` |
| **Lines** | 345 |
| **Hooks** | `useAdminConsoleSummary`, `useAuth`, `useCallback`, `useMemo`, `useNavigate`, `useState`, `useTenantUnlocks` |
| **Data hooks** | `useAdminConsoleSummary` → /api/admin/console/summary · `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members · `useTenantUnlocks` → /api/tenants/${tenantId}/unlocks |
| **Key components** | `DataListRow`, `DataOverviewSection`, `PageHeader` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._

### Settings

#### `Taskmaster/client/src/pages/settings/DevelopersPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /developers |
| **Default export** | `DevelopersPage` |
| **Lines** | 399 |
| **Hooks** | `useEffect`, `useState`, `useWebhookDeliveries` |
| **Data hooks** | `useWebhookDeliveries` → /api/enterprise/api-keys, /api/enterprise/usage, /api/enterprise/webhooks |
| **Key components** | `WebsiteFormsPanel` |

**API endpoints:**

- `/api/enterprise/api-keys`
- `/api/enterprise/usage`
- `/api/enterprise/webhooks`
- `/api/enterprise/webhooks/${id}`
- `/api/openapi.json`
#### `Taskmaster/client/src/pages/settings/SettingsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /settings |
| **Default export** | `SettingsPage` |
| **Lines** | 185 |
| **Hooks** | `useAuth`, `useEffect`, `useNavigate`, `useSearchParams`, `useState` |
| **Data hooks** | `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members · `useSearchParams` → /api/auth/google?state=link_${user?._id}, /api/crm/leads/${highlightId}, /api/crm/leads/${id} |
| **Key components** | `PageSkeleton` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/settings/tabs/AttendanceTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 81 |
| **Hooks** | `useAttendance`, `useAuth` |
| **Data hooks** | `useAttendance` → /api/attendance, /api/attendance/${id}/approve, /api/attendance/check · `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/settings/tabs/IntegrationsTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 193 |
| **Hooks** | `useConnectIntegration`, `useDisconnectIntegration`, `useIntegrationHealth`, `useIntegrationProviders`, `useIntegrationSync`, `useMemo`, `usePatchIntegrationMetadata`, `useSearchParams`, `useState` |
| **Data hooks** | `useConnectIntegration` → /api/enterprise/webhooks/deliveries, /api/integrations/${provider}/connect, /api/integrations/connections · `useDisconnectIntegration` → /api/enterprise/webhooks/deliveries, /api/integrations/${provider}/connect, /api/integrations/connections · `useIntegrationHealth` → /api/enterprise/webhooks/deliveries, /api/integrations/${provider}/connect, /api/integrations/connections · `useIntegrationProviders` → /api/enterprise/webhooks/deliveries, /api/integrations/${provider}/connect, /api/integrations/connections · `useIntegrationSync` → /api/enterprise/webhooks/deliveries, /api/integrations/${provider}/connect, /api/integrations/connections · `usePatchIntegrationMetadata` → /api/enterprise/webhooks/deliveries, /api/integrations/${provider}/connect, /api/integrations/connections · `useSearchParams` → /api/auth/google?state=link_${user?._id}, /api/crm/leads/${highlightId}, /api/crm/leads/${id} |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/settings/tabs/InvoiceTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 410 |
| **Hooks** | `useEffect`, `useMemo`, `useMyReimbursements`, `useProjects`, `useQueryClient`, `useRef`, `useState`, `useWorkspaces` |
| **Data hooks** | `useMyReimbursements` → /api/attendance, /api/attendance/${id}/approve, /api/attendance/check · `useProjects` → /api/auth/google?state=link_${user?._id}, /api/calendar, /api/calendar/${initialData._id} · `useWorkspaces` → /api/auth/google?state=link_${user?._id}, /api/finance/${id}, /api/finance/${id}/approve |

**API endpoints:**

- `/api/finance/submit-invoice`
#### `Taskmaster/client/src/pages/settings/tabs/KeyboardShortcutsTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `KeyboardShortcutsTab` |
| **Lines** | 401 |
| **Hooks** | `useAuth`, `useCallback`, `useEffect`, `useMemo`, `useQueryClient`, `useRef`, `useShortcutPreferences`, `useState` |
| **Data hooks** | `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members · `useShortcutPreferences` → /api/customization/shortcuts, /api/customization/shortcuts/reset |

**API endpoints:**

- `/api/customization/shortcuts`
- `/api/customization/shortcuts/reset`
#### `Taskmaster/client/src/pages/settings/tabs/LeaveTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 114 |
| **Hooks** | `useApplyLeave`, `useAuth`, `useCallback`, `useLeaveRequests`, `useMemo`, `useState` |
| **Data hooks** | `useApplyLeave` → /api/attendance, /api/attendance/${id}/approve, /api/attendance/check · `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members · `useLeaveRequests` → /api/attendance, /api/attendance/${id}/approve, /api/attendance/check |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/settings/tabs/NotificationsTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 268 |
| **Hooks** | `useCallback`, `useEffect`, `useState` |

**API endpoints:**

- `/api/notifications/push/subscriptions`
- `/api/notifications/push/unsubscribe`
#### `Taskmaster/client/src/pages/settings/tabs/OrganizationTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 193 |
| **Hooks** | `useAuth`, `useNavigate`, `useOffboardOrganization`, `useOrgOptional`, `useOrgSettings`, `useQuery`, `useQueryClient`, `useUpdateOrgSettings` |
| **Data hooks** | `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members · `useOffboardOrganization` → /api/enterprise/offboard, /api/tenants/${tenantId}/settings, /api/tenants/memberships · `useOrgOptional` → /api/orgs/${encodeURIComponent(orgSlug)}/context, /api/tenants/${tenantId}/features, /api/tenants/${tenantId}/onboarding · `useOrgSettings` → /api/enterprise/offboard, /api/tenants/${tenantId}/settings, /api/tenants/memberships · `useUpdateOrgSettings` → /api/enterprise/offboard, /api/tenants/${tenantId}/settings, /api/tenants/memberships |

**API endpoints:**

- `/api/tenants/memberships`
- `/api/tenants/select`
#### `Taskmaster/client/src/pages/settings/tabs/ProfileTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 503 |
| **Hooks** | `useAuth`, `useCallback`, `useEffect`, `useMemo`, `useNavigate`, `useState`, `useUnsavedChanges` |
| **Data hooks** | `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members · `useUnsavedChanges` → /api/admin/platform-settings, /api/auth/change-required-password, /api/auth/google?state=link_${user?._id} |

**API endpoints:**

- `/api/auth/change-required-password`
- `/api/teams`
- `/api/users/profile`
#### `Taskmaster/client/src/pages/settings/tabs/ProgressTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 186 |
| **Hooks** | `useGamificationHistory`, `useGamificationMissions`, `useGamificationProgress`, `useMemo`, `useState` |
| **Data hooks** | `useGamificationHistory` → /api/gamification/history, /api/gamification/leaderboard, /api/gamification/leaderboard/${userId}/breakdown · `useGamificationMissions` → /api/gamification/history, /api/gamification/leaderboard, /api/gamification/leaderboard/${userId}/breakdown · `useGamificationProgress` → /api/gamification/history, /api/gamification/leaderboard, /api/gamification/leaderboard/${userId}/breakdown |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/settings/tabs/SessionsTab.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `SessionsTab` |
| **Lines** | 171 |
| **Hooks** | `useAuth`, `useCallback`, `useMutation`, `useQuery`, `useQueryClient`, `useState` |
| **Data hooks** | `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members |

**API endpoints:**

- `/api/auth/sessions`
- `/api/auth/sessions/${jti}`
- `/api/auth/sessions/revoke-others`

### Marketing, dev & misc

#### `Taskmaster/client/src/pages/dev/ComponentsShowcase.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /components |
| **Default export** | `ComponentsShowcase` |
| **Lines** | 803 |
| **Hooks** | `useMemo`, `useState` |
| **Key components** | `AppErrorPage`, `FluidRibbonLoaderGallery` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/hubs/TabHubLayout.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 83 |
| **Hooks** | `useAuth`, `useEffect`, `useMemo`, `useSearchParams`, `useTenantUnlocks` |
| **Data hooks** | `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members · `useSearchParams` → /api/auth/google?state=link_${user?._id}, /api/crm/leads/${highlightId}, /api/crm/leads/${id} · `useTenantUnlocks` → /api/tenants/${tenantId}/unlocks |
| **Key components** | `HubPageLayout`, `ModuleSubnav` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/hubs/TabHubLayout.test.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `—` |
| **Lines** | 58 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/management/DocumentsPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 385 |
| **Hooks** | `useCallback`, `useConfirm`, `useCreateOrgDocument`, `useDeleteOrgDocument`, `useEffect`, `useMemo`, `useOrgDocuments`, `useState`, `useUpdateOrgDocument` |
| **Data hooks** | `useConfirm` → /api/contacts, /api/contacts/${editingContact._id}, /api/contacts/${id} · `useCreateOrgDocument` → /api/org-documents, /api/org-documents/${id}, /api/org-documents/${row._id}/file · `useDeleteOrgDocument` → /api/org-documents, /api/org-documents/${id}, /api/org-documents/${row._id}/file · `useOrgDocuments` → /api/org-documents, /api/org-documents/${id}, /api/org-documents/${row._id}/file · `useUpdateOrgDocument` → /api/org-documents, /api/org-documents/${id}, /api/org-documents/${row._id}/file |
| **Key components** | `ListPageLayout`, `ListPageSkeleton`, `OrgDocumentModal`, `OrgDocumentWorkspacePanel`, `SearchInput` |

**API endpoints:**

- `/api/org-documents/${row._id}/file`
#### `Taskmaster/client/src/pages/management/DocumentsPage.test.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `—` |
| **Lines** | 82 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/marketing/FeaturesPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /features |
| **Default export** | `FeaturesPage` |
| **Lines** | 120 |
| **Hooks** | `useMemo` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/NotFoundPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | * (in MainLayout) |
| **Default export** | `function` |
| **Lines** | 22 |
| **Hooks** | `useNavigate` |
| **Key components** | `EmptyState` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/org/create/OrgCreateProgress.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 44 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/org/create/OrgLogoPicker.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 79 |
| **Hooks** | `useRef` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/org/create/steps/StepFeatures.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 69 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/org/create/steps/StepIdentity.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 75 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/org/create/steps/StepInvites.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 87 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/org/create/steps/StepProfile.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 77 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/org/create/steps/StepReview.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | _embedded tab / child route_ |
| **Default export** | `function` |
| **Lines** | 79 |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/org/CreateOrganizationPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /org/create |
| **Default export** | `function` |
| **Lines** | 157 |
| **Hooks** | `useNavigate`, `useState` |

**API endpoints:**

- `/api/tenants/create`
#### `Taskmaster/client/src/pages/org/OrgCreateSuccessPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /org/create/success |
| **Default export** | `function` |
| **Lines** | 59 |
| **Hooks** | `useCallback`, `useEffect`, `useLocation`, `useNavigate`, `useRef` |

_No direct `/api/...` string literals — data via shared hooks (e.g. `useTaskmasterQueries`) or parent hub._
#### `Taskmaster/client/src/pages/org/OrgPickerPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /org/pick |
| **Default export** | `function` |
| **Lines** | 92 |
| **Hooks** | `useAuth`, `useEffect`, `useMutation`, `useNavigate`, `useQuery`, `useQueryClient`, `useState` |
| **Data hooks** | `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members |

**API endpoints:**

- `/api/tenants/memberships`
- `/api/tenants/select`
#### `Taskmaster/client/src/pages/org/TenantInviteAcceptPage.jsx`

| Field | Value |
| --- | --- |
| **Route(s)** | /invites/:token/accept |
| **Default export** | `function` |
| **Lines** | 63 |
| **Hooks** | `useAuth`, `useEffect`, `useNavigate`, `useParams`, `useState` |
| **Data hooks** | `useAuth` → /api/artists/${artistId}, /api/artists/${artistId}/claim, /api/artists/${artistId}/members |

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
- `server/routes/contactRoutes.js`
- `server/routes/crmRoutes.js`
- `server/routes/crmStatsRoutes.js`
- `server/routes/customizationRoutes.js`
- `server/routes/dashboardRoutes.js`
- `server/routes/dataHubRoutes.js`
- `server/routes/departmentRoutes.js`
- `server/routes/deprecatedAutoMailerRoutes.js`
- `server/routes/enterpriseRoutes.js`
- `server/routes/exlyRoutes.js`
- `server/routes/financeRoutes.js`
- `server/routes/gamificationAdminRoutes.js`
- `server/routes/gamificationRoutes.js`
- `server/routes/googleAccounts.js`
- `server/routes/googleRoutes.js`
- `server/routes/integrationsRoutes.js`
- `server/routes/inviteRoutes.js`
- `server/routes/logRoutes.js`
- `server/routes/mailStatsProxyRoutes.js`
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
- `server/routes/orgRoutes.js`
- `server/routes/pinBoardRoutes.js`
- `server/routes/platformSettingsRoutes.js`
- `server/routes/platformSupportRoutes.js`
- `server/routes/projectRoutes.js`
- `server/routes/proxyRoutes.js`
- `server/routes/publicApiRoutes.js`
- `server/routes/publicFormRoutes.js`
- `server/routes/publicRoutes.js`
- `server/routes/qaRoutes.js`
- `server/routes/queueAdminRoutes.js`
- `server/routes/scheduleRoutes.js`
- `server/routes/scimRoutes.js`
- `server/routes/searchRoutes.js`
- `server/routes/securityAuditRoutes.js`
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

Shared rule module inventory (generated): [`docs/.generated/shared-rules-inventory.json`](../.generated/shared-rules-inventory.json)

---

## 7. Locked zones

| Asset | Doc |
| --- | --- |
| Email open/click tracking | [`EMAIL_ENGINE_LOCKED.md`](../reference/EMAIL_ENGINE_LOCKED.md) |
| Logo + default spinner | [`LOGO_LOCKED.md`](../reference/LOGO_LOCKED.md) |
| Production hosts | `.cursor/production-hosts.local.json` (gitignored) |
| Legacy APIs | [`LEGACY_FREEZE.md`](../architecture/LEGACY_FREEZE.md) |

Enforcement: locked-zone checks run in local tests + CI. Any override requires explicit env opt-in and rationale.

---

## 8. Documentation map

| Path | Purpose |
| --- | --- |
| [`DOCUMENTATION_INDEX.md`](../DOCUMENTATION_INDEX.md) | Human navigation hub |
| [`memory/obsidian/INDEX.md`](../../../../memory/obsidian/INDEX.md) | Canonical agent memory hub |
| [`.specify/memory/INDEX.md`](../.specify/memory/INDEX.md) | Compatibility mirror (deprecated) |
| [`reference/COREKNOT_MASTER.md`](./COREKNOT_MASTER.md) | **This file** — page-level truth |
| [`operations/`](../operations/) | Deploy, startup, scripts, environments, [`PUBLIC_LAUNCH_BETA.md`](../operations/PUBLIC_LAUNCH_BETA.md) |
| [`architecture/`](../architecture/) | System design, data, security, debt |
| [`features/`](../features/) | Domain deep-dives (Artist OS, Data Hub, integrations) |
| [`auth/`](../auth/) | OAuth, Clerk, subdomain setup |
| [`design/`](../design/) | UI reference (`DESIGN-REFERENCE.md`, component standards) |
| [`reference/COMPONENT_STANDARDS.md`](./COMPONENT_STANDARDS.md) | Client component patterns |

