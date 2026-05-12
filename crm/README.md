# TSC CRM

Next.js CRM for lead management, using Google Sheets via HolySheet as the primary database.

## Setup

1. Copy `.env.example` to `.env` and configure:
   - `HOLYSHEET_BASE_URL` – HolySheet API base (default: https://holysheet.soneshjain.com)
   - `HOLYSHEET_API_KEY` – API key from HolySheet dashboard
   - `CRM_ADMIN_EMAILS` – Comma-separated admin emails (for non-demo auth)
   - `CRM_DEMO_AUTH=1` – Enables demo login for development
   - `CRM_WEBHOOK_SECRET` – Optional secret for webhook lead ingestion

2. Create a Google Spreadsheet with tabs `Leads`, `EMI_Tracking`, `Audit_Log` and column headers per `HOLYSHEET_SCHEMA.md`.

3. Register the spreadsheet in HolySheet and link an API key.

## Run

```bash
npm run dev    # http://localhost:3000
npm run build && npm start
```

## Features

- **Multi-tenant access**: Sales reps see only their leads; admins see all.
- **Lead management**: Name, email, phone, webinar dates, attended/duration, funnel fields, remarks.
- **Sales funnel enums**: Meaningful Connect, Lead Quality, Call Status, Lead Status, Plan Option.
- **Row locking**: Basic protection against concurrent edits (5-min lock).
- **Form validation**: Email and phone validation.
- **Audit log**: Records `lead_status` changes to `Audit_Log` sheet.
- **Webhook**: `POST /api/webhook/leads` for ingesting leads from external systems (header: `x-webhook-secret`).

## Port

The CRM runs on port 3000 by default. Use `-p` to change:

```bash
npm run dev -- -p 3001
```
