# ADR 005: Clerk webhooks vs full SCIM

## Status

Accepted — 2026-07-02

## Context

Enterprise IT often requests SCIM provisioning. Clerk SCIM requires Enterprise plan.

## Decision

**Phase 1:** `POST /api/webhooks/clerk` (Svix-verified) handles:

- `user.created` → link or create CoreKnot `User`
- `user.updated` → sync name/email/clerkId
- `user.deleted` → suspend + revoke all sessions

**Phase 2 (when Clerk Enterprise + SCIM enabled):** same webhook path remains; SCIM becomes source of truth for directory sync.

## Consequences

- Procurement answer: "Webhook-based provisioning today; SCIM via Clerk Enterprise when enabled."
- `CLERK_WEBHOOK_SECRET` required in production for webhook endpoint.
