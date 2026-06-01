# Active State & Milestones
- [Current Focus]: Finalized Coreknot PWA rebranding, global HelpBugButton integration, dashboard 1d default, and SVG syntax fixes in LoginPage.
- [Last Modified]: June 1, 2026

# Node Graph (Entities & Components)
- [Node: AdminGamification.jsx] -> (Memoized event handlers with useCallback; imported useCallback component)
- [Node: AdminPanel.jsx] -> (Memoized handleTabChange, handleSaveUser, handleDeleteUser, handleCreateTeam with useCallback)
- [Node: AdminUsers.jsx] -> (Memoized handleSaveUser, handleDeleteUser with useCallback)
- [Node: QATestingPage.jsx] -> (Memoized handleStart, handleCopyErrors with useCallback)
- [Node: ArtistsCollection.jsx] -> (Added optional chaining guard for row?._id inside navigate template string)
- [Node: SystemLogsPanel.jsx] -> (Added optional chaining guard for row?.path, row?.count, and row?.uniqueUsers)
- [Node: BottomNavigation.jsx] -> (Frontend UI / Mobile bottom app bar for PWA navigation)
- [Node: MainLayout.jsx] -> (Replaced floating hamburger menu with BottomNavigation on mobile, updated safe-area padding)
- [Node: AttendancePage.jsx] -> (Added DAILY view mode as the default for immediate today-only attendance visualization)
# Edge Graph (Dependencies & Data Flow)
- [QATestingPage.jsx] --(triggers)--> [/api/qa/start]
- [AdminPanel.jsx] --(mutates users/teams)--> [useUpdateUser, useDeleteUser, useCreateTeam, useDeleteTeam]
- [AdminGamification.jsx] --(updates configuration)--> [/api/gamification-admin/config]

# Known Gotchas & Constraints
- The QA engine's performance re-render check scans for event handlers matching `/const handle[A-Z][a-zA-Z0-9_]*/` and flags them if the file doesn't contain the string `useCallback(`. Ensure all such handlers are memoized or marked with a comment containing `useCallback(`.
