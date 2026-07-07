# Website Forms

Embed contact forms on any website → CoreKnot CRM.

> **In-depth guide:** [`CONNECTED_APPS_AND_INTAKE.md`](./CONNECTED_APPS_AND_INTAKE.md)

## Admin setup

1. **Developers → Website Forms** (`/:orgSlug/developers`) — create form, add allowed origins (`https://yoursite.com`, `http://localhost:3000`).
2. Copy **embed snippet** or **LLM agent prompt** for your site codebase.
3. Submissions appear in **CRM → Leads** with source from form defaults (default: `Website Form`).

## Public API

```
POST /api/public/forms/:publishableKey/submit
Content-Type: application/json

{ "name", "email", "phone", "message", "company" }
```

- **Auth:** `ckf_live_*` publishable key in URL (safe in browser).
- **CORS:** browser `Origin` must match form `allowedOrigins`.
- **Honeypot:** hidden `_gotcha` field must be empty.
- **Duplicates:** upserts by email/phone (unlike Public API `POST /api/v1/leads`).

## Embed script

```html
<script src="https://<api-host>/embed/coreknot-form.js"
        data-form-key="ckf_live_..."
        data-target="#contact-form"></script>
```

Optional `data-api-base` when API host differs from script host.

## Intake methods compared

| Method | Browser-safe key? | Use when |
|--------|-------------------|----------|
| Website Forms | Yes (`ckf_live_*`) | Marketing site contact forms |
| Inbound webhook | No (HMAC secret) | Zapier, server backend |
| Public API | No (`ck_live_*` Bearer) | Custom integrations |

## Code

- Model: `server/domains/forms/models/WebsiteForm.js`
- Admin API: `/api/forms`
- Public submit: `server/routes/publicFormRoutes.js`
- Embed: `server/public/embed/coreknot-form.js`
- Tests: `server/tests/websiteFormPublic.test.js`

## Local demo

`npm run seed:local-integrations-demo` creates two sample forms per tenant — see [`../operations/LOCAL_DEV_DEMO_DATA.md`](../operations/LOCAL_DEV_DEMO_DATA.md).
