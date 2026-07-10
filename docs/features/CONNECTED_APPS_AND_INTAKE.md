# Connected Apps & Lead Intake — In-Depth Guide

> **Audience:** engineers, operators, and agents implementing or debugging tenant integrations and external lead intake.  
> **Shorter references:** [`INTEGRATION_HUB.md`](./INTEGRATION_HUB.md) · [`WEBSITE_FORMS.md`](./WEBSITE_FORMS.md) · [`AISENSY.md`](./AISENSY.md)

---

## 1. Product overview

CoreKnot exposes **five connected app providers** under **Settings → Connected Apps** (`/:orgSlug/settings?tab=integrations`). Together with **Developers** (`/:orgSlug/developers`), they cover every supported path for getting people into CRM and Data Hub without custom server code.

| Intake path | Browser-safe? | Auth model | Typical use |
|-------------|---------------|------------|-------------|
| **Website Forms** (embed) | Yes (`ckf_live_*`) | Publishable key + per-form CORS | Marketing contact forms |
| **Inbound Webhook** | No | HMAC secret | Zapier, backend POST |
| **Public API** (`/api/v1/leads`) | No | Bearer `ck_live_*` | Custom integrations |
| **Google Sheets** | N/A (admin sync) | OAuth | Spreadsheet → leads |
| **Gmail / Resend** | N/A | OAuth / API key | Outbound mail only |
| **AiSensy** | N/A | API key + webhook secret | WhatsApp campaigns + events |

**Knowledge Engine** (SEO CMS) was **removed from CoreKnot** in July 2026. Archive: [`legacy/tsc-knowledge-engine`](../../../../legacy/tsc-knowledge-engine/). See [`../operations/KNOWLEDGE_ENGINE_REMOVAL.md`](../operations/KNOWLEDGE_ENGINE_REMOVAL.md).

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Client (React)                                                  │
│  IntegrationsTab · IntegrationDetailDrawer · DevelopersPage      │
└────────────┬───────────────────────────────┬────────────────────┘
             │ /api/integrations/*            │ /api/forms/*
             ▼                                ▼
┌────────────────────────────┐    ┌──────────────────────────────┐
│ integrations-hub domain     │    │ forms domain                  │
│ TenantIntegration model     │    │ WebsiteForm model             │
│ integrationProviders.config │    │ publicFormRoutes (no session) │
└────────────┬───────────────┘    └──────────────┬───────────────┘
             │                                    │
             ▼                                    ▼
        CRM Lead upsert                    CRM Lead upsert
        Data Hub inlets                    (source from form defaults)
        mailDriver (Gmail/Resend)
        aisensyAdapter
```

| Layer | Path |
|-------|------|
| Provider registry | `server/config/integrationProviders.config.js` |
| Hub domain | `server/domains/integrations-hub/` |
| Forms domain | `server/domains/forms/` |
| Public form submit | `server/routes/publicFormRoutes.js` |
| Embed asset | `server/public/embed/coreknot-form.js` |
| Admin routes mount | `server/app/registerRoutes.js` |

Credentials are stored encrypted on `TenantIntegration` (tenant-scoped). Never log decrypted secrets.

---

## 3. Supported providers (Connected Apps)

### 3.1 Gmail

- **Category:** Email  
- **Connect:** Google OAuth (`INTEGRATIONS_GOOGLE_CLIENT_ID` / `SECRET`, fallback `GOOGLE_CLIENT_ID`)  
- **Use:** Campaign send when `campaign.sendViaGmail: true` or `EmailProfile.providerType: 'gmail_oauth'`  
- **Preference:** Gmail OAuth wins over Resend when both connected for a tenant

### 3.2 Resend

- **Category:** Email  
- **Connect:** Tenant pastes **Resend API key** in Connected Apps  
- **Use:** `mailDriver` reads tenant key from integration when Gmail not preferred  
- **Platform fallback:** `RESEND_API_KEY` env still works when no tenant integration

### 3.3 Google Sheets

- **Category:** Data import  
- **Connect:** Google OAuth (same client as Gmail)  
- **Use:** `IntegrationDetailDrawer` — pick spreadsheet + worksheet; **Sync** runs `syncGoogleSheets` → CRM leads  
- **Adapter:** `googleSheetsAdapter` (list tabs, read rows, map columns)

### 3.4 Inbound Webhook

- **Category:** Intake  
- **Connect:** CoreKnot provisions URL + HMAC secret (shown once)  
- **Use:** Server POST with `X-CoreKnot-Signature` (HMAC-SHA256 body)  

### 3.5 AiSensy (WhatsApp)

- **Category:** Messaging  
- **Connect:** API key + webhook verify token + secret (one-time display)  
- **Inbound:** `POST /api/webhooks/aisensy`  
- **Outbound:** Campaign names must match AiSensy approved templates  
- **Data Hub:** delivery events → Mail/WhatsApp inlets  

Full operator steps: [`AISENSY.md`](./AISENSY.md).

---

## 4. Website Forms

### 4.1 Admin workflow

1. **Developers → Website Forms** — create form, name, default lead source/status.  
2. Add **allowed origins** (e.g. `https://yoursite.com`, `http://localhost:3000`).  
3. Copy **embed snippet** or **LLM agent prompt** for the external site repo.  
4. Submissions → **CRM → Leads** with dedupe by email/phone (upsert, unlike Public API create-only).

### 4.2 Public API

```
POST /api/public/forms/:publishableKey/submit
Content-Type: application/json

{ "name", "email", "phone", "message", "company" }
```

| Control | Behavior |
|---------|----------|
| Key | `ckf_live_*` in URL — safe in browser |
| CORS | `Origin` must match form `allowedOrigins` |
| Honeypot | Hidden `_gotcha` must be empty |
| Duplicates | Upsert by email/phone |

### 4.3 Embed script

```html
<script src="https://<api-host>/embed/coreknot-form.js"
        data-form-key="ckf_live_..."
        data-target="#contact-form"></script>
```

Optional `data-api-base` when API host differs from script CDN/host.

### 4.4 Tests

- `server/tests/websiteFormPublic.test.js` — submit, CORS, honeypot

---

## 5. Developers page layout

Route: `/:orgSlug/developers` (permission: `admin_developers`).

| Section | Purpose |
|---------|---------|
| **Website Forms** | Create forms, origins, embed + LLM prompt |
| **Inbound Webhook** | URL, secret, payload example |
| **API Keys** | Public API Bearer keys (`ck_live_*`) |

Intake comparison table lives in [`WEBSITE_FORMS.md`](./WEBSITE_FORMS.md).

---

## 6. Outbound tenant webhooks

Configure in **Settings → Developers** (outbound events). Event names: `TENANT_WEBHOOK_EVENTS` in `integrationProviders.config.js`. Used when CRM/mail actions should notify external systems.

---

## 7. Feature unlocks & permissions

**Billing / plan paywalls are disabled** — all Connected Apps providers can be connected on any org plan (`shared/planLimits.js`, `integrationService.js`). Plan tiers remain informational for future billing only.

- Integration hub still respects **page permissions** (`pagePermissions.js`) and org **feature toggles** (`featureUnlocks` in Settings → Organization) when an admin explicitly disables a module.  
- Generated matrix: `docs/.generated/feature-unlock-matrix.json`.  
- **Removed:** `knowledge-engine` feature key and `admin_knowledge_engine` page permission.

---

## 8. Local development

### 8.1 Run stack

```bash
cd coreknot/Taskmaster
npm run dev
```

| Service | URL (Windows) |
|---------|----------------|
| Client | `http://localhost:5173` |
| API | `http://localhost:5000` |

Use `localhost` on Windows — Vite may bind IPv6; `127.0.0.1` can fail.

### 8.2 Demo seed (integrations + forms)

When real tenant data is missing:

```bash
npm run seed:local-integrations-demo
```

Seeds **all active tenants** with:

- 5 connected integrations (Gmail, Resend, Google Sheets, Inbound Webhook, AiSensy) — dummy credentials only  
- 2 website forms per tenant  

Verify:

```bash
node server/scripts/verifyLocalDevDemoSeed.js
```

Full runbook: [`../operations/LOCAL_DEV_DEMO_DATA.md`](../operations/LOCAL_DEV_DEMO_DATA.md).

### 8.3 Pages to smoke-test

- `/:orgSlug/settings?tab=integrations` — Connected Apps cards  
- `/:orgSlug/developers` — Forms / Webhook / API keys  

---

## 9. Environment variables (summary)

| Variable | Used by |
|----------|---------|
| `INTEGRATIONS_GOOGLE_CLIENT_ID` / `SECRET` | Gmail + Google Sheets OAuth |
| `GOOGLE_CLIENT_ID` / `SECRET` | Fallback OAuth client |
| `RESEND_API_KEY` | Platform mail when tenant has no Resend integration |
| `AISENSY_*` | Legacy fallback when tenant AiSensy not connected |

---

## 10. Related docs

| Doc | Topic |
|-----|-------|
| [`INTEGRATION_HUB.md`](./INTEGRATION_HUB.md) | Hub API + webhook payload |
| [`WEBSITE_FORMS.md`](./WEBSITE_FORMS.md) | Forms API + embed |
| [`AISENSY.md`](./AISENSY.md) | WhatsApp operator setup |
| [`INTEGRATION_DATA_CATALOG.md`](./INTEGRATION_DATA_CATALOG.md) | Data Hub inlet mapping |
| [`../operations/KNOWLEDGE_ENGINE_REMOVAL.md`](../operations/KNOWLEDGE_ENGINE_REMOVAL.md) | KE removal log |
| [`../operations/LOCAL_DEV_DEMO_DATA.md`](../operations/LOCAL_DEV_DEMO_DATA.md) | Demo seed |
| [`../reference/COREKNOT_MASTER.md`](../reference/COREKNOT_MASTER.md) | All routes/pages |

---

*Last updated: 2026-07-07*
