# seedE2eUsers.js

Idempotent local E2E user factory for **taskmaster_local** only.

## Quick start

```bash
# From repo root (uses server/.env MONGODB_URI)
node server/scripts/seedE2eUsers.js
```

Requires `MONGODB_URI` pointing at `taskmaster_local`. Script exits if the database name is anything else.

## What it creates

### Users (7)

One account per default department slug:

| Archetype | Email | Department | Preset |
|-----------|-------|------------|--------|
| `dept-admin` | `e2e-dept-admin@test.coreknot.local` | Admin | `admin` |
| `dept-operations` | `e2e-dept-operations@test.coreknot.local` | Operations | `operations` |
| `dept-sales` | `e2e-dept-sales@test.coreknot.local` | Sales | `sales` |
| `dept-artist-management` | `e2e-dept-artist-management@test.coreknot.local` | Artist Management | `artist-management` |
| `dept-editor` | `e2e-dept-editor@test.coreknot.local` | Editor | `standard` |
| `dept-videographer` | `e2e-dept-videographer@test.coreknot.local` | Videographer | `standard` |
| `dept-cg-artist` | `e2e-dept-cg-artist@test.coreknot.local` | CG Artist | `standard` |

- **Password:** `1Million#` (from `shared/defaultPassword.js` / `DEFAULT_SEED_PASSWORD`)
- **Pattern:** `e2e-{archetype}@test.coreknot.local`
- Sales user gets `repId: e2e-sr01` for CRM flows
- All queries use `bypassTenant: true`

### Projects (2)

| Project | Owner (lead) | Other roles |
|---------|--------------|-------------|
| `[E2E] SANDBOX` | `dept-admin` | `dept-operations` lead (manager), `dept-sales` member, `dept-editor` viewer |
| `[E2E] SECONDARY` | `dept-videographer` | `dept-artist-management` lead (manager), `dept-cg-artist` member |

Names stored ALL CAPS via `formatProjectName`.

Manifest `projectRoles` use aliases `lead` | `member` | `viewer`. Stored DB roles map as:

- `lead` (owner) → project owner + `admin`
- `lead` (member) → `manager`
- `member` → `member`
- `viewer` → `viewer` in `memberRoles`

## Manifest

Written on each successful run:

```
.agents/e2e-users.json
```

Contains email, password, archetype, department (slug, preset, `pagePermissions`), `projectRoles`, and Mongo `userId` / `projectId` values.

## Idempotency

Re-running the script:

1. Ensures departments via `seedDepartments()`
2. Upserts users by email (syncs password + department; keeps avatar if present)
3. Upserts projects by name (refreshes owner, members, `memberRoles`)

## Flags

| Flag | Effect |
|------|--------|
| `--dry-run` | Log actions only; no DB writes or manifest file |

## Playwright / manual login

```bash
E2E_EMAIL=e2e-dept-sales@test.coreknot.local E2E_PASSWORD='1Million#' npm run test:e2e:auth
```

Or read credentials from `.agents/e2e-users.json`.
