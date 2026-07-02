# Incident response

## Severity

| Level | Example | Response |
|-------|---------|----------|
| SEV1 | API down, data loss risk | Immediate; all hands |
| SEV2 | Major feature broken, no workaround | < 1h acknowledge |
| SEV3 | Degraded perf, workaround exists | Next business day |

## On-call flow

1. Alert from Sentry / Render / status page
2. Check `GET /api/health` and Render logs (filter `level=error`)
3. Note `X-Trace-Id` from failing request
4. Rollback if deploy-related: Render → service → Manual Deploy → previous commit

## Rollback (Render)

```bash
# List recent deploys (RENDER_API_KEY in env)
curl -s -H "Authorization: Bearer $RENDER_API_KEY" \
  "https://api.render.com/v1/services/<SERVICE_ID>/deploys?limit=5"
```

Promote last green deploy from Dashboard or trigger deploy on known-good commit.

## Comms template

> CoreKnot incident [SEVx] — [short description]. Impact: [who/what]. Status: investigating | mitigated | resolved. Next update: [time UTC].

## Post-incident

- Root cause in internal doc or ADR if architectural
- Add regression test if bug was preventable
