# Features & TODO List

## Core Pages — Status

- [x] **Auth**: LoginPage, RegisterPage — validation, redirect, quick login demo button
- [x] **Dashboard**: Task overview, completion with undo (10s delay), optimistic UI
- [x] **Admin Panel**: User management, team creation, activity feed, CRM data tab
- [x] **Team Directory**: Filter by team, color-coded badges, admin edit shortcuts
- [x] **Projects**: Create, list, detail views (List/Kanban/Gantt/Team)
- [x] **Daily Logs**: Time tracking, project tagging, quick test fill, daily goal progress
- [x] **Admin Logs**: Filter by user + date range, activity matrix visualization
- [x] **Team Chat**: Channels, mentions, file attach, task creation from messages
- [x] **CRM**: Lead table, CSV import, priority dots, status badges, lead modal
- [x] **Assets**: Project-scoped links (max 3), add/delete with modal confirmations
- [x] **Calendar**: Monthly view, internal event persistence, visibility toggles (Public/Private), holiday integration
- [x] **Follow-ups**: Tabbed CRM follow-up view (Today, Overdue, Upcoming), automated reminders, clickable stat cards, and lead modal integration.
- [x] **Artists**: High-fidelity profiles (Harshad & Duhita, Yugm, Mohit Shankar), live API syncing (`isSynced` linking model), default N/A states with step-by-step layman ID linking tooltips across Spotify, YouTube, and Meta.
- [x] **Todo/Task Management**: Synchronized Protocol Log (TodoPage) with backend Task model and Project associations.
- [x] **Settings**: Profile editing, avatar upload, theme toggle, and 30% scaled-down high-density UI components.
- [x] **Office Registry**: Unified Office Assets & Contacts directory with tabbed navigation.
- [x] **HolySheet Integration**: Real-time bidirectional lead backup and synchronization with HolySheet API.

## UI Overhaul — Status
- [x] **Top Navbar Removed**: Completely removed top navbar for a more immersive, high-density vertical workspace.
- [x] **Vertical Sidebar Integration**: Moved notifications and profile access to the primary vertical sidebar.
- [x] **Mobile Floating Toggle**: Added floating action button for mobile sidebar access.

## Backend — Status

- [x] Pagination across User/Log controllers
- [x] ALL CAPS team name enforcement at DB level
- [x] Admin protection safeguards (can't delete self, can't remove last admin)
- [x] CastError and field mismatch fixes resolved
- [x] Log validation fix (action field required)
- [x] **CRM batch import/delete with audit trail**
- [x] **Asset CRUD with project linking**
- [x] **Persistent Calendar system** with role-based visibility (Public/Private)

## UI Language Cleanup — Status

- [x] Replaced all military/spy jargon with simple, clear language
- [x] Standardized button labels: Create, Save, Delete, Cancel
- [x] Simplified form labels: Project Name, Description, Status, etc.
- [x] Updated loading states: "Loading..." instead of "Decrypting Signals..."
- [x] Updated empty states: "No projects yet" instead of "Awaiting Deployment"
- [x] Updated modal confirmations: clear, direct language
- [x] Sidebar: "Admin Panel" instead of "System Deck", "Log Out" instead of "Terminate Session"
