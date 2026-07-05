# CoreKnot public launch — invite-only beta

## Pre-launch gates

1. `npm run staging:readiness --prefix coreknot/Taskmaster` → exit 0
2. `npm test --prefix coreknot/Taskmaster/server` → exit 0
3. `npm test --prefix coreknot/Taskmaster/client` → exit 0
4. `npm run build --prefix coreknot/Taskmaster/client` → exit 0
5. `npm run build --workspace=@coreknot/nestjs-server` → exit 0
6. Tenant isolation integration test green
7. 48h staging uptime (manual gate)

## Beta rollout

1. Run `node server/scripts/migrateTenantMemberships.js` on staging + prod once.
2. Enable invite-only: org owners invite via `POST /api/tenants/:id/invites`.
3. Onboard 3–5 external orgs; verify org picker only when 2+ memberships.
4. Platform scripts/QA/security-audit: root admin only (`requirePlatformAdmin`).
5. Monitor Sentry + `/api/health` on Render + Vercel.

## QA checklist (QATestingPage)

- Tenant isolation suite
- Invite accept E2E
- Fresh tenant locked nav + onboarding checklist
- Analytics hours reconciliation
- Task rollback window regression
- Org admin cannot reach `/admin/scripts`
