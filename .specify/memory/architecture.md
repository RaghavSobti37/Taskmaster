# Architecture

## Stack

- **Client:** React 18 + Vite, TanStack Query, Socket.IO, CSS var design tokens.
- **Server:** Express, Mongoose, BullMQ/Redis, multi-tenant `tenantId` on models.
- **Deploy:** Render (API), Vercel (SPA); hosts in gitignored `.cursor/production-hosts.local.json`.

## API layout

- `/api/*` — REST; `protect` middleware + department/page permissions.
- Org accounts: `server/routes/orgAccountRoutes.js` → `orgAccountController` → `OrgAccount` model.
- Data Hub: `server/routes/dataHubRoutes.js` → person spine collections + reconcile.

## Data flows

- **Data Hub:** Domain inlets (leads, Exly, TSC, etc.) → reconcile → `people` / `personhubviews`.
- **Org accounts:** Google Sheets API (service account) → parse tabs → wipe + insert per tenant.
- **Prod sync:** `syncDataHubToProd.js` copies hub collections local → prod (`MONGODB_URI_PROD`).

## UI primitives

- `DataTable` — client or `serverSide` pagination, sort, virtualization.
- `TablePagination` — shared footer; default page size from `DEFAULT_TABLE_PAGE_SIZE`.
- `ListPageLayout` + `PageToolbar` — standard list pages.
