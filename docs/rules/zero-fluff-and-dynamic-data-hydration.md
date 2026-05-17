# Zero Fluff and Dynamic Data Hydration Rules
**Status:** Immutable Architectural Specification
**Scope:** Data Flow, Caching, and Language Framework

## 1. Absolute Purge of Mock States
Static or simulated data is prohibited in the production codebase.
- **Zero Placeholder Policy**: 
    - No `const MOCK_DATA = [...]`.
    - No hardcoded dashboard counts or "test" strings in JSX.
- **Dynamic Requirement**: Every view must derive state exclusively from server-side hydration via `@tanstack/react-query`.

## 2. Plain English Language Framework
Complexity in language is a technical debt. Enforce accessible, jargon-free terminology.

| Technical Jargon | Plain English Replacement |
| :--- | :--- |
| Execute Batch CSV Mutation | **Upload Lead List** |
| Hydrated Log Mutation Execution | **Activity Recorded** |
| Task Overdue Lifecycle Exception | **Task Overdue Alert** |
| Data Sync Pipeline Active | **Connected & Up to Date** |
| Operational Unit | **Project** |
| Personnel Entity | **Member** |

## 3. Perfect Cache Invalidation Matching
Eliminate perceived latency through aggressive cache management.
- **Optimistic Updates**: 
    - Use `queryClient.setQueryData` to update local cache immediately during mutations.
- **Invalidation Chains**:
    - On mutation success, trigger targeted invalidation of all related query keys (e.g., `['leads']`, `['stats']`).
- **Loading UX**: 
    - Ensure zero stale-data flickers by validating cache presence before rendering.
