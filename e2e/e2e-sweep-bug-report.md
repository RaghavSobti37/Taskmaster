# E2E Task Explorer — Bug Report

Last verified: 2026-06-10 (prod fix loop)

| ID | Severity | Title | Status | Fix |
|----|----------|-------|--------|-----|
| BUG-T5 | high | Lead/member can assign off-project user | **fixed** | `assertAssigneesInTaskScope` in `taskAccess.js`; gated in `TaskService` create/update |
| BUG-T6 | high | Viewer role can mutate tasks | **fixed** | `userIsProjectViewer` in `shared/projectRoles.js`; read-only gate in `TaskService.updateTask` |
| BUG-T12 | medium | Viewer can create project tasks | **fixed** | Viewer gate in `TaskService.createTask` + delete |
| BUG-T13 | high | Rollback wrong status → 500 not 400 | **fixed** | `taskController.updateTask` maps rollback/approve status errors → 400 |
| BUG-T11 | low | Assign notification not in GET /api/notifications | open | Architectural — realtime/localStorage only; not blocking prod |

## Verification

```bash
cd server
npx jest tests/taskAssigneeScope.test.js tests/projectRoles.test.js tests/taskReview.test.js --no-coverage
node ../e2e/task-explorer-sweep.mjs   # requires local API + seed
```

**2026-06-10 verify:** unit **20/20 pass**; E2E sweep **91/92 pass, 0 bugs** (viewer create correctly 403; sweep updated to expect that).
