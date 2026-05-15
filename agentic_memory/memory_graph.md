# Taskmaster Memory Graph

## Architecture
- **Frontend**: React 18 (Vite), Tailwind CSS v4, Framer Motion, Lucide Icons, **React Query (TanStack)**
- **Backend**: Node.js, Express, JWT Authentication, Compression
- **Database**: MongoDB with Mongoose ODM (.lean() optimized)
- **Core Entities**: User, Team, Project, Phase, Task, Log, Message, Lead, Asset, CalendarEvent

## Data Hooks (React Query)
- `useTasks` — Managed task fetching with caching
- `useLogs` — Managed activity log fetching
- `useProjects` — Managed project fetching
- `useUserDirectory` — Centralized user data
- `useCreateLog` — Optimistic work entry creation
- `useDebounce` — Input stabilization hook

## Pages (12 total)
1. Dashboard — Task overview + completion tracking
2. ProjectsView — List all projects
3. ProjectCreate — Create new project with team members
4. ProjectDetail — List/Kanban/Gantt/Team views per project
5. TeamView — Browse team members with filters
6. DailyLogPage — Log daily work entries + time tracking
7. AdminLogsPage — Admin view of all user logs
8. ChatPage — Channel-based team messaging
9. CRMPage — Lead/contact management
10. AssetsPage — Project resources and links
11. AdminPanel — User/team/role management + activity feed
12. SettingsPage — Profile, avatar, preferences
13. LoginPage — Authentication
14. RegisterPage — Account creation
15. CalendarView — Calendar overview

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

## Key Components
- `OutletSidebar` — Main navigation sidebar
- `TaskCreateModal` — Create new task form
- `TaskDetailModal` — Edit/view task details
- `ProjectSettingsModal` — Edit project name/description
- `ProjectList/Kanban/Gantt` — Project view modes
- `ProjectTeam` — Team members within a project
- `CRMLeadModal` — Create/edit CRM lead
- `CalendarEntryModal` — Create persistent calendar event
- `CKDropdown` — Custom styled dropdown component
- `NexusModal` — Reusable confirmation/alert modal
- `Badge` / `ProgressBar` — UI primitives
