# Local dev — integrations & forms demo data

Use when Connected Apps or Website Forms look empty on local/staging without running a full prod sync.

---

## Quick start

```bash
cd coreknot/Taskmaster
npm run dev                    # API :5000 + client :5173
npm run seed:local-integrations-demo
node server/scripts/verifyLocalDevDemoSeed.js
```

Open:

- `http://localhost:5173/tsc/settings?tab=integrations` (adjust org slug)
- `http://localhost:5173/tsc/developers`

---

## What the seed creates

**Per active tenant:**

| Artifact | Count | Notes |
|----------|-------|-------|
| Gmail integration | 1 | Dummy OAuth tokens — UI only |
| Resend integration | 1 | Dummy API key shape |
| Google Sheets | 1 | Dummy sheet mapping |
| Inbound Webhook | 1 | Dummy HMAC secret |
| AiSensy | 1 | Dummy API + webhook secrets |
| Website forms | 2 | Default source `Website Form`, localhost-friendly origins |

**Idempotent:** safe to re-run; upserts by tenant + provider/form name.

---

## Scripts

| Command | File |
|---------|------|
| `npm run seed:local-integrations-demo` | `server/scripts/seedLocalDevIntegrationsDemo.js` |
| Verify | `server/scripts/verifyLocalDevDemoSeed.js` |

---

## Prerequisites

- MongoDB reachable (`MONGODB_URI` → typically `taskmaster_local`)
- At least one **active** tenant document
- API not required for seed (script uses Mongoose directly)

---

## Windows note

Use **`http://localhost:5173`** not `127.0.0.1` — Vite dev server may listen on IPv6 only.

---

## Related

- [`local-development.md`](./local-development.md) — full stack setup  
- [`LOCAL_DEV_DATABASE.md`](./LOCAL_DEV_DATABASE.md) — prod → local sync (`sync:prod-tenant-tsc`)  
- [`../features/CONNECTED_APPS_AND_INTAKE.md`](../features/CONNECTED_APPS_AND_INTAKE.md) — architecture  

---

*Last updated: 2026-07-07*
