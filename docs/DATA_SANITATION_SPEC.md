# CoreKnot Data Sanitation & Normalization Specification

**Status:** Implemented (server)  
**Code:** `server/utils/sanitizer.js`, `server/utils/personNormalization.js`, `server/utils/leadValidation.js`  
**Backfill:** `server/scripts/normalizePersonData.js`

## Principles

1. **Reject at boundary** — invalid payloads return HTTP 400 with a clear field error.
2. **Normalize once** — all writes use shared helpers; no ad-hoc `.trim()` in controllers.
3. **Canonical identity** — people dedupe on **email** (lowercase) and **phone** (E.164 per `validatePhoneE164`).
4. **Display vs match** — `name` is title-cased for UI; `nameKey` is lowercase alphanumeric for duplicate *reports* (not a unique index alone).
5. **Ingress parity** — UI, CSV, webhooks, Exly, HolySheet, and Data Hub use the same pipeline.
6. **No auto-merge** — backfill normalizes in place and reports duplicate groups; merges are manual in CRM.

## Global functions

| Function | Purpose |
|----------|---------|
| `sanitizeName` | Strip HTML, collapse whitespace, reject placeholders |
| `normalizePersonName` | Title-case → `{ name, nameKey }` |
| `sanitizeEmail` | Lowercase, strip control chars |
| `validatePhoneE164` | Strict country digit rules |
| `repairPhone` | Legacy corrupt / concatenated numbers (backfill + pre-save fallback) |
| `sanitizeLocation` | Lowercase city/location, strip punctuation |
| `normalizePersonRecord` | Full pipeline → normalized fields + `errors[]` |

## Collections

| Model | Dedup keys | `nameKey` |
|-------|------------|-----------|
| Lead | `(tenantId, phone)` unique; `(tenantId, email)` sparse unique | indexed |
| Contact | merge by email OR phone in `ContactService` | indexed |
| TscData | `(phone, email)` unique | indexed |
| ExlyBooking | compound + transactionId | indexed |

## Ingress map

| Source | Entry |
|--------|--------|
| CRM API | `crmController.normalizeLeadInput` → `leadValidation` |
| LeadService | `normalizePersonRecord` |
| CSV import | `importWorker` — skip invalid rows |
| Book-call webhook | `webhookController` — sanitize before `findOne` |
| Exly | `exlyService`, `exlyController` |
| TSC import | `tscController` |
| Data Hub | `ContactService.mergeContact` |
| HolySheet booked calls | `bookedCallsSyncService` |
| Auth register | `normalizePersonName` on User.name |

**Locked:** email tracking / geo files — see `docs/EMAIL_ENGINE_LOCKED.md`.

## Local backfill

```bash
cd server
npm run normalize:person-data          # dry-run + duplicate report
npm run normalize:person-data:execute  # write + repairCorruptLeadPhones
npm run repair:phones                  # corrupt phone repair only
```

Reports: `server/reports/normalize-person-data-*.json`

## Duplicate reports (no auto-merge)

- **Definite:** same `tenantId` + `phone` or `email`
- **Probable:** same `tenantId` + `nameKey` (length ≥ 3)

Resolve duplicates manually in `/leads` or Data Hub after review.
