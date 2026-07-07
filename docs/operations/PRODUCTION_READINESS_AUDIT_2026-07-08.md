# CoreKnot Production Readiness Audit - 2026-07-08

This audit records the production-readiness fixes completed during the July 8, 2026 stabilization pass and the issues that remain open before CoreKnot should be treated as production-ready.

## Scope

- App: `coreknot/Taskmaster`
- Focus: auth, tenant isolation, local e2e stability, CI/typecheck readiness, heal-loop viability, and production-readiness documentation.
- Evidence sources: local static review, focused Jest/TypeScript fixes, Playwright public smoke, local seeded e2e setup, and failed authenticated e2e reruns.

## Fixed in this pass

| Area | Fix | Primary files |
| --- | --- | --- |
| CRM tenant/user isolation | Sales reps can no longer delete leads assigned to other reps; delete now enforces assigned-rep scope and atomic ownership checks. | `server/domains/crm/services/leadWriteService.js` |
| Server test stability | Server Jest runner now uses a larger Node heap to avoid local OOM failures on broad suites. | `server/scripts/jestRun.cjs` |
| TypeScript 6 readiness | Root typecheck restored by acknowledging TypeScript 6 deprecation handling. | `tsconfig.json` |
| Shared contract compatibility | Zod v4 `z.record` contract failures fixed in shared contracts and safe-value helpers. | `shared/contracts/attendance.js`, `shared/contracts/crm.js`, `shared/contracts/mail.js`, `shared/contracts/safeValues.js` |
| NestJS e2e typing | NestJS e2e Jest globals and tsconfig wiring fixed. | `nestjs-server/test/tsconfig.e2e.json`, `nestjs-server/test/jest-e2e.json` |
| Heal-loop port detection | Vite/client projects now resolve to port `5173` instead of assuming `3000`. | `.cursor/healing-loop/lib/project-detect.mjs` |
| Client dev port stability | Client dev now frees and strictly binds `127.0.0.1:5173`. | `client/package.json` |
| Windows heal-loop spawn | Cross-platform process spawning fixed for Windows local agents. | `.cursor/healing-loop/lib/cross-platform.mjs` |
| Seeded local e2e users | E2E seed script now resolves the default/platform tenant, runs in tenant context, and writes local user fixtures. | `server/scripts/seedE2eUsers.js`, `.agents/e2e-users.json` |
| Seeded e2e auth | Seeded `@test.coreknot.local` users use API-session login instead of Clerk-only browser login. | `e2e/helpers/auth.js` |
| Fixture-scoped legacy login | Non-production login allows only seeded `e2e-*@test.coreknot.local` fixtures through the legacy path when Clerk would otherwise block them. | `server/domains/auth/controllers/authController.js` |
| Org-slug login redirects | E2E redirect parsing now recognizes org-slug login paths such as `/tsc/login?...`. | `e2e/helpers/auth.js` |
| CRM e2e assertion | CRM smoke assertion now checks the stable Add Lead affordance instead of brittle summary copy. | `e2e/core-confidence.spec.js` |
| Password-change gate routing | Forced password-change gate now recognizes `/tsc/settings` as the settings escape path. | `client/src/components/auth/ForcePasswordChangeGate.jsx` |
| Public smoke | Public browser smoke was verified green after the auth and dev-server changes. | `e2e/public-smoke.spec.js` |

## Verification already green

These commands or checks were reported green during the stabilization pass:

- `npm run ci`
- `npm run production:readiness`
- `npm run typecheck`
- `npm run test:e2e --workspace=nestjs-server`
- `npm run test:e2e:public`
- Focused server/client test and build checks related to the fixes above

## Remaining open items

| Priority | Open item | Why it matters | Next verification |
| --- | --- | --- | --- |
| Blocking | `npm run docs:check` still fails because generated docs changed after Knowledge Engine removal and Data Hub updates. | Documentation generation is not reconciled with the current product surface. | Regenerate or intentionally accept generated-doc changes, then rerun `npm run docs:check`. |
| Blocking | Authenticated core-confidence e2e is not fully green. | Production-ready auth cannot be claimed while protected-route login, password gate, and Artist OS flows lack a clean browser pass. | Rerun `npm run test:e2e:core-confidence` against stable local API/client and require exit 0. |
| Blocking | Protected-route redirect still lands on `/tsc/dashboard` after API-session login instead of returning to the original protected path. | Deep links and guarded routes can break expected navigation after login. | Fix redirect/session handling, then rerun the protected-route spec in `e2e/core-confidence.spec.js`. |
| Blocking | Preview e2e auth env mismatch can build preview without `VITE_CLERK_PUBLISHABLE_KEY`, causing "Clerk is not configured". | CI/preview behavior can diverge from real Clerk-enabled production builds. | Harden preview/build env checks and rerun preview e2e. |
| Blocking | Stagehand autonomous heal loop reaches `chaos-tester` but cannot complete without `OPENAI_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY`. | Autonomous browser healing cannot be treated as an active production gate without model credentials or an accepted non-LLM fallback. | Provide one supported key or document/implement a deterministic fallback gate. |
| High | Password-gate e2e needs a clean rerun after the `/tsc/settings` gate fix. | The code fix is present, but the browser evidence is not complete. | Rerun the password-gate spec and capture exit 0. |
| High | Artist OS smoke needs a clean rerun after auth/test fixes. | Artist OS is part of core-confidence coverage. | Rerun the Artist OS spec and capture exit 0. |
| High | Local API dev process instability during e2e caused port conflicts, intermittent `ECONNREFUSED`, and occasional `502`. | Local e2e is noisy when multiple dev-server chains compete for the same port. | Use one stable API process for e2e, then harden `npm run dev:server`/nodemon behavior. |
| Medium | Server dev bootstrap still warns: `Dev admin bootstrap skipped: tenantId required to seed departments`. | Local bootstrap is not fully tenant-aware. | Make dev admin bootstrap resolve tenant context like the e2e seeder and rerun local server startup. |

## Do not mark production-ready until

- `npm run docs:check` exits 0 or the generated-doc delta is intentionally accepted.
- `npm run test:e2e:core-confidence` exits 0.
- Preview/build auth env validation is hardened for Clerk-enabled paths.
- Stagehand heal-loop credentials or a documented fallback gate are in place.
- Local API dev startup is stable enough for repeatable e2e runs.

