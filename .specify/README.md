# Specify — project memory for AI agents

Structured memory every Cursor agent **reads at chat start** and **updates after verified commits**.

## Start here

**[`.specify/memory/INDEX.md`](memory/INDEX.md)** — navigation hub.

| Need | Read |
| --- | --- |
| Agent loop | [`memory/MEMORY_PROTOCOL.md`](memory/MEMORY_PROTOCOL.md) |
| Latest code deltas | [`memory/changelog/recent-changes.md`](memory/changelog/recent-changes.md) |
| Chat patterns / prefs | [`memory/changelog/session-patterns.md`](memory/changelog/session-patterns.md) |
| Quick overview | [`memory/platform/overview.md`](memory/platform/overview.md) |
| Full reference | [`memory/MASTER.md`](memory/MASTER.md) (~1600 lines) |
| Locked zones | [`memory/operations/conventions.md`](memory/operations/conventions.md) |

```bash
npm run memory:report   # boot check — commits since INDEX date
```

## Memory layout

```
.specify/memory/
├── INDEX.md
├── MEMORY_PROTOCOL.md
├── MASTER.md
├── platform/
├── architecture/
├── frontend/
├── backend/
├── auth/
├── features/
├── operations/
└── changelog/
    ├── recent-changes.md
    └── session-patterns.md
```

## Maintenance

- **Start of chat:** `memory-first.mdc` + `coreknot-session-boot` skill
- **After ship:** `memory-sync` skill or `/git-push`
- `changelog/recent-changes.md` — code deltas each push
- `changelog/session-patterns.md` — durable preferences from chats
- Never store secrets — use gitignored `.cursor/production-hosts.local.json`

## Cursor skills

| Skill | When |
| --- | --- |
| `coreknot-session-boot` | Session start |
| `memory-sync` | After verify + commit |
| `git-push` | Commit → push → memory → docs push |

## First-time setup (once per machine / clone)

```powershell
cd "C:\Users\ragha\OneDrive\Desktop\TSC Platform\Taskmaster"
npm run audit:exposure
npm run audit:deadcode
```

After clone, read `memory/INDEX.md` — no bootstrap copy step needed.

## External docs (not duplicated in memory)

| Topic | Path |
| --- | --- |
| Email engine (LOCKED) | `docs/EMAIL_ENGINE_LOCKED.md` |
| Logo / spinner (LOCKED) | `docs/LOGO_LOCKED.md` |
| Local dev setup | `docs/STARTUP_GUIDE.md` |
| Full docs index | `docs/DOCUMENTATION_INDEX.md` |
