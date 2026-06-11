# Frontend (React SPA)

## Stack

React 18 · Vite 5 · Tailwind v4 · TanStack Query 5 · React Router 6 · Framer Motion · Socket.IO client

---

## Entry & providers

| File | Role |
| --- | --- |
| `main.jsx` | React root, QueryClient, theme, deferred SW register |
| `App.jsx` | Router, lazy routes, `ProtectedRoute`, `PageRoute` guards |

### Contexts

| Context | Purpose |
| --- | --- |
| `AuthContext` | Session, heartbeat, logout epoch, mobile retries |
| `ThemeContext` | Light/dark mode |
| `SidebarContext` | Sidebar collapse state |
| `ToastContext` | react-hot-toast wrapper |
| `ConfirmProvider` | Imperative confirm dialogs |
| `UnsavedChangesProvider` | Global unsaved-changes bar |

---

## Key hooks

`useTaskmasterQueries` (main data layer), `useBreakpoint`, `useStatusCounts`, `useNavbarPreferences`, `useUsdInrRate`, `useUnsavedChanges`, `useAuthenticatedRealtime`, `usePwaInstall`, `useDebounce`, `useColumnSort`, `useLeaderboardBreakdown`, `useWorkModeHint`

---

## Route map

### Public (no auth)

| Path | Page |
| --- | --- |
| `/` | `LandingPage` |
| `/login`, `/register` | Auth pages |
| `/forgot-password`, `/reset-password` | Password reset |
| `/auth/google/success` | OAuth ticket exchange |
| `/privacy`, `/userdata` | Legal pages |
| `/unsubscribe` | Email unsubscribe |

### Protected (MainLayout)

| Path | Page / Hub |
| --- | --- |
| `/dashboard` | Three-column dashboard |
| `/projects`, `/projects/:id` | Project views + analytics |
| `/calendar`, `/schedule` | Calendar + team schedule |
| `/inbox`, `/todo`, `/notes` | Productivity |
| `/logs`, `/attendance` | Daily log + attendance |
| `/crm?tab=*` | Leads, Followups, Bookings |
| `/management?tab=*` | Finance, Announcements, Ops Logs |
| `/emails/*` | Email hub (campaigns, templates, analytics) |
| `/campaign/:campaignId` | Campaign detail |
| `/admin` | Data Hub |
| `/admin/console`, `/admin/qa`, `/admin/scripts` | Admin tooling |
| `/artists/:id/*` | Artist detail (Artist OS) |
| `/artist-workspace/:id/*` | Membership-gated artist workspace |
| `/artist-workspace/:id/accept` | Accept team invite |
| `/artist/:slug` | Public artist profile (stub) |
| `/artists/portfolio` | Portfolio dashboard (stub) |
| `/assets`, `/assets/accounts` | Assets hub |

Legacy redirects: `/leads` → `/crm`, `/finance` → `/management`, `/data-hub` → `/admin`

---

## Component folders (24)

| Folder | Contents |
| --- | --- |
| `admin/` | Mail studio, analytics, departments, Exly, reports, ops terminal |
| `artists/` | Artist detail, connect accounts, ConnectionsCenter, workspace pages |
| `attendance/` | Time cards, grid, prompt modal |
| `brand/` | **LOCKED** logo + spinner |
| `dashboard/` | Widgets: todos, calendar, pinboard, leaderboard |
| `dataHub/` | Person detail panel, folder sidebar |
| `crm/` | `LeadArtistJourneySection` (webinar Q&A + artist journey on lead modal); `useLeadDetail` in `hooks/queries/crm.js`
| `emails/` | Email hub, `CampaignWizardShell`, `StepAudienceMapping` (CSV/HolySheet/**Data Hub**/CRM/Exly/Manual tiles, Data Hub include/exclude inlet multi-select, CRM status filters, **campaign engagement filter**, select/deselect all) |
| `finance/` | Upload modal, needs-attention |
| `forms/` | Project/member/workspace selects |
| `tasks/` | Task list, detail modal, activity, completion |
| `ui/` | Design system: modals, charts, DataTable, layouts |

### Shell components

`MainLayout`, `ProtectedRoute`, `PageRoute`, `CommandPalette`, `BottomNavigation`, `OutletSidebar`, `QuickAddMenu`, `HelpBugButton`, `PwaInstallBanner`, `NotificationBridge`

---


### Query & error UX (Jun 2026)

- QueryErrorBanner � shared TanStack Query error surface with retry
- queryDefaults.js / queryClient.js � centralized stale times and invalidation helpers
- ForcePasswordChangeGate replaces modal for mandatory password rotation

## UI conventions

- **Design:** Subtractive Slate — shell `#0f172a`, brand green `#126d5e`
- **List pages:** `ListPageLayout`, `PageToolbar`, `DataTable`, `DataOverviewSection`
- **Modals:** `confirmContext` + `NexusModal` — no `window.alert`
- **Loading:** Spinner-only default; phrases only for boot + heavy pages — `client/src/lib/loadingDisplay.js`
- **Standards:** `docs/COMPONENT_STANDARDS.md`

---

## PWA

- Manifest: `client/public/manifest.json`
- Service worker: `client/src/sw.js` (injectManifest)
- Icons from `brand-mark.svg` via `generate-pwa-icons.mjs`
- Install hook: `usePwaInstall`; banner: `PwaInstallBanner`

---

## Mobile / API routing

- All devices use same-origin `/api` via Vercel/Vite proxy
- `displayMode.js` — `shouldUseSameOriginApi()` for mobile + PWA
- Fallback: `apiProxyHealth.js` + `loginRequest.js` → direct `VITE_API_URL` if proxy 404
- `AuthContext` — 6 retries on `/me` for Safari cookie races
