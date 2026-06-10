# Specify — project memory for AI agents

This folder holds **structured memory** Cursor agents read during `/push-and-document` and other long-running tasks. It complements `docs/PROJECT_MEMORY.md` with a compact, diff-friendly snapshot.

## First-time setup (once per machine / clone)

Run these steps **only the first time** `.specify` is missing or empty:

```powershell
# 1. From repo root
cd "C:\Users\ragha\OneDrive\Desktop\TSC Platform\Taskmaster"

# 2. Ensure memory folder exists
New-Item -ItemType Directory -Force -Path ".specify\memory"

# 3. Seed memory from current docs (optional bootstrap)
Copy-Item "docs\PROJECT_MEMORY.md" ".specify\memory\project-memory.md" -ErrorAction SilentlyContinue

# 4. Verify audits
npm run audit:exposure
npm run audit:deadcode

# 5. Commit the folder so other machines get it
git add .specify
git commit -m "chore: initialize .specify memory"
```

After setup, **do not** re-run the copy step unless you intentionally reset memory. `/push-and-document` updates the tracked files under `.specify/memory/` each session.

**Note:** Other files may exist locally under `.specify/memory/` (agents, maps, legacy notes). They stay **gitignored** unless added to the allowlist in `.gitignore`. Only the five tracked memory files below are committed.

## Layout

| Path | Purpose |
| --- | --- |
| `memory/PROJECT_MASTER_CONTEXT.md` | **Master context** — full project breakdown for humans and AI agents |
| `memory/project-overview.md` | Product scope, stack, tenancy |
| `memory/architecture.md` | Runtime, API, data flows |
| `memory/features.md` | Major feature areas and routes |
| `memory/recent-changes.md` | Session delta — updated every push-and-document |
| `memory/conventions.md` | Locked rules, audits, env safety |
| `memory/auth-and-recent-fixes.md` | Version-by-version changelog (detailed) |

## Maintenance

- Updated automatically by the **push-and-document** skill after each successful push.
- Keep entries factual; link to `docs/` for long specs (email engine, logo, production hosts).
- Never store secrets, Mongo URIs, or live API keys here — use gitignored `.cursor/production-hosts.local.json`.
