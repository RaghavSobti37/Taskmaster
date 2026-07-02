# ADR 003: MongoDB primary, Supabase mirror

## Status

Accepted — 2026-07-02

## Context

CoreKnot writes to MongoDB Atlas; Supabase holds a secondary mirror for Data Hub / analytics spine. Enterprise reviewers ask about consistency and failure modes.

## Decision

| Role | System |
|------|--------|
| Source of truth (all writes) | MongoDB Atlas |
| Read mirror / analytics | Supabase (when enabled) |
| Reconcile | Data Hub manual + scheduled; `DATA_HUB_RECONCILE_ENABLED` |
| Backups | Atlas continuous backup + Data Hub backup UI |

**Targets (documented, not contractual SLA):**

- **RPO:** 24h (Atlas backup cadence; operational backups via Data Hub)
- **RTO:** 4h (restore runbook + Render redeploy)

On sync failure: Supabase may lag; Mongo remains authoritative. Reconcile job reports drift in `/admin` Data Hub sync status.

## Consequences

- No dual-write from API handlers to Supabase on request path.
- ETL/reconcile scripts must be idempotent.
