# CoreKnot System Audit: Vulnerabilities & Bottlenecks

## 1. Concurrency & Locking Flaws
- **Stale Locks**: `checkLock` middleware uses 15-minute TTL. Crash = 15m lockout.
  - **Fix**: WebSocket presence channel. Short TTL (30s) + client heartbeat.

## 2. Infrastructure & Scalability
- ~~**Backup Sprawl**: `server.js` boots OS-level cron backup script. Multi-instance scaling causes concurrent backup collision.~~ (Fixed)
  - **Fix**: Disabled inline backup job in `server.js`.
- **Queue Bloat**: Mongoose `post('save')` pushes to BullMQ `holySheetSync`. High-volume import spikes BullMQ RAM.
  - **Fix**: Batch queueing. Rate-limit hook dispatch.
- ~~**Rate Limit Strictness**: Global 100 req / 15 min for production (`server.js`). CRM users hit this fast.~~ (Fixed)
  - **Fix**: Loosened CRM limits to 1000.
- ~~**Missing DB Read Optimizations**: Mongoose GET queries are missing `.lean()`. Causes heavy hydration overhead for read-only routes, slowing down API responses.~~ (Fixed)
  - **Fix**: Applied `.lean()` to Mongoose GETs in CRM Controller.

## 3. Data Integrity & Sync
- ~~**External Dependency**: HolySheet API sync tight-coupled to lead flow. Google API outage = queue stall.~~ (Fixed)
  - **Fix**: Implemented Circuit Breaker pattern in `holySheetService.js`. Skips syncs for 5m after 3 consecutive failures.
- **Sanitization Bypass**: `express-mongo-sanitize` on body, but dynamic `$where` or JS evaluation in aggregation pipelines remains vulnerable if not strictly typed.
- **Linkage/Circular Dependencies**: Architectural flaw in service dependencies (e.g. `taskController` calling Rollup utilities which recursively query/update `Project` and `Task` states). Causes race conditions and memory leaks.
  - **Fix**: Implement an EventDispatcher (Pub/Sub) to decouple these services.

## 4. Observability & Logging
- **Console Clutter**: 40+ scripts/services use raw `console.log` instead of structured `logger.js`. Log ingestion fails parsing.
  - **Fix**: Deprecate `console.*`. Enforce Winston/Pino logger via ESLint. *(Requires ESLint pass)*

## 5. Frontend & Rendering
- **DOM Overload**: Heavy reliance on caching (React Query) but no virtualization mentioned for Lead tables. 10k rows = memory crash.
  - **Fix**: Implement `tanstack/react-virtual` for data grids. *(Pending Future Sprint)*

## 6. Security, Secrets & Clutter (Severe)
- ~~**Data Sprawl Leak**: `leads.csv` (593KB) is in the root directory. Raw production data leaked into codebase.~~ (Fixed)
  - **Fix**: Deleted `leads.csv`.
- ~~**Exposed Secrets**: `google_service_account.json` exists in root. Also `.env.production` is present. Severe risk if repo is pushed publicly.~~ (Fixed)
  - **Fix**: Deleted exposed production env and raw secrets from repo.
- **Session Replay**: JWT token invalidation not explicit on logout (relies on client dropping token).
  - **Fix**: Implement Redis token blacklist for fast revocation. *(Pending Security Sprint)*

## 7. Dead Code & Memory Bloat
- ~~**Script Graveyard**: `server/scripts/` contains 30+ legacy test/import scripts. Increases bundle size, attack surface, and deployment bloat.~~ (Fixed)
  - **Fix**: Moved scripts to `server/archive`.
- ~~**Duplicate Agent Memory Files**: `.specify/memory` has redundant info. Causes agent hallucination and context window bloat.~~ (Fixed)
  - **Fix**: Deleted redundant architecture and manual files.

## 8. Code Quality & Architectural Violations (New)
- ~~**Functions Not Called**: Many components are defined but unreferenced (e.g. `GeoAnalyticsTable`, `CRMLeadModal`, `ProjectGantt`, `TeamView`).~~ (Fixed)
  - **Fix**: Pruned 10+ dead unreferenced components and services.
- **Monolithic Files**: 22 files have 15+ functions and cyclomatic complexity > 30 (e.g., `AdminMailContent.jsx` has 60 functions, `ArtistDetail.jsx` has 54).
  - **Fix**: Refactor monolithic components into smaller sub-components or custom hooks. *(Requires Dedicated Refactor Pass)*
- ~~**Circular Dependencies**: Files import each other directly (e.g. `queueService ↔ triggerService`).~~ (Fixed)
  - **Fix**: Extracted shared logic to [emailProcessor.js](file:///c:/Users/ragha/OneDrive/Desktop/CoreKnot/server/services/emailProcessor.js) and removed circular imports in [triggerService.js](file:///c:/Users/ragha/OneDrive/Desktop/CoreKnot/server/services/triggerService.js).
- ~~**Code Duplication**: Heavy duplication across the board (e.g. `onClose` duplicated in 21 files, `parseOfferingTitle` in 4 files).~~ (Partially Fixed)
  - **Fix**: Consolidated generic functions into `server/utils/exlyUtils.js`. Further UI consolidation needed.
- **Architectural Inversion**: Lower layers importing higher layers (e.g. `utils` importing from `components` in `useTaskmasterQueries.js`, `services` importing `ui`).
  - **Fix**: Invert dependencies. Utils should never rely on React UI components. *(196+ instances identified; Requires Dedicated Refactor Pass)*
