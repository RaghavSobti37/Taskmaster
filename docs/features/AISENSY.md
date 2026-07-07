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

## Legacy env vars (optional fallback)

If not using Connected Apps, server still reads:

- `AISENSY_API_KEY`
- `AISENSY_WEBHOOK_VERIFY_TOKEN`
- `AISENSY_WEBHOOK_SECRET`
- `AISENSY_DEFAULT_CAMPAIGN`

Connected Apps credentials take priority per tenant.

## Data Hub

Outbound sends + webhook events sync to **Data Hub → Mail / WhatsApp** inlets.
