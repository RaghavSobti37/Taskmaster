# ADR 004: API versioning

## Status

Accepted — 2026-07-02

## Context

50+ route files under unversioned `/api/*`. External integrations need stability.

## Decision

- Introduce `/api/v1/*` for integration-facing read endpoints first (`/health`, `/auth/me`, `/data-hub/sync-status`).
- Legacy `/api/*` unchanged; add `X-API-Version` on v1 responses.
- OpenAPI at `/api/openapi.json`; Swagger UI at `/api/docs` (non-production).
- `info.version` synced to `package.json` via `scripts/generate-openapi.mjs --check` in CI.

Machine-to-machine auth: document Clerk M2M or dedicated API tokens (future ADR).
