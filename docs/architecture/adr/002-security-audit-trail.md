# ADR 002: Unified SecurityAudit trail

## Status

Accepted — 2026-07-02

## Context

CRM lead changes used `CRMAudit`; other sensitive mutations (finance, permissions, data hub) were not centrally auditable.

## Decision

- New `SecurityAudit` collection (2-year TTL) separate from `CRMAudit` and short-TTL `Log`.
- `auditSensitiveMutation` middleware on finance approve/reject, user admin CRUD, platform settings, data-hub reconcile/backup, tenant SSO updates.
- Admin UI at `/admin/security-audit`.
- PII redaction for passwords/tokens in stored payloads.

## Consequences

- CRM `auditPlugin` unchanged (locked zone).
- Future: optional dual-write from lead changes to SecurityAudit for single pane.
