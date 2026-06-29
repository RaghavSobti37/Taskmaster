# Operations & Conventions

## Date display

- **User-facing:** `DD/MM/YYYY` everywhere (UI, emails, reports).
- **Helpers:** `client/src/utils/dateDisplay.js`, `shared/dateDisplay.js` (`formatDisplayDate`, `DATE_DISPLAY_FORMAT` = `dd/MM/yyyy`).
- **Storage / API / `<input type="date">`:** keep ISO `yyyy-MM-dd` — display-only change.

---

## Local dev (Windows / OneDrive)

- Repo path under OneDrive: expect mtime churn — use committed `client/vite.config.js` watch tuning; do not register service workers in Vite dev
- Production API/frontend hosts: placeholders in docs; real URLs only in gitignored `.cursor/production-hosts.local.json`
- Root brand files (TSC_BrandBook.pdf, tscacademy_logo.png) are gitignored local references - not part of the CoreKnot client build
- Server `cookie` dep pinned to `^0.7.2` (CJS `index.js`) — avoids broken `cookie@1.x` `dist/` installs on OneDrive-synced clones

## Pre-push audits (required)

```bash
npm run audit:exposure    # Before every commit — secret scan
npm run audit:deadcode    # Before push — orphan module scan
npm run preflight         # Before dev — env validation
npm run audit:history     # After history rewrite or fork import
```

---

## Locked zones — do not modify

| Zone | Rule file | Doc |
| --- | --- | --- |
| **Production hosts** | `.cursor/rules/production-hosts-locked.mdc` | `.cursor/production-hosts.local.json` |
| **Email engine** | `.cursor/rules/email-engine-locked.mdc` | `docs/EMAIL_ENGINE_LOCKED.md` |
| **Logo & spinner** | `.cursor/rules/logo-mark-locked.mdc` | `docs/LOGO_LOCKED.md` |
| **Legacy APIs** | — | `docs/LEGACY_FREEZE.md` |

## Cursor agent rules (committed)

| Path | Purpose |
| --- | --- |
| `.cursor/rules/date-format.mdc` | DD/MM/YYYY user-facing date convention |
| `.cursor/rules/backend-standards.mdc` | Express route patterns, validation, errors |
| `.cursor/rules/component-standards.mdc` | React component structure |
| `.cursor/rules/rbac-defense.mdc` | Page + API permission alignment |
| `.cursor/rules/tenant-security-guard.mdc` | Multi-tenant query guards |
| `.cursor/rules/react-query-errors.mdc` | TanStack Query error UX |
| `.cursor/skills/coreknot-session-boot/SKILL.md` | Session bootstrap before code changes |

Repo skills: `git-push`, `rbac-audit`, `resend-email-debug`, `prod-data-sync`, `failure-modes-map`, `coreknot-session-boot`.

**Platform settings UI:** Admin → Platform settings (`/admin/platform-settings`) — configure notification recipients and protected roles without editing env/render.yaml.

**Ship workflow:** `/git-push` → `.cursor/skills/git-push/SKILL.md` (commit, push, sync `.specify/memory/` + docs).

---
### Email engine summary (LOCKED)

- Opens: Gmail proxy IPs blocked; city from recipient's click
- Clicks: geoip-lite → ip-api.com fallback; city only
- Tracking base URL from `TRACKING_BASE_URL` / production hosts local JSON
- CRM location charts are **separate** — use `campaignRegisteredLocation.js`

---

## Supabase / backup scripts

```bash
npm run supabase:setup --prefix server
npm run supabase:migrate --prefix server
npm run supabase:health --prefix server
npm run backup:verify-supabase --prefix server
npm run backup:daily --prefix server
```

- `BACKUP_DESTINATION=supabase` default when Supabase configured
- **Render:** `SUPABASE_PG_MODE=rest` — PostgREST for IPv4 compatibility
- Do not delete Mongo log/mail collections without explicit user approval

---

## Campaign location scripts

```bash
node server/scripts/rebuildCampaignLocationBreakdown.js <campaignId> [--dry-run] [--prod]
node server/scripts/backfillCampaignFromResend.js <campaignId> [--dry-run] [--prod]
```

---

## Script safety tiers

| Tier | Meaning |
| --- | --- |
| **Safe** | Read-only or idempotent local |
| **Caution** | Modifies data — review output |
| **Danger** | Production impact — explicit `--yes` / `--prod` flags |

Full catalog: `docs/SCRIPTS_RUNBOOK.md`

---

## Critical business rules

| Area | Rule |
| --- | --- |
| **Tasks** | Creator ≠ assignee; assignees submit → in-review |
| **Attendance** | Worked = check-in → check-out; expected log = worked − 60 min lunch |
| **CRM phones** | Strict per-country validation; HTTP 409 on duplicate |
| **Gamification** | 12h XP cap per event; weekly reset Monday IST |
| **Pagination** | `DEFAULT_TABLE_PAGE_SIZE = 10` across DataTable |
| **URL query params** | `URLSearchParams.get()` is already decoded — do not `decodeURIComponent` again (throws on literal `%`) |

---

## UI conventions

- 4px grid, high density, no mock states
- Use `confirmContext` — no `window.alert`
- Spinner-only loading default — `client/src/lib/loadingDisplay.js`
- Standards: `docs/COMPONENT_STANDARDS.md`
