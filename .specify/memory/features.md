# Features

## Core modules

| Module | Routes / entry | Notes |
| --- | --- | --- |
| Dashboard | `/` | Widgets, onboarding tour |
| Projects | `/projects` | Tasks, finance, goals, analytics |
| CRM | `/crm/leads`, `/crm/followups`, `/crm/bookings` | Sales + artist pipelines |
| Finance | `/finance` | OCR docs, folders, server pagination |
| Data Hub | Admin → CRM tab | Person spine, inlets, reconcile, backup |
| Assets | `/assets`, `/assets/accounts` | File links + managed org accounts |
| Emails | `/emails/*` | Campaigns, Resend, tracking (locked) |
| Office | `/office/*` | Contacts, subscriptions, assets |
| Admin | `/admin/*` | Users, scripts, QA, artist path |

## Assets hub (Jun 2026)

- **File Links** (`/assets`): existing asset URL registry; all users with `assets` page permission.
- **Managed Accounts** (`/assets/accounts`): org emails, social links, platform logins; project linkage; secret field server-side only.
- **Import:** Google Sheet → replace tenant `OrgAccount` rows; UI + `POST /api/org-accounts/import-sheet`.
- **Roles:** admin, artist-management dept, operations (`orgAccountsAccess`).

## Pagination

- Global default: **10 entries** (`DEFAULT_TABLE_PAGE_SIZE` in `DataTable` / `TablePagination`).
- Server-side tables: parent owns `page` / `pageSize`; component clamps page when `totalPages` shrinks.

## Artist CRM

- `crmType: artist`, CSV import, booking enquiries webhook, bulk prod push script.
