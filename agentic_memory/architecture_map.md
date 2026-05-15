# System Architecture & Data Flow

How the Taskmaster ecosystem works — frontend to backend to database.

## Full System Map

```mermaid
graph TD
    subgraph Frontend ["Frontend (React/Vite)"]
        D[Dashboard]
        PL[Projects List]
        PD[Project Detail]
        AP[Admin Panel]
        DL[Daily Logs]
        AL[Admin Logs]
        CH[Team Chat]
        ST[Settings]
        CRM_F[CRM]
        TV[Team Directory]
        CV[Calendar]
        RQ["React Query (Cache Layer)"]
    end

    subgraph API ["Backend API (Node/Express)"]
        T_API["/api/tasks"]
        P_API["/api/projects"]
        U_API["/api/users"]
        L_API["/api/logs"]
        A_API["/api/auth"]
        TM_API["/api/teams"]
        C_API["/api/chat"]
        CR_API["/api/crm"]
        AS_API["/api/assets"]
        CAL_API["/api/calendar"]
    end

    subgraph Models ["Database (MongoDB/Mongoose)"]
        M_Task[(Task)]
        M_Project[(Project)]
        M_User[(User)]
        M_Log[(Log)]
        M_Phase[(Phase)]
        M_Team[(Team)]
        M_Message[(Message)]
        M_Lead[(Lead)]
        M_Asset[(Asset)]
        M_Event[(CalendarEvent)]
    end

    D & PL & PD & AP & DL & AL & CH & ST & CRM_F & TV & CV --> RQ
    RQ --> T_API & P_API & U_API & L_API & A_API & TM_API & C_API & CR_API & AS_API & CAL_API

    T_API --> M_Task
    P_API --> M_Project
    U_API --> M_User
    L_API --> M_Log
    A_API --> M_User
    TM_API --> M_Team
    C_API --> M_Message
    CR_API --> M_Lead
    AS_API --> M_Asset
    CAL_API --> M_Event

    M_Project -- "has" --> M_Phase
    M_Phase -- "contains" --> M_Task
    M_Task -- "assigned to" --> M_User
    M_User -- "member of" --> M_Team
    M_Project -- "assigned to" --> M_Team
    M_Log -- "records" --> M_User
    M_Asset -- "belongs to" --> M_Project
    M_Lead -- "assigned to" --> M_User
    M_Event -- "created by" --> M_User
```

## Performance & Caching Architecture

### Caching Layer (React Query)
The system uses `@tanstack/react-query` to manage server state.
- **Deduplication**: Multiple components can request the same data (e.g., current user) but only one network request is made.
- **Caching**: Data is cached for 5 minutes (`staleTime: 5m`). Navigating between pages is instantaneous.
- **Optimistic Updates**: Changes (like adding a log) appear in the UI immediately while the server syncs in the background.

### Backend Optimization
- **Lean Queries**: All read-only database fetches use `.lean()`. This bypasses Mongoose hydration, making API responses significantly faster.
- **Indexing**: Database fields used for filtering (`userId`, `projectId`, `createdAt`) are indexed for O(1) or O(log n) lookup speed.
- **Compression**: Gzip/Brotli compression is applied to all JSON responses to minimize bandwidth usage.

## Module Overview

| Module | What It Does | Key Interactions |
|---|---|---|
| **Frontend** | Renders the UI, manages local state | Uses React Query hooks for optimized data fetching |
| **Auth** | JWT-based login/register | Protects all `/api/*` routes except login/register |
| **Tasks** | Create, update, complete tasks | Status transitions trigger progress rollups + auto-logging |
| **Projects** | Organize work into projects | Contains phases, tasks, members, and teams |
| **Admin Panel** | Manage users, teams, roles | User directory, team creation, activity feed |
| **Daily Logs** | Time tracking + work entries | Managed via optimistic React Query mutations |
| **Team Chat** | Channel-based messaging | Mentions, file references, task creation from chat |
| **CRM** | Lead/contact management | CSV import, status tracking, rep assignment |
| **Assets** | Project resource links | Up to 3 links per asset, project-scoped |
| **Calendar** | Event scheduling | DB persistence, Public/Private visibility |

## Data Relationships

### Project → Phase → Task
Projects contain Phases (stages), which contain Tasks. Completing tasks auto-updates Phase and Project progress percentages.

### User → Team → Project
Users belong to Teams. Projects are assigned to Teams, giving all members access to the project's tasks.

### Log → Everything
The Log model records all system activity:
- `TASK_COMPLETION` — when a task status changes
- `DAILY_LOG` — manual work entries from users
- `CHAT_MESSAGE` — messages sent in chat
- `USER_LOGIN` — authentication events

### Lead → User
CRM leads are assigned to users (reps) for follow-up. Leads track status (New/Hot/Warm/Cold/Converted) and quality rating (1-5).

### Asset → Project
Assets store important links for a project. Each asset can hold up to 3 URLs.

### CalendarEvent → User
Calendar events are owned by users. Public events are visible to everyone; private events only to the owner.
