# Legacy freeze policy

New features must **not** expand these surfaces. Removal needs product sign-off (see [`ARCHITECTURE_DEBT.md`](./ARCHITECTURE_DEBT.md)).

## Dual mail APIs

| Path | Status |
|------|--------|
| `/api/campaigns` | **Primary** — create, send, track campaigns |
| `/api/mail` | **Legacy** — templates, profiles, older flows only |

Do not add new send/dispatch logic under `/api/mail`.

## RBAC

| System | Status |
|--------|--------|
| Department `permissionPreset` + `pagePermissions` | **Required** for new gates |
| `Role` / `Permission` models + `user.role` | **Frozen** — migrate readers, do not add new checks |

Use `isAdminUser()` / department slug `admin`, not `user.role === 'admin'`.

## Parallel models

- `MailCampaign` vs campaign documents — read-only compatibility; no new writes to legacy model.
- Dashboard widget id `schedule` = **today's calendar**, not team Schedule page (`/schedule`).

## Env naming

- `TASKMASTER_WEBHOOK_URL`, `TASKMASTER_ARTIST_ENQUIRY_WEBHOOK_URL` — keep names; values must use [`ENVIRONMENT_MATRIX.md`](./ENVIRONMENT_MATRIX.md) API host.

## Locked implementations

- Email engine — [`EMAIL_ENGINE_LOCKED.md`](./EMAIL_ENGINE_LOCKED.md)
- Brand logo + `frl-v-02` spinner — [`LOGO_LOCKED.md`](./LOGO_LOCKED.md)

## Planned hardening (not frozen — backlog)

From [`weakness_report.md`](./weakness_report.md):

- JWT Redis blacklist on logout
- EventDispatcher for task/project rollup decoupling
- Virtualized CRM grids at 10k+ rows
- Monolith splits (`AdminMailContent`, `FinancePage`, `useTaskmasterQueries`)
