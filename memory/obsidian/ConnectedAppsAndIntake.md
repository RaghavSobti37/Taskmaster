# ConnectedAppsAndIntake

**Deep doc:** `coreknot/Taskmaster/docs/features/CONNECTED_APPS_AND_INTAKE.md`

## UI

- Connected Apps: `/:orgSlug/settings?tab=integrations`
- Developers (forms/webhook/API keys): `/:orgSlug/developers`

## Providers (trimmed set)

Gmail, Resend, Google Sheets, Inbound Webhook, AiSensy — registry `server/config/integrationProviders.config.js`

## Intake methods

| Method | Key type | Route |
|--------|----------|-------|
| Website Forms | `ckf_live_*` | `POST /api/public/forms/:key/submit` |
| Inbound webhook | HMAC secret | Integration hub provisioned URL |
| Public API | `ck_live_*` Bearer | `POST /api/v1/leads` |

Forms upsert leads; Public API creates only.

## Local demo seed

```bash
npm run seed:local-integrations-demo   # from coreknot/Taskmaster
```

## Code roots

- `server/domains/integrations-hub/`
- `server/domains/forms/`
- `server/routes/publicFormRoutes.js`
- `server/public/embed/coreknot-form.js`
- `client` — `IntegrationsTab`, `IntegrationDetailDrawer`, `DevelopersPage`
