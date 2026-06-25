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

### Site modes (`client/src/config/siteMode.js`)

| Mode | Host | Routes |
| --- | --- | --- |
| `app` (default) | `tsccoreknot.com` | Workspace + legal; `/` → landing if logged out; auth paths → `auth.tsccoreknot.com` |
| `landing` | `landing.tsccoreknot.com` | `/` landing, `/privacy`, `/userdata` |
| `auth` | `auth.tsccoreknot.com` | `/login`, `/register`, `/forgot-password`, `/reset-password`, `/relegends`, `/auth/google/success`, legal |

URL helpers: `client/src/config/siteUrls.js` — `landingUrl()`, `authUrl()`, `appUrl()`, `resolveAppNavigationTarget()`.

### Public (no auth) — auth subdomain or legacy same-host

| Path | Page |
| --- | --- |
| `/login`, `/register` | Auth pages (`auth.tsccoreknot.com`) |
| `/forgot-password`, `/reset-password` | Password reset |
| `/relegends` | OTP verification |
| `/auth/google/success` | OAuth ticket exchange |
| `/privacy`, `/userdata` | Legal pages |
| `/unsubscribe` | Email unsubscribe (app host) |

Landing marketing page: `landing.tsccoreknot.com/` only (not on app host).

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
| `/admin/console`, `/admin/qa`, `/admin/scripts`, `/admin/platform-settings` | Admin tooling |
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

`MainLayout`, `ProtectedRoute`, `PageRoute`, `CommandPalette`, `BottomNavigation`, `OutletSidebar`, `QuickAddMenu`, `HelpBugButton`, `PwaInstallBanner`, `NotificationBridge`, `CookieBanner`, `OnboardingTour`

### Onboarding & profile alerts (Jun 2026)

- `ProfileCompletionAlerts` — amber **Onboarding checklist** (password, phone, DOB, product tour); tour replay via `coreknot:replay-onboarding`
- `OnboardingTour` — dashboard auto-start; completion → `coreknot:onboarding-complete` + `onboardingStorage.js`

### Cookie consent & analytics (Jun 2026)

- `lib/cookieConsent.js` — `coreknot_cookie_consent_v1` in localStorage
- `CookieBanner` — Essential only / Accept all
- `main.jsx` — Sentry, Datadog, PostHog init only after analytics consent; PostHog provider re-mounts on accept; `@vercel/analytics/react` `<Analytics />` on all deploy modes (app, landing, auth)

### Social preview (Jun 2026)

- `scripts/generate-og-preview.mjs` → `public/icons/og-preview.png` (1200×630, brand mark + CoreKnot wordmark); runs on `prebuild`
- `index.html` OG tags point at `https://tsccoreknot.com/icons/og-preview.png`
- `public/sitemap.xml` — landing, auth, legal URLs

---


### Query & error UX (Jun 2026)

- QueryErrorBanner — shared TanStack Query error surface with retry
- queryDefaults.js / queryClient.js — centralized stale times and invalidation helpers
- ForcePasswordChangeGate replaces modal for mandatory password rotation
- `navStatusCounts.js` — sidebar badges; Projects uses `statusCounts.projects` (project-scoped overdue/review, not global todo counts)

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

- **Desktop production:** axios → `VITE_API_URL` (Render direct; skips Vercel edge)
- **Mobile / PWA:** same-origin `/api` via Vercel rewrite (`displayMode.js` → `shouldUseSameOriginApi()`)
- **Dev:** Vite proxy → `localhost:5000`
- Socket.io always uses `VITE_API_URL` in production (`apiBase.js`)
- `AuthContext` — 6 retries on `/me` for Safari cookie races
