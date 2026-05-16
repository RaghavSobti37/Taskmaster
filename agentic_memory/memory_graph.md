# Taskmaster: Architectural Memory Graph

## Core System Overview
- **Type**: High-Density Agentic CRM & Project Management Suite
- **Design Standard**: Pro-Max (Glassmorphism, High Spacing Density, Lucide Icons, Framer Motion)
- **Primary Data Flow**: TanStack Query (Hooks) ↔ Express/Node.js API ↔ MongoDB

## Frontend Registry (Active Pages: 15)

### 1. Dashboard (`/`)
- **Components**: `MainLayout`, `OutletSidebar`, `PageHeader`, `Card`, `Badge`.
- **Features**: Real-time KPI cards, Activity Feed, Next Follow-up alerts.
- **Data Hooks**: `useCRMStats`, `useLogs`.

### 2. Leads Page (`/leads`)
- **Components**: `NexusModal`, `NexusDropdown`, `CRMLeadModal`, `Badge`.
- **Features**: Tabbed lead management (All, Fresh, Contacted), Status filters, Manual lead creation.
- **State**: Local filter state, Modal visibility.

### 3. Followups Page (`/followups`)
- **Components**: `TabSwitcher`, `Card`, `Badge`.
- **Features**: Priority-sorted lead follow-ups, Tabbed views (Today, Overdue, Upcoming), One-click status updates.
- **Logic**: Dynamic filtering based on `nextFollowup` date.

### 4. Projects Overview (`/projects`)
- **Components**: `ProgressBar`, `Card`, `Search`.
- **Features**: Project grid, Progress tracking, Tag-based searching.
- **Hook**: `useProjects`.

### 5. Project Creation (`/projects/new`)
- **Components**: `Select` (react-select), `Card`, `Badge`.
- **Features**: Tag management, Member assignment with role selection.

### 6. Project Detail (`/projects/:id`)
- **Components**: `ProjectList`, `ProjectKanban`, `ProjectTeam`, `ProjectAssets`, `TabSwitcher`.
- **Features**: Multi-tab view (List, Kanban, Team, Assets), Task detail modals, Real-time status sync.

### 7. Workspace Calendar (`/calendar`)
- **Components**: `CalendarEntryModal`, `PageHeader`, `MiniCalendar` (Internal).
- **Features**: Sync with Google Calendar, Public/Private event visibility, Indian Holiday integration.
- **Persistence**: MongoDB `CalendarEvent` model.

### 8. Daily Log Page (`/logs`)
- **Components**: `PlugConnectedIcon`, `Trophy`, `Timer`.
- **Features**: Work logging with project association, Goal progress bar (480m target).

### 9. Assets & Links (`/assets`)
- **Components**: `NexusModal`, `PageHeader`.
- **Features**: Drive folder links, Document management, Categorized asset grid.

### 10. Admin Panel (`/admin`)
- **Components**: `UserDetailModal`, `EmailMarketingContent`, `TscDataContent`, `AdminLogsContent`.
- **Features**: Multi-tab management (Users, CRM, Tsc Data, Mail, Logs).
- **Admin Specific**: Bulk delete (Tsc Data), User role management, SMTP profile config.

### 11. System Logs (`/admin/logs`)
- **Components**: `TabSwitcher`, `CalIcon`.
- **Features**: Detailed audit trails, User-specific activity feeds, Time-tracked duration analytics.

### 12. App Settings (`/settings`)
- **Components**: `CKDropdown`, `NexusModal`, `AvatarGallery`.
- **Features**: Profile updates, Theme toggle (Light/Dark), Password management, Avatar selection gallery.

### 13. Features Overview (`/features`)
- **Components**: `PageHeader`, `Card`.
- **Features**: Documentation of system modules and current functional status.

### 14. Personal Todo (`/todo`)
- **Components**: `Badge`, `Card`.
- **Features**: Quick task management, Status toggles, Project linking.

### 15. Authentication (`/login`, `/register`)
- **Components**: `LoginPage`, `RegisterPage`.
- **Features**: JWT-based auth, Google OAuth integration, Role-based redirect logic.

### 16. Artists Hub (`/artists`, `/artists/:id`)
- **Components**: `ArtistCard`, `StatCard`, `DataTable`, `InfoButton`.
- **Features**: Active roster management, multi-platform analytics (Spotify, YouTube, Meta), live API sync zap button, unlinked N/A defaults with layman linking instructions.
- **Data Hooks**: `/api/artists` and sub-platform endpoints.

## Technical Foundation
- **State Management**: `AuthContext`, `ThemeContext`, `SidebarContext`.
- **API Client**: Axios with interceptors (JWT in localStorage).
- **Hooks Library**: `client/src/hooks/useTaskmasterQueries.js` (Centralized TanStack Query).
- **Navigation**: React Router v6 (Lazy Loading).

## API Routes
- `/api/auth` — Login, register, token validation
- `/api/users` — User directory, profile, role management
- `/api/teams` — Team CRUD
- `/api/projects` — Project CRUD + member management
- `/api/tasks` — Task CRUD + status/progress updates
- `/api/logs` — Daily work logs + system activity
- `/api/chat` — Channel-based messaging
- `/api/crm` — Lead CRUD, CSV import, batch operations
- `/api/assets` — Asset CRUD with project linking
- `/api/calendar` — Persistent event CRUD with visibility controls
- `/api/artists` — Artist roster CRUD, live analytics syncing (`isSynced`), platform metric fetching

## Key Components
- `OutletSidebar` — Main navigation sidebar
- `TaskCreateModal` — Create new task form
- `TaskDetailModal` — Edit/view task details
- `ProjectSettingsModal` — Edit project name/description
- `ProjectList/Kanban/Gantt` — Project view modes
- `ProjectTeam` — Team members within a project
- `CRMLeadModal` — Create/edit CRM lead
- `CalendarEntryModal` — Create persistent calendar event
- `CKDropdown` — Custom accessibility-first dropdown with auto-focus search
- `NexusModal` — High-fidelity reusable modal with backdrop blur
- `CommandPalette` — Global `Ctrl+K` search and action hub
- `VelocitySparkline` / `ProgressRing` / `ActivityHeatmap` — High-density analytics primitives
- `Badge` / `ProgressBar` — Standard UI primitives
