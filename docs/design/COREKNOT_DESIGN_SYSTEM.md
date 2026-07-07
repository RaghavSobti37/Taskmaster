# CoreKnot Design System

> Canonical reference for visual identity, layout patterns, components, and page-level conventions across CoreKnot. Consolidated from `DESIGN-REFERENCE.md`, token files, `App.jsx`, and `page-inventory.json`.

**Routing convention:** all app routes are org-scoped — `/:orgSlug/...` (e.g. `/tsc/dashboard`) — unless explicitly marked public/marketing.

---

## Table of contents

1. [Brand & tokens](#1-brand--tokens)
2. [Visual zones](#2-visual-zones)
3. [Layout philosophy (UDIF)](#3-layout-philosophy-udif)
4. [Page archetypes](#4-page-archetypes)
5. [Component library](#5-component-library)
6. [Route map](#6-route-map)
7. [Quick reference](#7-quick-reference)

---

## 1. Brand & tokens

### Color

| Role | Token | Hex | Usage |
|---|---|---|---|
| Primary accent | `--brand-green` / `--color-action-primary` | `#126d5e` | CTAs, active nav, focus |
| Deep teal | `--brand-teal-deep` | `#083d3a` | Marketing text |
| Marketing cream | `--brand-cream-wash` | `#fcf8f2` | Marketing/auth background |
| Warning | `--brand-amber` | `#b56f1c` | Warning states |
| Danger | `--brand-rust` | `#88281c` | Destructive states |
| Landing dark green | `--landing-green-dark` | `#0f3d37` | Landing page only |
| Landing accent | `--landing-accent` | `#e9a66b` | Landing page only |

**App shell neutrals:** canvas `#e4eaf2` · surfaces `#ffffff` / `#eef2f7` · hairline `#c5d0de`
**Dark mode:** canvas `#070809` · green accents reserved for actions only

### Typography

| Class | Spec |
|---|---|
| `.tm-page-title` | 1.5rem / 800 / tight tracking |
| `.tm-section-label` | 0.75rem / bold / uppercase / wide tracking / muted |
| `.tm-widget-label` | 10px / uppercase / 0.1em tracking |
| `.tm-body` | 0.875rem / 500 |
| `.tm-data-primary` | 500 / primary text color |
| `.tm-data-meta` | 0.8125rem / muted |
| `.tabular-nums` | tabular figures for metrics |

**Interface font:** Geist Variable (`--font-interface`)

### Core rules

- **One accent rule:** teal/green is the *only* accent in the app shell — no secondary brand colors in-product.
- **Shadows only on `.tm-floating`** (modals, sheets, popovers). Static UI uses borders, never shadows.
- Dates are **DD/MM/YYYY** everywhere user-facing.
- 4px grid; page gutter `--page-gutter` (0.9rem).

---

## 2. Visual zones

CoreKnot has exactly two visual languages. Nothing should sit between them.

### Zone A — App shell (logged-in product)
- Slate neutrals, one accent color, `Geist Variable`
- Borders over shadows; shadows reserved for floating UI
- Dark mode available, accent-only color in dark

### Zone B — Marketing / auth
- Classes: `.tm-marketing-page`, `.tm-auth-page`, `.tm-landing`
- Cream wash background, teal-deep text, pumpkin/cream borders — this is the **light** treatment
- Auth (`/login`, `/register`) and landing (`/`, `/landing`) are **independent of app-level dark mode state** — they carry their own theme, not inherited from `MainLayout`

**Landing & login theme default:**
- **Dark by default** — near-black canvas (reuse app's `#070809`) with teal/green accent, not the cream wash
- A **light mode switcher** (sun/moon toggle, top-right of the marketing header / auth card) flips these two surfaces into the cream/teal treatment described above
- This toggle is scoped to Zone B only — it does not touch app-shell theme state, and app-shell dark mode does not touch this toggle
- Preference persists (localStorage or cookie) so a returning visitor sees their last choice; first-time visitors get dark
- All other marketing/auth routes (`/forgot-password`, `/privacy`, `/terms`, `/unsubscribe`, etc.) keep the **cream-only** treatment for now — no dark variant, no switcher — unless called out below

---

## 3. Layout philosophy (UDIF)

**U**tility-first, **D**ata-first, **I**nformation hierarchy via spacing, **F**ixed grid.

- Data-first, subtractive UI — hierarchy comes from spacing and position, not size or decoration
- 4px grid throughout
- **Mobile (≤1023px):** bottom nav, 44px minimum touch targets, filters in a bottom sheet
- **Desktop (≥1024px):** collapsible sidebar, filters in a right drawer
- Dates: DD/MM/YYYY, always

### 3.1 Density: tight, not cramped

The goal is near-zero dead space without the UI feeling packed. These are two different problems and both rules apply at once:

- **Kill unintentional space** — no empty filler regions, no oversized containers padded out just to fill a viewport, no orphaned whitespace from a leftover grid cell. If a region has nothing in it, it shouldn't reserve size for nothing.
- **Keep intentional space** — every remaining gap has a job: separating unrelated groups, giving a data-dense table row room to be scannable, giving a CTA room to be the obvious next action. That space stays.
- Practical rule: **tighten the outer frame, protect the inner rhythm.** Page margins/gutters can run leaner (`--page-gutter` at 0.9rem is already close to this floor — don't drop further), but the vertical rhythm *between* rows, cards, and sections (`--list-section-gap`, `.tm-data-row` padding) stays as specified. Compressing both at once is what makes a UI feel cramped.
- Group spacing follows a **ratio, not a fixed value**: space *within* a group (e.g. label → value) should be visibly tighter than space *between* groups (e.g. one KPI card → the next). If those two distances start to look similar, the grouping has been lost and the page will read as either cramped or scattered depending on which way it drifted.
- Dense data views (tables, logs, ledgers) can run tighter row padding than card-based views (dashboards, artist grids) — density is allowed to vary by content type, it should not be uniform across every archetype.
- When in doubt, cut a container's padding before you cut the gap between its children. Outer padding is the first thing to feel wasteful; inner rhythm is the first thing readers notice missing.

### 3.2 Sidebar: auto-collapse / auto-expand on hover

Applies to `OutletSidebar` in `MainLayout` (desktop, ≥1024px).

- **Default state: collapsed** — icon-only rail, no labels, minimal width
- **On hover/pointer-enter: expands** to full width with labels, revealing nav item text
- **On pointer-leave: collapses** back to the icon rail
- **Speed is the whole point** — this only works if it feels immediate, not "animated":
  - Expand/collapse transition: **~120–150ms**, ease-out on expand, ease-in on collapse (expand can feel a hair faster since it's revealing content the user is waiting on; collapse can be marginally quicker still since nothing needs to be read during it)
  - No expand delay on hover-in (a delay makes the sidebar feel laggy); a small delay (~150–200ms) *is* fine on hover-out, so a stray cursor pass-through doesn't cause flicker
  - The main content area reflows with the same transition timing, not a separate slower one — sidebar and page content move together, not sidebar-then-page
- Pin/unpin: a manual pin control keeps it expanded regardless of hover, for anyone who wants labels visible at all times — this is a persisted per-user preference, independent of the hover behavior
- Mobile is unaffected — bottom nav pattern stays as-is, this behavior is desktop-only

---

## 4. Page archetypes

Every page in CoreKnot maps to one of seven archetypes. When building a new page, start by picking the archetype — don't invent a new shell.

| # | Archetype | Shell | Visual pattern |
|---|---|---|---|
| **A** | List | `ListPageLayout` | KPI overview → toolbar → `DataTable` |
| **B** | Detail | `FullScreenWorkspace` (65/35 split) | Main content + `DetailSidebarShell` |
| **C** | Tab hub | `TabHubLayout` + `ModuleSubnav` | Teal sliding pill tabs |
| **D** | Empty utility | `PageHeader` + `EmptyState` | Sparse, single CTA |
| **E** | Config | Modal sections | Primary = Save, secondary = Discard |
| **F** | Action grid | `tm-stat-shell` + `StatusBadge` | Admin scripts / bulk actions |
| **G** | Dashboard | `DashboardWidgetShell` | Widget cards + `Banner` |

---

## 5. Component library

Source: `client/src/components/ui/` + `index.css`. Full living reference at `/components`.

### Surfaces

| Class / token | Definition |
|---|---|
| `.tm-stat-shell` | `border-radius: 10px; border: 1px solid var(--color-bg-border); background: var(--color-bg-surface);` |
| `.tm-page-container` | Max-width + `--list-section-gap` vertical rhythm |
| `.tm-floating` | Shadow permitted (modals, popovers) |
| `.tm-data-row` | Bottom border, hover `bg-secondary`, padding 0.5–0.625rem |

### Buttons (`primitives.jsx`)

| Variant | Style |
|---|---|
| `primary` | `bg-[var(--color-action-primary)]`, white text |
| `secondary` | `bg-secondary`, bordered |
| `ghost` | Transparent, hover secondary |
| `danger` | Pastel rose bg/text |
| `mint` | Pastel mint bg/text |

Radius: `--radius-atomic` (4px)

### `ModuleSubnav` (tab hub navigation)

- Base: `text-[10px] font-bold uppercase tracking-wider min-h-[44px]` (mobile)
- Active: `.is-active` + sliding teal pill via `useSlidingTabs`
- Trailing action CTA: `bg-[var(--color-action-primary)] text-white h-8 px-3`

### `StatusBadge` (pastel system)

| Color | Meaning |
|---|---|
| Mint | Success / teal-adjacent |
| Apricot | Warning |
| Rose | Error |
| Slate | Neutral |
| Blue | Active / occupied (reserved — not teal) |

### Focus state

```css
:focus-visible {
  box-shadow: 0 0 0 2px var(--token-brand-accent);
}
```

### Charts

`--chart-1` … `--chart-5`, drawn from brand teal, pumpkin, and burgundy series.

---

## 6. Route map

### 6.1 Public / marketing *(no org slug)*

| Route | Aesthetic | Archetype | Key components |
|---|---|---|---|
| `/`, `/landing` | **Dark by default** (`#070809` canvas, teal/green accent) — hero + feature pillars; light-mode toggle switches to cream/teal | Marketing | `BootScreen`, `BrandLogo`, `LandingDashboardPreview`, `ThemeToggle` |
| `/login/*`, `/register/*` | **Dark by default** — `.tm-auth-page` dark variant, centered Clerk block; light-mode toggle available | Auth | `AuthMarketingShell`, `ClerkSignInBlock`, `ThemeToggle` |
| `/login/choose` | Org picker cards, marketing palette | Auth | `OrgChoosePage` |
| `/forgot-password`, `/reset-password` | Minimal form, teal links | Auth | — |
| `/auth/google/success` | Redirect success state | Auth | `BootScreen` |
| `/oauth/meta/callback` | Bare callback handler | Utility | — |
| `/privacy`, `/terms`, `/userdata` | Legal prose, marketing type | Legal | — |
| `/unsubscribe` | Standalone form, no shell | Utility | — |
| `/artist/:slug` | Public artist profile | Public | artist public components |
| `/preview/artist/:id/*` | Artist OS preview mode | Preview | `ArtistDetail` |

### 6.2 Org onboarding *(protected, no sidebar)*

| Route | Aesthetic | Components |
|---|---|---|
| `/org/pick` | Card list, workspace neutral | — |
| `/org/create` | Multi-step wizard, cream/marketing | `StepIdentity → StepProfile → StepFeatures → StepInvites → StepReview`, `OrgCreateProgress`, `OrgLogoPicker` |
| `/org/create/success` | Confirmation | — |
| `/invites/:token/accept` | Invite acceptance | — |
| `/artist-workspace/:id/accept` | Membership accept | — |

### 6.3 App shell *(`MainLayout`: `OutletSidebar` + `BottomNavigation` + `RouteContentSkeleton`)*

**Dashboard**

| Route | Archetype | Components |
|---|---|---|
| `/dashboard` | G | `BrandedLoadingPanel`, `DashboardTierLayout`, `OrgOnboardingChecklist`, `DashboardWidgetShell`, `Banner` |

**Projects**

| Route | Archetype | Components |
|---|---|---|
| `/projects` | A | `ListPageLayout`, `DataTable`, `PageToolbar` |
| `/projects/new` | Form | `SectionCard`, `FormFieldGrid` |
| `/projects/:id` | B | project detail panels |
| `/projects/:id/analytics` | Insights | `ProjectAnalyticsContent`, `ProjectAnalyticsKpiGrid`, `ProjectReportRangeControls` |
| `/workspaces/:name` | Config | `WorkspaceColorPicker` |

**Time & communication**

| Route | Archetype | Components |
|---|---|---|
| `/calendar` | Calendar | `.tm-schedule-pill` |
| `/todo` | A | `ListPageLayout`, `ListCard`, `VirtualTaskList`, `TaskMentionBadge`, `SearchInput` |
| `/notes`, `/notes/new` | A | `ListPageLayout`, `ListCard` |
| `/notes/:id` | Editor | `QuillEditor` |
| `/schedule` | List | `.tm-schedule-pill` |
| `/inbox` | A | `CountBadge`, `DataListRow`, `ListPageLayout` |
| `/logs` | A | `ListPageLayout` |
| `/attendance`, `/attendance/all` | A/G | attendance components |

**CRM hub** — `/crm?tab=` · Archetype C

| Tab | Aesthetic | Components |
|---|---|---|
| `leads` | KPI overview + table → full-screen detail | `ListPageLayout`, `DataOverviewSection`, `FullScreenWorkspace`, `SelectionFilterPanel` |
| `followups` | List pattern | `ListPageLayout`, `PageToolbar` |
| `bookings` | Exly bookings table | `ExlyBookingsPage` |

**Office hub** — `/office?tab=` · Archetype C

| Tab | Components |
|---|---|
| `equipment` | `ListPageLayout`, `StatusBadge`, `DataTable` |
| `contacts` | `ListPageLayout`, `UserAvatar` |
| `subscriptions` | `ListPageLayout`, `RelativeTimestamp` |

**Management hub** — `/management?tab=` · Archetype C

| Tab | Components |
|---|---|
| `finance` | `FinancePage`, `MetricCard`, `DataTable` |
| `announcements` | `ListPageLayout`, `Banner` |
| `documents` | `ListPageLayout`, `EmptyState` |
| `artists` | `ArtistsCollection` |

**Assets**

| Route | Components |
|---|---|
| `/assets` | `ListPageLayout`, `MentionTextarea`, `ProjectMultiSelect` |
| `/assets/accounts` | `MemberSelect`, `ProjectMultiSelect` |
| `/office-assets` | `ListPageLayout`, `StatusBadge` |

**Other**

| Route | Archetype | Components |
|---|---|---|
| `/features` | D | feature cards |
| `/workflows` | Canvas | `WorkflowCanvas`, custom nodes |
| `/developers` | Config | `DevelopersPage` |
| `*` (404) | D | `EmptyState` |

**Settings** — `/settings?tab=` — split pane; desktop left nav (teal active row), mobile pill tabs

| Tab | Component |
|---|---|
| `profile` | `ProfileTab` |
| `security` | `SessionsTab` |
| `keyboard` | `KeyboardShortcutsTab` |
| `notifications` | `NotificationsTab` |
| `dashboard` | `DashboardCustomizationTab` |
| `attendance` | `AttendanceTab` |
| `progress` | `ProgressTab` |
| `leave` | `LeaveTab` |
| `invoice` | `InvoiceTab` |
| `organization` | `OrganizationTab` |
| `integrations` | `IntegrationsTab` |

Shared: `PageSkeleton`, framer-motion tab transitions, 44px mobile pills.

### 6.4 Email hub *(`EmailHubLayout` + `ModuleSubnav`)*

> Shows `DesktopRecommendedBanner` — flagged as desktop-optimized.

| Route | Components |
|---|---|
| `/emails` | `EmailsOverviewPage`, `DataOverviewSection` |
| `/emails/campaigns` | `ListPageLayout` |
| `/emails/templates` | template grid components |
| `/emails/profiles` | profile forms |
| `/emails/streams` | — |
| `/emails/analytics` | `InsightsChart`, `MetricPanelGroup` |
| `/emails/create` | `CampaignWizardShell` |
| `/campaign/:campaignId` | `RegisteredLocationBarChart`, `ResendFromEmailPicker` |
| `/emails/newsletter` | `NewsletterWeekBoard`, `NewsletterLinkForm` |
| `/emails/newsletter/curate` | `NewsletterCuratorPanel` |
| `/emails/newsletter/send/:issueId` | `NewsletterSendWizard` |

### 6.5 Admin

| Route | Archetype | Components |
|---|---|---|
| `/admin` | A | `DataHubPage`, `ListPageLayout`, `DataHubInletCluster`, `StatusBadge`, `SearchInput` |
| `/admin/console` | G | `AdminConsole`, `PageHeader`, `DataOverviewSection`, `DataListRow` |
| `/admin/control` | F | `AdminPanel`, `AdminUserGridCard`, `MonthlyReportPanel` |
| `/admin/users` | A/F | `AdminBulkActionBar`, `CreateUserModal`, `PagePermissionsEditor` |
| `/admin/teams` | Config | `DepartmentsPanel`, `AdminBulkActionBar` |
| `/admin/roles` | Config | `OrgRolesPanel` |
| `/admin/platform-settings` | E | `PlatformSettingsUserField`, `QueryErrorSlot` |
| `/admin/tenant-sso` | E | `QueryErrorSlot` |
| `/admin/gamification` | Config | — |
| `/admin/scripts` | F | `StatusBadge`, `RelativeTimestamp` |
| `/admin/project-analytics` | Insights | `ProjectAnalyticsKpiGrid` |
| `/admin/ops-hub` | A | `DataListRow`, `DataOverviewSection`, `PageHeader` |
| `/admin/qa` | Utility | — |
| `/admin/media-list` | A | media list components |
| `/admin/lead-audits` | A | audit components |
| `/admin/crm-stats` | Insights | — |
| `/admin/exly-campaigns` | List | `ExlyDataContent` |
| `/admin/artist-path` | D | `ArtistPathCardGrid`, `SearchInput`, `ArtistProductHint` |
| `/components` | Reference | Full `components/ui` catalog (living style guide) |

### 6.6 Artists *(feature-gated: `artistOs`)*

| Route | Components |
|---|---|
| `/artists/portfolio` | Portfolio dashboard grid |
| `/artists/:id/*` | `ArtistOSLayout` — horizontal tab bar, border-bottom tabs |
| `/artist-workspace/:id/*` | `ArtistWorkspaceShell` |

**Artist OS tabs** (`?tab=`)

| Tab | Aesthetic |
|---|---|
| `overview` | Command center KPIs — `ArtistOverviewPanel` |
| `calendar` | Color-coded events: amber=inquiry, emerald=gig, rose=dead, blue=personal, purple=release |
| `inquiries` | Pipeline stages via `StatusBadge` |
| `gigs` | Gig list table |
| `finance` | INR currency (`formatInr`), expense categories |
| `analytics` | Platform charts |
| `content` | Asset grid by type |
| `releases` | Release timeline |
| `notes` | Team notes |
| `documents` | Doc list |
| `contracts` | Contract table |
| `team` | Member list |

**Artist workspace tabs:** Home · Bookings · Releases · Team · Settings

---

## 7. Quick reference

```
Landing / Login    → DARK by default (#070809, green accent) + light-mode toggle → cream #fcf8f2
Other marketing    → cream #fcf8f2, teal-deep text, pumpkin accents (no toggle)
App shell          → slate canvas #e4eaf2, white cards, green CTAs
Dark mode (app)    → #070809 canvas, green actions only
Sidebar            → collapsed icon rail by default, expands on hover (~120–150ms, no delay-in)
Density            → tight outer frame, protected inner rhythm — no dead space, still room to breathe
Hub pages          → ModuleSubnav sliding teal pill
List pages         → DataOverview → Toolbar → Table (no card wrap)
Detail overlays    → FullScreenWorkspace, 65/35 split
Floating UI only   → shadows (.tm-floating) — nothing else gets a shadow
```

> Note: landing/login theme state and app-shell theme state are **separate** — a user landing on a dark homepage and then toggling to light there has no effect on what they see once logged into the app shell, and vice versa.

### Decision checklist for any new page

1. Which of the two visual zones does this belong to — app shell or marketing/auth?
2. Which archetype (A–G) fits the content shape? Don't invent a new shell.
3. Is it a hub with sub-tabs? → `TabHubLayout` + `ModuleSubnav`, teal sliding pill.
4. Does it need a shadow? → Only if it's genuinely floating (modal/popover/sheet). Otherwise, border.
5. Any numeric data? → `.tabular-nums`, INR via `formatInr` where relevant, DD/MM/YYYY dates. ( remove date type picker from settings for user)
6. Mobile pass: 44px touch targets, bottom nav/sheet patterns, not desktop patterns shrunk down.
7. Spacing pass: strip any container padding that isn't doing a job; keep the gap between distinct groups clearly bigger than the gap within a group.

---

**Sources:** `docs/design/DESIGN-REFERENCE.md` · `client/src/index.css` · `client/src/styles/tokens/*` · `client/src/App.jsx` · `docs/.generated/page-inventory.json`
