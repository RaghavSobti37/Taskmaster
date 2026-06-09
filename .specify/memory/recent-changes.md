# Recent changes

_Last updated: Jun 2026 session — push-and-document_

## Assets hub & managed accounts

- New `AssetsHubLayout` with sidebar (File Links + Managed Accounts) for admin / artist-management / operations.
- `OrgAccount` model + `/api/org-accounts` CRUD + sheet import (`orgAccountImportService.js`).
- `OrgAccountsPage` — filters, stat cards with top-3 highlights, replace-all Google Sheet import.
- Routes: `/assets`, `/assets/accounts`; `ArtistOrAdminRoute` extended via `canAccessOrgAccounts()`.

## Pagination standardization

- `DEFAULT_TABLE_PAGE_SIZE = 10` exported from `primitives.jsx`.
- All list pages default to 10 rows; removed 15/25/50 overrides.
- `DataTable` fixes: `totalPages` min 1, server-side page clamp, Followups `onPageSizeChange`.
- Artist Booking Enquiries: fixed broken `pagination={{}}` prop → proper `serverSide` API.

## Data Hub / scripts

- `syncDataHubToProd.js`, `compareDataHubDbs.js` updates; `npm run datahub:push-prod`.
- Artist CRM bulk push script (`bulkPushArtistCrmToProd.js`).

## Docs

- README: Assets hub section, pagination note, `org-accounts:import` npm script.
