# Platform Overview

**CoreKnot** is a multi-tenant CRM and operations hub for The Shakti Collective (TSC). It unifies six business lines — Films, Artists, Academy, Collabs, Studios, Corporate — into one workspace.

| Item | Value |
| --- | --- |
| **Product name** | CoreKnot (UI) / Taskmaster (repo folder) |
| **npm name** | `coreknot` |
| **Version** | `1.0.7` |
| **Primary users** | TSC staff — sales, operations, artist management, admin |

---

## What the platform does

| Domain | Capabilities |
| --- | --- |
| **Projects & tasks** | Workspaces, kanban tasks, peer review, @mentions, activity timeline, bug reporting |
| **CRM & sales** | Leads, follow-ups, booked calls, artist CRM, phone validation, Exly integration |
| **Data Hub** | Unified person/contact graph across multiple data inlets |
| **Data Master** | Person golden-record spine (`Person`, `PersonIdentifier`, `PersonHubView`) |
| **Email** | Campaigns, templates, HolySheet, raw HTML inline images + pre-upload crop, open/click tracking, newsletter, Resend dispatch |
| **Finance** | Document OCR, invoices, reimbursements, USD/INR, folder hierarchy |
| **HR / attendance** | Manual Office/WFH check-in, worked vs daily-log metrics, leave requests |
| **Artists** | Spotify/YouTube/Meta analytics, Artist Path questionnaire, booking enquiries |
| **Artist OS** | Per-artist command center, documents, finance, gigs, inquiries � department page keys + team access |
| **Gamification** | XP, levels, weekly leaderboard (Monday IST reset), missions |
| **Notifications** | In-app inbox, email, Web Push (VAPID), attendance checkout reminders |
| **Admin / ops** | System logs, QA runner (209+ cases), curated script runner, platform roles |
| **Assets** | File links + managed org accounts (emails, social IDs, platform logins) |

---

## Tech stack (one sentence)

**React/Vite PWA** on Vercel → same-origin `/api` proxy → **Express API** on Render → **MongoDB Atlas** (primary) + **Redis/BullMQ** + **Supabase Postgres** (secondary mirror) + **Socket.IO** realtime.

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite 5, Tailwind v4, TanStack Query 5, React Router 6 |
| Backend (production) | Node.js 18+, Express 4, Mongoose — `server/domains/` modular monolith |
| Backend (migration) | NestJS 11, Prisma — `nestjs-server/` (Strangler Fig, port 5001) |
| Primary DB | MongoDB Atlas |
| Secondary DB | Supabase Postgres + Storage (backups, logs, rollups) |
| Cache / queue | Redis (Render Key Value, **noeviction** for BullMQ) |
| Auth | HttpOnly JWT cookie (`coreknot_token_v3`), Google OAuth 2.0 |
| Email | Resend (campaigns), Gmail SMTP (password reset) |
| Deploy | Render (API), Vercel (static frontend CDN) |

---

## Brand (LOCKED)

- **Harmonic Frequency mark:** white hub + six spokes on brand green `#126d5e`
- **Loader:** `frl-v-02` fluid-ribbon cascade
- **Do not modify** without explicit unlock — see `docs/LOGO_LOCKED.md`

---

## Monorepo workspaces

```
client/           React SPA
server/           Express API (production today)
nestjs-server/    NestJS migration target
shared/contracts/ @coreknot/contracts — Zod API contracts
e2e/              Playwright specs
scripts/          Root audit/verify tooling
docs/             Long-form specs (email, logo, deploy, etc.)
```

---

## Secrets policy

Never store live URLs, Mongo URIs, or API keys in memory files. Production host truth: gitignored `.cursor/production-hosts.local.json`.
