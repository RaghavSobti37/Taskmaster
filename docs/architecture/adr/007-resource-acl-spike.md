# ADR 007: Resource-level ACL (spike)

## Status

Proposed — 2026-07-02

## Context

`hasPageAccess` gates routes, not individual records. `projectAccessIdor.test.js` proves some IDOR coverage; pattern is not generalized.

## Decision (spike)

- Introduce `canAccessResource(user, resourceType, resource, opts)` in `server/utils/canAccessResource.js`.
- Map resource types → page keys; admin bypass; ownership via `opts.isOwner` from controllers.
- **Defer** CASL/OPA until custom roles ship — page preset matrix still manageable.

## Next steps

1. Wire `canAccessResource` into project detail + finance approve handlers
2. Clerk org roles → `pagePermissions` mapping for delegated admin
3. Re-evaluate policy engine when >3 domains need field-level rules
