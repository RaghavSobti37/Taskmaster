# Artist OS

> **Status:** Complete (Phases 1–4, MongoDB) · **Last updated:** 2026-07-02  
> **Merged from:** `ARTIST_OS_PLAN.md`, `ARTIST_OS_PHASE1_IMPLEMENTATION.md`, `ARTIST_OS_COMPLETE.md`, `ARTIST_OS_AGENT_SYNC.md`

Artist OS turns `/artists/:id` from analytics-only into a daily operations workspace for managers and artists.

---

## Routes & pages

| Route | Component | Access |
| --- | --- | --- |
| `/management?tab=artists` | `ArtistsCollection` | `artists` permission |
| `/artists/:id?tab=<tab>` | `ArtistDetail` → `ArtistOSLayout` | `artists` |
| `/preview/artist/:id/*` | `ArtistDetail` (`isPreview`) | Share token |
| `/artist/:slug` | `ArtistPublicProfile` | Public |
| `/artist-workspace/:id/*` | `ArtistWorkspaceShell` | Membership |
| `/artists/portfolio` | `PortfolioDashboard` | `artists` |

### Tabs (`?tab=` URL param)

| Tab | Component file | Purpose |
| --- | --- | --- |
| `overview` | `os/ArtistOverviewPanel.jsx` | Command center KPIs, activity timeline |
| `calendar` | `os/ArtistCalendarTab.jsx` | Merged events (inquiries, gigs, releases) |
| `inquiries` | `os/ArtistInquiriesTab.jsx` | Booking pipeline |
| `gigs` | `os/ArtistGigsTab.jsx` | Confirmed shows, P&L per gig |
| `finance` | `os/ArtistFinanceTab.jsx` | Per-artist revenue/expense |
| `analytics` | `os/ArtistAnalyticsTab.jsx` | Spotify / YouTube / Meta |
| `content` | `os/ArtistContentTab.jsx` | Releases + correlation |
| `contracts` | `os/ArtistContractsTab.jsx` | Contract lifecycle |
| `team` | `workspace/ArtistTeamTab.jsx` | Team notes / membership |

Legacy: `/artists/:id/analytics/:platform` → redirect to `?tab=analytics&platform=`.

---

## Backend (MongoDB)

### Models

`ArtistInquiry`, `ArtistGig`, `ArtistFinanceEntry`, `ArtistCalendarEvent`, `ArtistActivityLog`, `ArtistContract`, `ArtistTeamNote`, `ArtistContentRelease`

### API prefix

```
GET|POST|PATCH|DELETE  /api/artists/:id/os/overview
GET|POST|PATCH         /api/artists/:id/os/inquiries
GET|POST|PATCH         /api/artists/:id/os/gigs
GET|POST|PATCH         /api/artists/:id/os/finance
GET|POST               /api/artists/:id/os/calendar
GET                    /api/artists/:id/os/timeline
GET|POST|PATCH         /api/artists/:id/os/contracts
GET|POST|PATCH         /api/artists/:id/os/notes
GET                    /api/artists/:id/os/analytics/scores
```

### Webhooks

`POST /api/webhooks/artist-enquiry` — creates `ArtistInquiry` when roster artist resolves (extends lead + task flow).

### Business rules

- Inquiry status **Confirmed** can auto-create gig
- Finance entries roll into Overview MTD KPIs
- Content releases correlate with Spotify growth from `analyticsHistory`
- Preview mode shows onboarding checklist (`ArtistConnectOnboarding.jsx`)

---

## Tests

```bash
cd server && npm test -- artistOs.test.js
```

Expected: 4/4 pass.

---

## Manual verification

1. `npm run dev`
2. `/management?tab=artists` → open artist
3. Overview: add finance entry → KPIs update
4. Inquiries: confirm → gig created
5. Calendar: merged events visible
6. Analytics: sync + score cards
7. Content: add release → correlation after sync history
8. Share link `/preview/artist/:id` → onboarding on Overview

---

## Not in scope (future)

- Supabase operational mirror (Mongo sufficient today)
- Meta/YouTube demographics (extended API permissions)
- Per-artist finance OCR (links to org Finance for now)
- AI forecasting

---

## Archive

Historical planning docs: [`../archive/ARTIST_OS_PLAN.md`](../archive/ARTIST_OS_PLAN.md)
