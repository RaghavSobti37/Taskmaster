# CoreKnot Mismatch Audit - 2026-07-06

Static audit covering code, docs, config, and API contracts for `coreknot/Taskmaster`.

## Resolution Status

| Area | Status | Notes |
| --- | --- | --- |
| OTP `/relegends` | Fixed | Auth/app routes now redirect legacy OTP slug to `/login`; no live page calls missing `/api/otp/*`. |
| `/developers` permissions | Fixed | Route and nav map require `admin_developers`; OpenAPI/dev docs now align with enterprise API gate. |
| Nest sync prefix | Fixed | `SyncController` uses `v1/sync`; global Nest prefix serves `/api/v1/sync/token`. |
| Email streams | Fixed | Streams page consumes existing `GET /api/mail/streams`; removed unused CRUD hooks for nonexistent stream mutations. |
| CSV importer | Fixed | Orphan importer now targets `POST /api/crm/leads/upload` with multipart `file`. |
| Attendance hook | Fixed | Removed orphan `PUT /api/attendance/:id` hook; live upsert path remains `/api/attendance/upsert/by-user-date`. |
| OpenAPI | Fixed | Removed ghost `/mail/campaigns`; added public `/v1/leads` endpoints and tenant API-key auth. |
| Generated page catalog | Fixed | Added developers, org create success, org choose, org picker/invite routes; management hub includes documents. |
| Debug localhost ingest | Fixed | Removed `127.0.0.1:7593` debug posts from server production paths. |
| Broken doc links | Fixed | Corrected operations and memory links for moved docs. |
| Preview/prod CORS docs | Reconciled | `render.yaml` comment now states explicit prod-preview mode; `environments.md` still instructs preview `VITE_API_URL` to staging. |

## Still Intentional / Not Fixed In This Pass

| Area | Reason |
| --- | --- |
| Workflow canvas backend | Product stub remains outside this reconciliation. |
| Knowledge Engine placeholder ranks | **Resolved:** KE removed from CoreKnot 2026-07-07 — see `docs/operations/KNOWLEDGE_ENGINE_REMOVAL.md`. |
| Artist integrations marked coming soon | Tests currently encode 501/stub behavior; feature build is separate. |
| Tenant security remaining work | Tracked in `docs/architecture/TENANT_SECURITY_PHASE.md` and production readiness docs. |
| Public enterprise sales docs (DPA/SOC2 stubs) | Tracked as enterprise readiness follow-up. |

## Verification Bundle

Required before marking memory complete:

```bash
npm test --prefix client
npm test --prefix server
npm run build --prefix client
```

Memory/ledger pass must be recorded with:

```bash
node .cursor/scripts/agent-memory-gate.mjs verify-and-patch \
  --ledger .cursor/loop-engineering/coreknot-mismatch-reconciliation-ledger.json \
  --patch '{"satisfaction":"pass"}' \
  -- "npm test --prefix coreknot/Taskmaster/client && npm test --prefix coreknot/Taskmaster/server && npm run build --prefix coreknot/Taskmaster/client"
```
