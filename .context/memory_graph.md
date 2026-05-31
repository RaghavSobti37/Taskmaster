# Active State & Milestones
- [Current Focus]: Refactoring fields and structural form layout within `ProfileSettings.jsx`.
- [Last Modified]: May 31, 2026

# Node Graph (Entities & Components)
- [Node: ProfileSettings.jsx] -> (Handles user info form states and password reset actions)
- [Node: TeamBadgeArray] -> (Converts button group styles into structural read-only statuses)

# Edge Graph (Dependencies & Data Flow)
- [userStateData] --(hydrates user.phone context properly)--> [ProfileSettings.jsx Input]

# Known Gotchas & Constraints
- Ensure `Assigned Teams` are clearly displayed as read-only labels; do not use action-based button states or pointer events.
