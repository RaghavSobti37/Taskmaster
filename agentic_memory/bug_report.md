# Bug Report - Audit 2026-05-13

## Resolved Issues
- **Dashboard**: `undoTask` duration mismatch (10s sync). [FIXED]
- **TeamView**: Missing imports and path for `CKDropdown`. [FIXED]
- **AdminPanel**: API response parsing for paginated `/directory`. [FIXED]
- **DailyLogPage**: Backend filtering implemented. Date mutation fixed. [FIXED]
- **ProjectCreate**: Paginated user state handling. [FIXED]
- **ChatPage**: Spacing optimized. [FIXED]
- **ChatPage**: `loading` state and `scrollRef` ReferenceErrors resolved. [FIXED]
- **API**: Fixed 500 Error caused by non-existent `outletId`. [FIXED]
- **API**: Fixed 500 Error (CastError) in log query. [FIXED]
- **API**: Fixed 500 Error in `taskController` (Missing `action` field in Log). [FIXED]
- **Dashboard**: Task completion "reappearing" bug fixed via async confirmation and rollback. [FIXED]

## UI Migrations
- **Active Load Capacity**: Moved from Dashboard -> AdminPanel.
- **System Integrity**: Moved from Dashboard -> AdminPanel.
- **Chat Members**: Moved from left sidebar to right-drawer (toggled by Users icon).

## Verification
- Frontend: Chat terminal fully functional. All refs restored.
- Backend: Logs generating with correct `action` codes.
- Stability: No known runtime ReferenceErrors remaining.
