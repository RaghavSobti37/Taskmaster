# AiSensy (WhatsApp) — Connected Apps setup

## In CoreKnot

1. **Settings → Connected Apps → AiSensy → Connect**
2. Paste **API key** from AiSensy dashboard
3. Copy **one-time** values shown after connect:
   - Webhook URL
   - Verify token
   - Webhook secret
4. **Settings** (gear on card) → set **default campaign** names if needed

## In AiSensy dashboard

Configure webhook (names may vary by AiSensy UI version):

| Field | Value |
|-------|--------|
| Callback URL | `https://<your-api-host>/api/webhooks/aisensy` |
| Verify token | From CoreKnot connect modal |
| Secret / signature header | `x-webhook-secret` or `Authorization: Bearer <secret>` |

Subscribe to delivery events: sent, delivered, read, failed (and replies if available).

## Campaign names in CoreKnot

These flows call AiSensy by **campaign name** (must exist as approved templates in AiSensy):

| Flow | Campaign name |
|------|----------------|
| Booked call confirmation | `final_book_call_confirmation` |
| Rep booking alert | `sales_rep_new_booking_alert` |
| Artist path | `Confirmation TSC` (or `AISENSY_ARTIST_PATH_CAMPAIGN` env) |
| After first call | `call_completed` |

Set defaults in **AiSensy integration Settings** or keep env `AISENSY_DEFAULT_CAMPAIGN`.

## Env (server `.env`)

| Variable | Role |
|----------|------|
| `AISENSY_API_KEY` | JWT campaign key — send API + `campaign-details` |
| `AISENSY_PROJECT_ID` | Project id (JWT `id` field, not `clientId`) |
| `AISENSY_PROJECT_API_PWD` | Manage → Project API password (`X-AiSensy-Project-API-Pwd`) |

Connected Apps stores tenant `AISENSY_API_KEY` equivalent; project API vars are server-side for catalog sync.

## Data Hub

Outbound sends + webhook events sync to **Data Hub → Mail / WhatsApp** inlets.

## Syncing existing campaign data

CoreKnot does **not** pull a full campaign history list from AiSensy’s API. Use one of these paths:

| Path | When | How |
|------|------|-----|
| **Project API catalog** | All campaign metadata | Data Hub → **Sync AiSensy catalog** or `npm run sync:aisensy-catalog:prod --prefix server -- --execute` |
| **Webhooks (ongoing)** | After connect | Configure AiSensy callback → `POST /api/webhooks/aisensy`. New delivery events sync to CRM tags + Data Hub. |
| **CSV import (historical)** | One-time backfill | Export failed/delivered/read CSV from AiSensy → **Data Hub** → **Import WA Campaign**, or CLI: `npm run import:aisensy-campaign:prod --prefix server` with `--file=... --execute`. Campaign name inferred from filename when omitted. |
| **Outbound from CoreKnot** | New sends | Flows using `sendAiSensyMessage` log sends + outcomes automatically. |

See also [`CAMPAIGN_DATA_SYNC.md`](./CAMPAIGN_DATA_SYNC.md) for Exly + AiSensy overview.
