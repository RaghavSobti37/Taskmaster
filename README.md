# CoreKnot

Multi-tenant operations platform for [The Shakti Collective](https://theshakticollective.in): projects, CRM, mail campaigns, finance, attendance, Artist OS, and admin tooling. One Express API, one React SPA, MongoDB primary.

**Version:** 1.0.7 · **Node:** ≥18 · **Package root:** `coreknot/Taskmaster`

---

## What you're looking at

```
client/           React 18 + Vite 5 + Tailwind v4 (PWA)
server/           Express + Mongoose (primary API)
nestjs-server/    NestJS + Prisma strangler (Postgres path)
shared/           Cross-runtime rules (task review, attendance, inlets)
packages/         design-tokens, ui-components, sync-client
docs/             Human docs — start at docs/DOCUMENTATION_INDEX.md
.specify/memory/  Agent memory — start at .specify/memory/INDEX.md
```

**Canonical page reference (every route, hook, API string):** [`docs/reference/COREKNOT_MASTER.md`](docs/reference/COREKNOT_MASTER.md)  
Regenerate after large route changes: `node scripts/generate-page-inventory.mjs && node scripts/generate-master-doc.mjs`

---

## Architecture (production)

```
Browser → tsccoreknot.com (Vercel)
            ├─ static client/dist
            └─ /api/* → Render Express (same-origin cookie)
                    ├─ MongoDB Atlas
                    ├─ Redis / BullMQ
                    └─ Socket.IO
```

**Site modes** (`VITE_SITE_MODE`): `app` (workspace), `auth` (login on `auth.tsccoreknot.com`), `landing` (marketing). Session cookie domain `.tsccoreknot.com` when cross-subdomain auth is enabled.

**Auth:** Sliding JWT in HttpOnly cookie `coreknot_token_v3` (7d idle / 30d absolute). Optional Clerk + Google OAuth. Page access via department presets in `client/src/utils/pagePermissions.js`.

**Do not use** legacy API hostnames from old docs — production URLs live in gitignored `.cursor/production-hosts.local.json`.

---

## Local development

```bash
npm run install:all
cp server/.env.example server/.env    # MONGODB_URI, JWT_SECRET minimum
cp client/.env.example client/.env    # VITE_API_URL=http://localhost:5000
npm run preflight
npm run dev                           # API :5000 + client :5173
```

Full checklist: [`docs/operations/local-development.md`](docs/operations/local-development.md)  
Database notes: [`docs/operations/LOCAL_DEV_DATABASE.md`](docs/operations/LOCAL_DEV_DATABASE.md)

Optional seed:

```bash
cd server
node scripts/seedDepartmentsAndTaskTypes.js
node scripts/reconcileDataHub.js --full
```

---

## Verify before you push

```bash
npm test                              # server Jest
npm test --prefix client              # client Vitest
npm run build --prefix client         # production bundle
npm run audit:exposure                # secret scan (required)
```

E2E (optional): `npm run test:e2e:public` · auth flows need `E2E_EMAIL` + `E2E_PASSWORD`.

---

## Locked zones (read before editing)

| Area | Doc |
| --- | --- |
| Email open/click tracking | [`docs/reference/EMAIL_ENGINE_LOCKED.md`](docs/reference/EMAIL_ENGINE_LOCKED.md) |
| Brand mark + default spinner | [`docs/reference/LOGO_LOCKED.md`](docs/reference/LOGO_LOCKED.md) |
| Client UI | [`docs/design/DESIGN-REFERENCE.md`](docs/design/DESIGN-REFERENCE.md) |
| Legacy APIs | [`docs/architecture/LEGACY_FREEZE.md`](docs/architecture/LEGACY_FREEZE.md) |

---

## Deploy

| Surface | Host |
| --- | --- |
| Frontend | Vercel (`client/` or `sites/*` per mode) |
| API | Render web service |
| DB | MongoDB Atlas |

Env matrix: [`docs/operations/environments.md`](docs/operations/environments.md)  
Deploy checklist: [`docs/operations/deployment.md`](docs/operations/deployment.md)

Webhooks (replace API host):

```
POST /api/webhooks/book-call
POST /api/webhooks/artist-enquiry
```

---

## Documentation map

| Doc | Use when |
| --- | --- |
| [`docs/DOCUMENTATION_INDEX.md`](docs/DOCUMENTATION_INDEX.md) | Navigating all docs |
| [`docs/reference/COREKNOT_MASTER.md`](docs/reference/COREKNOT_MASTER.md) | Page-level truth |
| [`.specify/memory/INDEX.md`](.specify/memory/INDEX.md) | AI agents / memory hub |
| [`docs/features/artist-os.md`](docs/features/artist-os.md) | Artist OS routes + APIs |
| [`docs/auth/google-oauth.md`](docs/auth/google-oauth.md) | OAuth + app verification |
| [`docs/operations/SCRIPTS_RUNBOOK.md`](docs/operations/SCRIPTS_RUNBOOK.md) | Maintenance scripts |
| [`docs/reference/VERSION_HISTORY.md`](docs/reference/VERSION_HISTORY.md) | Release notes |

Contributing: [`CONTRIBUTING.md`](CONTRIBUTING.md) — no direct pushes to `main`; exposure audit must pass.

---

## Product scope (short)

- **Projects** — workspaces, tasks, peer review, analytics  
- **CRM** — leads, follow-ups, Exly bookings, artist pipeline  
- **Data Hub** — unified person graph (`/admin`)  
- **Mail** — campaigns, templates, Resend dispatch, engagement filters  
- **Finance** — documents, OCR, approvals  
- **HR** — attendance, daily logs, leave  
- **Artists** — Artist OS tabs, OAuth analytics, workspace membership  
- **Platform** — gamification, notifications, admin scripts, QA runner  

Feature detail: [`.specify/memory/features/modules.md`](.specify/memory/features/modules.md)

---

*Copyright © 2026 CoreKnot / The Shakti Collective.*
