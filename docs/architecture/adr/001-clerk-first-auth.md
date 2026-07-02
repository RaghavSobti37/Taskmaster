# ADR 001: Clerk-first staff authentication

## Status

Accepted — 2026-07-02

## Context

CoreKnot had three staff auth paths: email/password JWT, Google OAuth ticket, and Clerk `clerk-establish` → HttpOnly `coreknot_token_v3`. Enterprise buyers expect one IdP with SAML/OIDC and MFA.

## Decision

- **Production/staging:** Clerk is the only staff login surface (`isClerkProductionAuth()` / `ALLOW_LEGACY_LOGIN` unset).
- **Session:** Clerk verifies identity; API issues sliding JWT cookie for same-origin `/api` compatibility.
- **Enterprise SSO:** Clerk Organizations + SAML/OIDC; map `clerkOrganizationId` on `Tenant`.
- **Lifecycle:** `POST /api/webhooks/clerk` syncs user.created/updated/deleted (SCIM-compatible webhook path until full SCIM).

## Consequences

- Google OAuth callback remains for **artist integrations** and calendar link — not staff login in prod.
- WebAuthn passkeys remain optional alongside Clerk MFA policies.
- Procurement can cite Clerk Enterprise for SAML; CoreKnot owns session revocation and audit.
