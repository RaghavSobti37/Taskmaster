# Omni-Security — CoreKnot (June 2026)

## Scope

- Targets: local repo `Taskmaster`, committed docs, Vercel/Render config patterns
- Allowed: `/dev-audit` SAST, exposure scans, config hardening
- Forbidden: production exploitation, third-party active scanning
- Sandbox: local dev (`localhost:5000` / `5173`)

## Executive summary

| ID | Severity | Finding | Status |
|----|----------|---------|--------|
| EXP-01 | High | Hardcoded Render URL in committed `vercel.json` | Fixed — example + build-time `generateVercelConfig.js` |
| EXP-02 | High | Personal/staff emails in source and docs | Fixed — Admin → Users → Platform roles (MongoDB) |
| EXP-03 | Medium | Root admin by email list in repo | Fixed — `ROOT_ADMIN_USER_IDS` |
| EXP-04 | Low | Vite WS proxy noise when API restarts | Fixed — `wait-on` + proxy error filter |
| EXP-05 | Info | Git history may retain old literals | Fixed Jun 2026 — `npm run audit:history` clean; see `docs/GIT_HISTORY_REDACTION.md` |

## Safe to commit

| Artifact | Safe? | Notes |
|----------|-------|-------|
| `package.json` / `package-lock.json` | Yes | No secrets; run `npm audit` separately |
| `vercel.json` | No | Gitignored; generate at deploy from `RENDER_API_PROXY_URL` |
| `vercel.json.example` | Yes | Placeholders only |

## Pre-push gate

```bash
npm run audit:exposure
```

## Residual risk

- Set all `*_USER_IDS` and `RENDER_API_PROXY_URL` on Render/Vercel before deploy.
- Force-push history redaction if the repo was ever public with literals in commits.
