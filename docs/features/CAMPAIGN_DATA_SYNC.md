# Campaign data sync — AiSensy & Exly

How to get **existing** WhatsApp (AiSensy) and course/booking (Exly) campaign data into CoreKnot.

---

## AiSensy (WhatsApp)

| Method | Scope | Steps |
|--------|-------|-------|
| **Connected Apps + webhooks** | Forward-looking | Settings → Connected Apps → AiSensy → Connect. Paste webhook URL + verify token into AiSensy. Delivery events → CRM lead tags + Data Hub mail inlet. |
| **Project API (catalog)** | Campaign names, status, audience size | `AISENSY_PROJECT_ID` + `AISENSY_PROJECT_API_PWD` in server `.env` → Data Hub **Sync AiSensy catalog** or `npm run sync:aisensy-catalog:prod --prefix server -- --execute`. No per-phone rows. |
| **CSV import** | Historical per-recipient outcomes | AiSensy dashboard → export campaign CSV → Data Hub → **Import WA Campaign** (or `POST /api/data-hub/campaign-outcomes/import`). |
| **CLI** | Bulk / prod | `npm run import:aisensy-campaign:prod --prefix server -- --file=/path/to/export.csv --execute` |

Per-phone delivery history is **not** on AiSensy Project API — use CSV export per segment (failed/delivered/read) or webhooks going forward.

Operator setup: [`AISENSY.md`](./AISENSY.md).

---

## Exly (offerings & bookings)

Exly is **not** a Connected Apps card. It uses server env credentials and admin UI sync.

### Prerequisites

```env
EXLY_API_KEY=...
EXLY_API_URL=https://api.exly.com   # optional override
```

### Sync in UI

1. Open **Admin → Exly** (`/admin/exly`) or **Exly Campaigns** (`/admin/exly-campaigns`) or **CRM → Bookings**.
2. Click **Sync** (calls `POST /api/exly/sync`).
3. CoreKnot upserts offerings, bookings, CRM leads, and offering metrics.

### What sync does

`exlyService.syncAll()`:

- Fetches all offerings + bookings from Exly API
- Upserts `ExlyOffering` / `ExlyBooking`
- Creates/updates CRM leads (dedupe by email/phone)
- Recalculates offering analytics

### Webhook (real-time)

Configure Exly to POST to your CoreKnot webhook endpoint with `EXLY_WEBHOOK_SECRET` for signed payloads (`exlyController.handleExlyWebhook`).

---

## Related

- [`CONNECTED_APPS_AND_INTAKE.md`](./CONNECTED_APPS_AND_INTAKE.md) — integrations hub (no plan paywalls)
- [`AISENSY.md`](./AISENSY.md) — WhatsApp operator setup
- `server/services/exlyService.js` — Exly sync implementation
- `server/services/aisensyCampaignImportService.js` — AiSensy CSV import
