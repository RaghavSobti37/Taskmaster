---
name: rbac-audit
description: >-
  Audits CoreKnot page access, navigation gates, and API authorization for
  all roles. Use when user asks about role permissions, page access, data
  access, defense-in-depth, or "check all roles".
---

# RBAC Audit (CoreKnot)

## Three layers (all must align)

1. **Frontend route** — `ProtectedRoute` / page mount
2. **Nav visibility** — `pagePermissions.js`, `navPageAccess.js`, CommandPalette, keyboard shortcuts
3. **API** — `authMiddleware`, role helpers (`requireAdmin`, `requireDeptAdmin`, workspace gates)

## Role matrix sources

- `client/src/utils/pagePermissions.js` — `PAGE_GROUPS`, `hasPageAccess`
- `client/src/utils/navPageAccess.js` — `canAccessNavPath`
- `server/middleware/authMiddleware.js`
- Per-route: `requireRole`, `opsOrAdmin`, workspace page gates

## Audit checklist

```
- [ ] Each PAGE_GROUPS key has matching API protection on its data endpoints
- [ ] Nav/sidebar hides inaccessible paths (not just 403 on click)
- [ ] CommandPalette + G-chord shortcuts respect same gates
- [ ] Dept-admin vs admin vs member boundaries on CRM delete, finance, admin panels
- [ ] Tenant: queries use tenantPlugin; bypassTenant only on allowlist
```

## Output

| Page/API | Roles allowed | FE gate | API gate | Gap |
|----------|---------------|---------|----------|-----|

Flag **defense-in-depth** gaps: API OK but nav shows link, or nav hidden but API open.

## Reference

`docs/AI_AGENT_PROJECT_CONTEXT.md` §8–9, `docs/TENANT_BYPASS_ALLOWLIST.md`
