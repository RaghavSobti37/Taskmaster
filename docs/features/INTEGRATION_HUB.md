# Integration Hub

Per-tenant **Connected Apps** — OAuth and API-key connectors for email, marketing, CRM, and custom webhooks.

## Architecture

- Registry: `server/config/integrationProviders.config.js`
- Domain: `server/domains/integrations-hub/`
- Model: `TenantIntegration` (encrypted credentials, tenant-scoped)
- API: `/api/integrations/*`

## Adding a provider

1. Add entry to `integrationProviders.config.js` (`id`, `category`, `authType`, `capabilities`, `planMin`).
2. Create `adapters/<provider>Adapter.js` with `handleCallback` / `handleApiKeyConnect`, `healthCheck`, optional `syncContacts`.
3. Register in `adapters/adapterRegistry.js`.
4. If CRM/marketing ingest: add inlet key in `shared/dataInlets.js` and route through `PersonIdentityService`.

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
| Mailchimp | `MAILCHIMP_CLIENT_ID`, `MAILCHIMP_CLIENT_SECRET` |
| HubSpot | `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET` |
| Salesforce | `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET` |
| Slack | `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` |

## Campaign Gmail OAuth

Set `campaign.sendViaGmail: true` or `EmailProfile.providerType: 'gmail_oauth'` to send via connected Gmail integration.
