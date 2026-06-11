---
name: resend-email-debug
description: >-
  Debugs CoreKnot email send failures and analytics mismatches by reconciling
  MongoDB MailEvent/CampaignRecipient state with Resend API logs. Use when
  emails show Failed in app but Resend looks clean, announcement/campaign
  partial failures, rate limit errors, or geo/location breakdown wrong.
---

# Resend Email Debug (CoreKnot)

**Email engine logic is LOCKED** — fix dispatch/rate-limit/retry around it; don't change tracking/geo without unlock.

## Reconcile app vs Resend

| Symptom | Likely cause | Check |
|---------|--------------|-------|
| App `Failed`, Resend clean | Error stored at send time; Resend never got request OR different message ID | `MailEvent` / campaign recipient `error` field |
| Partial batch fail | Resend **2 req/sec** rate limit | `announcementRoutes.js` loop — no throttle |
| Wrong city in campaign | Locked geo rules | `docs/EMAIL_ENGINE_LOCKED.md` — read before "fixing" geo |

## Debug workflow

```
1. Identify campaign/announcement ID + timestamp
2. Query DB: recipient rows + error strings
3. Resend MCP/logs: same window, same from-address
4. Root cause: rate limit | invalid payload | auth | app bug vs provider lag
5. Fix dispatch layer only if locked engine untouched
```

## Key files (read-only for tracking)

- `server/routes/announcementRoutes.js` — announcement loop
- `server/routes/campaignRoutes.js` — campaign send
- `server/utils/emailTracker.js` — **LOCKED**
- `server/models/MailEvent.js` — **LOCKED** fields

## Rate limit fix pattern

Throttle Resend calls: ≥500ms between sends or batch API if available. Add retry on 429 with backoff.

## Tracking base URL

Must match `derived.trackingBaseUrl` from `.cursor/production-hosts.local.json`.
