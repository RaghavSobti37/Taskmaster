# Artist OS — Architecture & Phased Plan

> **Status:** Phase 1 UI scaffold in progress (Jun 2026)  
> **Goal:** Transform `/artists/:id` from analytics-only reporting into a daily-use **Artist Operating System** for managers and artists.

---

## Executive Summary

Artist managers need **money, gigs, inquiries, and availability** first — not follower counts. The current Artist module (`ArtistDetail.jsx`) is a strong analytics layer but weak on operations.

**Artist OS** adds ten tabs under one artist workspace:

| Tab | Phase | Purpose |
|-----|-------|---------|
| Overview (Command Center) | 1 | MTD revenue, profit, gigs, inquiries, quick platform stats |
| Calendar | 1 | Unified timeline: inquiries, confirmed gigs, releases, personal |
| Inquiries | 1 | Website + manual booking pipeline |
| Gigs | 1 | Confirmed shows only (rate, expense, profit, payment) |
| Finance | 1 | Per-artist P&L, expenses, OCR invoices |
| Analytics | 3 | Existing Spotify / YouTube / Instagram (already built) |
| Content | 4 | Release tracker + performance correlation |
| Team Notes | 2 | Internal manager notes |
| Documents | 2 | Contracts, riders, invoices |
| Contracts | 2 | Formal contract lifecycle |

**Hybrid data strategy:**

- **MongoDB (existing):** Artist profile, connections, OAuth, analytics snapshots, raw API responses, `ArtistMetrics` history
- **Postgres / Supabase (new):** Operational entities — inquiries, gigs, calendar events, finance lines, contracts, payments — relational, report-friendly

---

## Current State vs Target

### What exists today (reuse)

| Area | Location | Reuse |
|------|----------|-------|
| Artist roster | `ArtistsCollection.jsx` | Keep; link into Artist OS |
| Artist profile + OAuth | `Artist`, `ArtistConnection`, `ArtistAuth` | Keep |
| Analytics sync | `artistAnalyticsController.syncArtistStats` | Move to Analytics tab |
| Share link + claim | `artistShareController`, `ClaimWorkspaceBanner` | **Expand** for artist self-onboarding |
| Website enquiries | `POST /api/webhooks/artist-enquiry` → task on project | **Extend** → also create `ArtistInquiry` |
| Booking enquiry UI | `ArtistBookingEnquiryPanel`, `artistBookingEnquiry.js` | Wire into Inquiries tab |
| Finance + OCR | `FinancePage.jsx`, `documentParser.js` | Per-artist filter + upload |
| Calendar | `CalendarView.jsx`, calendar entry modal | Per-artist filtered events |
| CRM Leads | `Lead` model, Data Hub | Source for inquiry auto-import |
| Person identity | `PersonIdentityService` | Dedupe inquiry contacts |

### Gaps

- No per-artist revenue / expense model
- No gig entity separate from CRM lead
- No unified artist calendar (inquiry vs confirmed vs release)
- Enquiries create **tasks** but not **artist-scoped inquiry records**
- Analytics not correlated with releases or gig revenue
- No demographics (age/gender/geo) — requires Meta/YouTube advanced scopes

---

## Tab Specifications

### Overview — Command Center

```
Revenue MTD          Expenses MTD         Profit MTD
Upcoming Shows       Pending Inquiries    Confirmed Shows
Spotify listeners    Instagram followers  YouTube subscribers
Growth % (from normalized.unified.growth)
```

**Preview mode:** 3-step onboarding banner — Sign in → Claim workspace → Connect accounts.

### Calendar

**Event types & colors:**

| Type | Color | Status examples |
|------|-------|-----------------|
| Inquiry | Yellow | Blocked, Negotiating |
| Confirmed gig | Green | Confirmed |
| Dead inquiry | Red | Budget mismatch |
| Personal | Blue | Travel, rest |
| Release | Purple | Single/album drop |

**Sources (merged, deduped):**

1. `ArtistCalendarEvents` (manual)
2. `ArtistInquiries` (inquiry date)
3. `ArtistGigs` (gig date)
4. `ArtistContent` releases (release date)
5. Artist `events[]` on Mongo `Artist` (legacy, migrate)

### Inquiries Pipeline

**Flow change:**

```
Website /query  →  Lead + Task (today)
                 →  ArtistInquiry (new)  →  Artist OS Inquiries tab
```

**Fields:** source, client name, phone, email, artist requested, date, expected budget, status, assigned manager

**Statuses:** `new` → `contacted` → `negotiating` → `blocked` → `confirmed` → `dead`

**Confirmed** promotes to Gig (manual or auto).

### Gigs

Confirmed events only. Columns: SR, name, location, date, rate, expense, profit, invoice ref, contract ref, payment status.

### Finance

- Month picker: revenue, expenses, net
- Categories: Travel, Hotel, Food, Production, Marketing, Management, Misc
- Entry: manual OR upload invoice (reuse Finance OCR pipeline scoped by `artistId`)

### Analytics (Phase 3 — mostly done)

Relocate existing components. Add **Unified Artist Score:**

- Audience Score
- Growth Score
- Engagement Score
- Monetization Score (Phase 4 — needs finance data)

**Demographics (Phase 4):** Instagram Insights + YouTube Analytics API — age, gender, top cities. Requires Business/Creator account + extended permissions.

### Content Tracker (Phase 4)

Release date, song name, type, Spotify streams, YouTube views, reels count, revenue impact (linked to finance + inquiry spike).

### Artist CRM Timeline

Aggregate feed: inquiry created, manager called, gig confirmed, invoice uploaded, payment received, release published. Backed by `ArtistActivity` audit log.

---

## Database Design

### Supabase / Postgres (operational)

```sql
-- artist_id references Mongo Artist._id as text/uuid

artist_inquiries (
  id uuid PK,
  artist_id text NOT NULL,
  tenant_id text,
  source text,           -- website, manual, referral
  client_name text,
  phone text,
  email text,
  event_name text,
  event_date date,
  expected_budget numeric,
  status text,           -- new|contacted|negotiating|blocked|confirmed|dead
  assigned_manager_id text,
  lead_id text,          -- Mongo Lead._id link
  task_id text,
  dead_reason text,
  metadata jsonb,
  created_at, updated_at
);

artist_gigs (
  id uuid PK,
  artist_id text NOT NULL,
  inquiry_id uuid FK nullable,
  name text,
  location text,
  gig_date date,
  rate numeric,
  expense numeric,
  profit numeric GENERATED,
  invoice_id text,
  contract_id uuid,
  payment_status text,   -- pending|partial|paid
  created_at, updated_at
);

artist_finance_entries (
  id uuid PK,
  artist_id text NOT NULL,
  type text,             -- revenue|expense
  category text,
  amount numeric,
  entry_date date,
  description text,
  document_id text,      -- link to finance OCR doc
  gig_id uuid FK nullable,
  created_at
);

artist_calendar_events (
  id uuid PK,
  artist_id text NOT NULL,
  event_type text,       -- inquiry|gig|release|personal|dead
  title text,
  start_at timestamptz,
  end_at timestamptz,
  color text,
  source_type text,      -- inquiry|gig|manual|release
  source_id text,
  metadata jsonb
);

artist_contracts (...);
artist_payments (...);
artist_activity_log (...);
artist_content_releases (...);
```

### MongoDB (keep)

- `Artist`, `ArtistMetrics`, `ArtistConnection`, `ArtistAuth` — unchanged
- Add optional `demographicsSnapshots` subdoc on `ArtistMetrics` for IG/YT audience breakdowns

---

## API Design (new routes)

Prefix: `/api/artists/:artistId/os/`

| Method | Path | Phase |
|--------|------|-------|
| GET | `/overview` | 1 — aggregated KPIs |
| GET/POST/PATCH | `/inquiries` | 1 |
| GET/POST/PATCH | `/gigs` | 1 |
| GET/POST | `/finance` | 1 |
| GET | `/calendar?from&to` | 1 — merged events |
| GET | `/timeline` | 2 |
| GET/POST | `/contracts` | 2 |
| GET | `/analytics/scores` | 3 |
| GET | `/analytics/demographics` | 4 |
| GET | `/content` | 4 |

**Webhook extension:** `processArtistEnquiryLogic` also inserts `artist_inquiries` when artist maps to Mongo `Artist._id`.

---

## Share-Link Artist Onboarding

**URL:** `/preview/artist/:id?token=JWT`

| Step | Actor | Action |
|------|-------|--------|
| 1 | Manager | Share link from Artist OS |
| 2 | Artist | Opens link (no login required to view) |
| 3 | Artist | Sign in → Claim workspace (`POST /claim`) |
| 4 | Artist | Connect Spotify / YouTube / Instagram via OAuth buttons |
| 5 | System | Sync stats + store tokens on `ArtistConnection` |
| 6 | Manager | Sees connected platforms + operational tabs populate |

**UX principles for artists:**

- No jargon — "Connect Spotify" not "OAuth credential"
- Progress checklist always visible in preview
- Hide finance/gigs edit from artist role until `artist.team` role permissions defined

---

## Phase Roadmap

### Phase 1 — Operations core (4–6 weeks)

- [x] UI: Tabbed Artist OS shell + Command Center scaffold
- [ ] Supabase schema + migration
- [ ] API: inquiries, gigs, finance, calendar merge
- [ ] Webhook: artist-enquiry → ArtistInquiry
- [ ] Calendar tab with real merged events
- [ ] Finance tab wired to per-artist entries

### Phase 2 — Documents & payments (2–3 weeks)

- Invoice upload per artist (reuse OCR)
- Contract entity + document storage
- Payment status on gigs
- Team notes tab

### Phase 3 — Analytics consolidation (1–2 weeks)

- Move existing analytics into tab (done in scaffold)
- Unified Artist Score computation
- Timeframe filtering on history charts

### Phase 4 — Intelligence (ongoing)

- Release → growth → inquiry → revenue correlation
- Demographics snapshots (Meta/YouTube)
- AI insights / forecasting

---

## Parallel Agent Workstreams

| Agent | Owns |
|-------|------|
| **Backend OS** | Supabase schema, `/api/artists/:id/os/*`, webhook extension |
| **Frontend OS** | Tab panels, Command Center data wiring |
| **Calendar** | Event merge service + calendar UI |
| **Finance bridge** | Artist-scoped finance entries + OCR link |
| **Onboarding** | Preview flow, OAuth UX, claim polish |
| **Analytics+** | Scores, demographics, content correlation |

Sync via `docs/ARTIST_OS_AGENT_SYNC.md`.

---

## What We Need From You

1. **Supabase project** — URL, anon key, service role key, decision: same project as other TSC data or dedicated Artist OS schema
2. **Artist ↔ enquiry mapping** — Confirm how website `artist` field maps to roster artists (today: project aliases YUGM, Harshad & Duhita via `ARTIST_ENQUIRY_PROJECT_MAP`)
3. **Finance source of truth** — Are gig rates entered manually or imported from existing Finance module / Basecamp invoices?
4. **Meta Business permissions** — Instagram demographics need `instagram_manage_insights` + Business/Creator IG linked to Facebook Page
5. **YouTube Analytics API** — Enable in Google Cloud for watch time + demographics (beyond Data API v3 channel stats)
6. **Artist role permissions** — What can claimed artists see/edit vs managers only?
7. **Currency & tax** — INR only? GST on invoices?
8. **Migration** — Import historical gigs/inquiries from sheets/CRM or start fresh?

---

## Risks

- **Dual DB complexity** — Use Mongo `artistId` as foreign key text in Postgres; single API layer hides split
- **Breaking analytics** — Analytics tab must remain feature-parity during refactor
- **Enquiry duplication** — Dedupe by `lead_id` on inquiry insert
- **Spotify quota** — Demographics not available from Spotify; focus IG/YT

---

## File Map (Phase 1)

| Action | Path |
|--------|------|
| Create | `client/src/pages/artists/ArtistOSLayout.jsx` |
| Create | `client/src/pages/artists/os/*.jsx` |
| Modify | `client/src/pages/artists/ArtistDetail.jsx` |
| Create | `server/domains/artists/os/` (Phase 1b backend) |
| Extend | `server/domains/artists/services/artistEnquiryService.js` |
