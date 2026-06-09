# Project overview

**CoreKnot** — multi-tenant CRM & operations hub for TSC (projects, CRM, finance, email campaigns, attendance, gamification).

- **Repo:** monorepo `client/` + `server/`
- **Version:** 1.0.7
- **Tenancy:** MongoDB documents scoped by `tenantId` / workspace
- **Auth:** JWT + department roles + per-page permissions (`pagePermissions.js`)

## Primary users

- Sales / CRM reps — leads, followups
- Artist management — artist CRM, booking enquiries, managed accounts
- Operations — org credential registry, office assets
- Admins — Data Hub, users, scripts, backups

## Local dev

```bash
npm run preflight
npm run dev   # server :5000 + Vite proxy
```

Production URLs: see gitignored `.cursor/production-hosts.local.json` (never commit).

## Email (high level)

- Visual templates use shared block spacing (`shared/emailBlockSpacing.cjs`) for preview/send parity.
- Campaign analytics geo is recomputed from MailEvents with datacenter/scanner filtering on clicks.
