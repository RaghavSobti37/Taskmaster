# Bug Report — Audit 2026-05-13

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
- **All Pages**: Replaced `window.alert()` / `window.confirm()` with NexusModal. [FIXED]

## UI Migrations

- **Activity Feed**: Moved from Dashboard → Admin Panel sidebar
- **System Stats**: Moved from Dashboard → Admin Panel
- **Chat Members**: Moved from left sidebar → right drawer (toggled by Users icon)

## Language Cleanup (2026-05-13)

All military/spy jargon replaced with clear, simple language:
- "System Deck" → "Admin Panel"
- "Operative" → "User" / "Team Member"
- "Deploy" → "Create" / "Save"
- "Decommission" → "Delete"
- "Terminate Session" → "Log Out"
- "Mission Briefing" → "Description"
- "Signal Purge" → "Clear All Logs"
- "Commit" → "Save"
- All loading/empty states simplified

## Verification

- Frontend: All pages render without errors
- Backend: Logs generating with correct `action` codes
- Stability: No known runtime ReferenceErrors remaining
- NexusModal: All destructive actions use branded modal confirmations
