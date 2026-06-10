# Project overview

**CoreKnot** — multi-tenant CRM and operations hub (React + Express + MongoDB).

- **Frontend:** Vite React SPA on Vercel (`YOUR-VERCEL-APP`).
- **API:** Express on Render (`YOUR-RENDER-SERVICE`).
- **Primary DB:** MongoDB Atlas (prod + local on shared M0 cluster).
- **Secondary store:** Supabase Postgres + Storage — backups, log mirror, mail/CRM rollups (Jun 2026).
- **Email:** Resend dispatch, self-hosted open/click pixels, campaign analytics on `/campaign/:id`.

Production host truth: gitignored `.cursor/production-hosts.local.json`.
Supabase credentials: `server/.env` / Render Dashboard only — never commit.
