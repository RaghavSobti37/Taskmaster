# Global scale & compliance

Guidance for serving users outside your primary region (India / US West API in Oregon).

## Current topology

| Layer | Region | Latency note |
|-------|--------|--------------|
| Frontend (Vercel) | Global CDN | Static assets edge-cached |
| API (Render) | Oregon (`render.yaml` region) | Single region — EU/APAC users see higher API latency |
| MongoDB Atlas | Cluster region (match API when possible) | Cross-region adds RTT |
| Redis | Oregon (Render Key Value) | Co-located with API |

## Monitor before scaling

Use **Datadog RUM** (geography map) + **APM** (p95 by route):

| Metric | Action threshold |
|--------|------------------|
| RUM LCP p75 > 2.5s | Investigate bundle + CDN |
| API p95 > 500ms from target market | Consider region move or edge |
| 429 rate spike | Tune rate limits, scale Render instance |

Dashboard: **CoreKnot Production** — filter RUM by `geo.country`.

## Region strategy (when needed)

1. **Short term:** Upgrade Render plan (no cold start), keep keep-warm cron
2. **Medium term:** Move API + Atlas + Redis to region closest to user majority (e.g. Singapore for APAC)
3. **Long term:** Cloudflare or similar in front of API for DDoS + optional edge caching of public GET routes (not authenticated mutations)

Do not multi-region MongoDB without explicit replication design — start with single primary.

## Compliance checklist

| Requirement | Status | Action |
|-------------|--------|--------|
| Privacy policy page | `/privacy` exists | Keep updated |
| User data export | Review product need | Add admin export if EU users |
| User data deletion | Review product need | Document retention in privacy policy |
| Cookie consent | Session auth cookies | Document in privacy policy |
| Email unsubscribe | `/unsubscribe` exists | CAN-SPAM baseline met |
| Log PII | SystemLog redacts sensitive fields | Audit new log paths |
| Datadog RUM privacy | `mask-user-input` default | Do not raise replay sample on prod without review |

## Cost controls at scale

- Sentry + Datadog sample rates: keep `0.1` traces / 100% errors until traffic justifies higher
- SystemLog TTL 7 days in MongoDB; long retention in Datadog only
- RUM session replay: keep at `0` unless debugging UX

## Review cadence

Quarterly: RUM geography report → decide region move. After major market launch: compliance review with legal.
