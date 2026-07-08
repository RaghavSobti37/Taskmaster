# Integration Hub

Per-tenant **Connected Apps** — OAuth and API-key connectors for email, data import, WhatsApp, and server intake.

> **In-depth guide:** [`CONNECTED_APPS_AND_INTAKE.md`](./CONNECTED_APPS_AND_INTAKE.md)

## Supported providers

| Provider | Category | Purpose |
|----------|----------|---------|
| Gmail | Email | Send campaigns via OAuth |
| Resend | Email | Tenant API key for outbound mail |
| Google Sheets | Data | Import rows into CRM leads |
| AiSensy | WhatsApp | Send campaigns + delivery webhooks → Data Hub |
| Inbound Webhook | Intake | HMAC-signed server POST → CRM |

Registry: `server/config/integrationProviders.config.js`

Non-essential providers were removed from the registry in July 2026 — only the five above ship in UI.

**No plan paywalls** — every provider is connectable on any org plan. Only blockers: missing server OAuth env (Gmail/Sheets) or invalid API keys.

## UI & API

| Surface | Path |
|---------|------|
| Settings tab | `/:orgSlug/settings?tab=integrations` |
| REST API | `/api/integrations/*` |
| Domain code | `server/domains/integrations-hub/` |
| Model | `TenantIntegration` (encrypted credentials, tenant-scoped) |

## Architecture

- Connect / disconnect / settings per provider
- `IntegrationDetailDrawer` — Google Sheets worksheet mapping + sync
- `mailDriver` prefers Gmail OAuth, else tenant Resend key, else platform `RESEND_API_KEY`
- Inbound webhook: provision URL + HMAC secret (one-time display on connect)

## Website Forms (browser embed)

See [`WEBSITE_FORMS.md`](./WEBSITE_FORMS.md) — publishable-key embed for marketing sites. Developers UI: `/:orgSlug/developers`.

## Inbound webhook payload

```json
{
  "event": "lead.ingest",
  "person": { "email": "a@b.com", "phone": "+91...", "name": "Ada" },
  "lead": { "source": "Landing page", "status": "New" }
}
```

Sign with HMAC-SHA256 using the provisioned secret; send header `X-CoreKnot-Signature`.

## Outbound events

See `TENANT_WEBHOOK_EVENTS` in provider config. Configure in **Settings → Developers**.

## Env vars (OAuth)

| Provider | Variables |
|----------|-----------|
| Gmail / Google Sheets | `INTEGRATIONS_GOOGLE_CLIENT_ID`, `INTEGRATIONS_GOOGLE_CLIENT_SECRET` (fallback: `GOOGLE_CLIENT_ID`) |

## Campaign Gmail OAuth

Set `campaign.sendViaGmail: true` or `EmailProfile.providerType: 'gmail_oauth'` to send via connected Gmail integration.

## Local dev demo data

```bash
npm run seed:local-integrations-demo
```

See [`../operations/LOCAL_DEV_DEMO_DATA.md`](../operations/LOCAL_DEV_DEMO_DATA.md).

## Related

- [`AISENSY.md`](./AISENSY.md) — WhatsApp operator setup
- [`../operations/KNOWLEDGE_ENGINE_REMOVAL.md`](../operations/KNOWLEDGE_ENGINE_REMOVAL.md) — KE bridge removed
