# Deploy rollback runbook

Target: **restore last working app in under 5 minutes**. Data rollback is separate — see [`DATA_BACKUP.md`](./DATA_BACKUP.md).

## When to rollback

- 5xx spike after deploy
- Critical feature broken for all users
- Auth or data corruption risk

Do **not** rollback for minor UI bugs — fix forward with a hotfix PR.

## Pair rollback (API + frontend)

Always rollback **both** API and frontend to the same release window. Check version tags:

- Render: `RENDER_GIT_COMMIT` / deploy log
- Vercel: deployment git SHA
- Sentry/Datadog: `release` tag

## 1. Render API rollback (~2–3 min)

1. Open [Render Dashboard](https://dashboard.render.com) → **CoreKnot API** (production web service)
2. **Events** or **Deploys** tab → find last **Live** deploy before the bad one
3. Click **Rollback to this deploy** (or redeploy previous commit SHA)
4. Wait for health check: `GET /api/health` returns `{ "ok": true }`
5. Verify in Datadog/Sentry that error rate drops

**Staging:** same steps on `coreknot-api-staging` if staging broke.

## 2. Vercel frontend rollback (~1–2 min)

1. Open [Vercel Dashboard](https://vercel.com) → CoreKnot project → **Deployments**
2. Find last **Production** deployment before the bad release
3. **⋯** menu → **Promote to Production** (Instant Rollback)
4. Confirm site loads and `/login` works

**Preview:** redeploy PR or close/reopen — previews are disposable.

## 3. Verify (~1 min)

```bash
curl -s https://CoreKnot-jfw0.onrender.com/api/health | jq .
curl -sI https://tsccoreknot.com/ | head -1
```

Manual smoke:

- Login
- Open Todo list
- Open CRM leads (read-only)

## 4. Communicate

Post in `#ops-alerts`: what broke, rollback time, next fix PR link.

## RTO / RPO

| Metric | Target | Notes |
|--------|--------|-------|
| **RTO** (app available) | < 5 min | Render + Vercel rollback |
| **RPO** (data loss) | 24 h max | Daily backup cron; on-demand backup before risky migrations |

## Data rollback (separate, slower)

If a bad migration corrupted data:

1. Stop writes if possible (maintenance mode via unhealthy dependency or manual comms)
2. Follow [`DATA_BACKUP.md`](./DATA_BACKUP.md) → `restoreBackupCollection.js`
3. Do **not** mix data restore with wrong app version — align API version to backup era

## Prevention

- PR → Vercel Preview → staging API → QA pass → merge to `main`
- Required CI checks before merge (see [`CONTRIBUTING.md`](../CONTRIBUTING.md))
- Run in-app QA checklist before production deploy
- Tag releases: `git tag v1.0.x && git push origin v1.0.x`

## Escalation

If rollback fails (health still 503):

1. Check Render logs + MongoDB Atlas status
2. Check [`MONITORING_ALERTS.md`](./MONITORING_ALERTS.md) synthetics
3. Restore from backup only if data issue confirmed
