# Authentication & Security

## JWT sessions (v1.0.7)

| Item | Value |
| --- | --- |
| **Cookie name** | `coreknot_token_v3` |
| **Legacy purge** | `coreknot_token_v2`, `coreknot_token` cleared on every response |
| **Storage** | HttpOnly cookie — **not** localStorage |
| **Client** | `axios.defaults.withCredentials = true` |

### Sliding sessions (`server/utils/authSession.js`)

| Setting | Default | Purpose |
| --- | --- | --- |
| `JWT_EXPIRES_IN` | `7d` | Inactivity window — renewed on API traffic |
| `JWT_ABSOLUTE_MAX_DAYS` | `30` | Hard re-login cap |
| `JWT_REFRESH_MINUTES` | `60` | Cookie refresh throttle |

---

## Auth endpoints (`/api/auth`)

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/login`, `/register` | Email/password auth |
| POST | `/logout` | Clear cookies + revoke session |
| GET | `/me` | Current user (session probe) |
| POST | `/forgot-password`, `/reset-password` | Password reset |
| GET | `/google`, `/google/callback` | Google OAuth |
| POST | `/oauth-establish` | Exchange OAuth ticket for cookie |
| GET/DELETE | `/sessions` | List/revoke device sessions |

### Google OAuth cross-origin fix

1. Callback on API host issues short-lived `?ticket=` JWT
2. `GoogleSuccessPage` calls `POST /api/auth/oauth-establish`
3. Cookie set in XHR context (fixes Vercel + Render cross-origin 401 loops)

### Dev bypass

`DEBUG_BYPASS=true` + `Authorization: Bearer bypass_token` — local dev only.

---

## Authorization

### Department-based access

- Users belong to a **Department** (admin, sales, operations, artist-management, etc.)
- `isAdminUser()` checks department slug — not legacy `user.role`
- **Page permissions** on Department model — `hasPageAccess(pageKey)` on client + server

### Page permission gates (Jun 2026)

- Department pagePermissions enforced on server for mail, admin console, workspace, CRM, API proxy paths, and related modules
- Client: `pagePermissions.js`, `navPageAccess.js`, `ProtectedRoute`, `PageRoute`
- Admin UI: PagePermissionsEditor on department records
- **`emails` page key:** any authenticated user may use mail template studio + `/emails` hub (Jun 2026 regression fix — client + server `hasPageAccess`)

### Artist workspace membership (Jun 2026)

- FE: `/artist-workspace/:id` gated by `ArtistMembershipRoute` (accepted membership or artist manager)
- API: `artistMembershipAccess(permission)` — admins bypass; members checked via `ArtistMembership` roles
- Connection hub, sync, primary connection, tracked-video: `artistMembershipAccess('socials')`
- Finance OS tabs: `artistMembershipAccess('finance')`
- Team invite/manage: `artistMembershipAccess('team')`
- Public routes (no auth): `/artist/:slug`, `/preview/artist/:id/*`, share claim via token

### Tenant hardening (partial)

- Continued tenantPlugin + explicit tenantId checks on sensitive mutations; not all collections fully audited yet

### Platform roles

- `PlatformSettings` model in MongoDB
- `ROOT_ADMIN_USER_IDS` / `PLATFORM_OWNER_USER_ID` env vars
- `shared/platformRoleDefinitions.js`

### Project roles (`shared/projectRoles.js`)

| Role | Rank | Capabilities |
| --- | --- | --- |
| `admin` | 3 | Full project control |
| `manager` | 2 | Member management |
| `member` | 1 | Task execution |

### Task review rules (`shared/taskReviewRules.js`)

- Assignees → `in-review` on completion
- Creators bypass review — can mark `done` directly
- Platform owner shares creator approve rights
- Rollback: creator, assignee, assigner, or platform owner

---

## Multi-tenancy

- **Tenant model** — each org has a tenant document
- **tenantPlugin** (`server/plugins/tenantPlugin.js`) — auto-injects `tenantId` on queries
- **bypassTenant** — cross-tenant public data (calendar musical days, mail events for tracking)

---

## Security gates

| Check | Command |
| --- | --- |
| Working tree exposure | `npm run audit:exposure` |
| Orphan modules | `npm run audit:deadcode` |
| Git history needles | `npm run audit:history` |
| Env preflight | `npm run preflight` |

**Do not commit:** `server/.env.render`, live API keys, MongoDB URIs.

**Production hosts:** `.cursor/production-hosts.local.json` (gitignored) — never use legacy `CoreKnot-jfw0.onrender.com`.
