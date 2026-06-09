# CoreKnot — project overview

**Version:** 1.0.7  
**Product:** Multi-tenant CRM & operations hub for The Stage Company (TSC).

## Stack

| Layer | Tech |
| --- | --- |
| Frontend | React 18, Vite, TanStack Query, Tailwind 4, PWA |
| Backend | Express, MongoDB (Mongoose), Redis/BullMQ, Socket.IO |
| Deploy | Vercel (SPA), Render (API), Atlas (DB) |
| Email | Resend + SMTP profiles, locked tracking engine |

## Tenancy

- Tenant plugin scopes queries by `tenantId`.
- Platform admin via `ROOT_ADMIN_USER_IDS` / MongoDB `PlatformSettings` — not hardcoded emails.

## Security gates

- `npm run audit:exposure` — before every commit
- `npm run audit:deadcode` — orphan module scan
- Production URLs in gitignored `.cursor/production-hosts.local.json` only

## Key docs

- `docs/PROJECT_MEMORY.md` — full architecture
- `docs/EMAIL_ENGINE_LOCKED.md` — frozen mail tracking
- `docs/LOGO_LOCKED.md` — brand mark + spinner
- `docs/DATA_MASTER_ARCHITECTURE.md` — Person golden record

## Artist CRM ops (local → prod)

CSV files live in gitignored/local `data/` (not in repo). To seed production:

```bash
# From server/ — set MONGODB_URI to prod URI (MONGODB_URI_PROD in .env)
node scripts/fixLeadEmailIndex.js
node scripts/seedArtistCrmFromData.js
node scripts/reassignBookedCallsToAkash.js
```

Booking test: `node scripts/testArtistBookingWebhook.js`
