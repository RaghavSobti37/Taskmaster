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

    D --> T_API & L_API
    PL --> P_API
    PD --> P_API & T_API
    AP --> U_API & L_API & TM_API & CR_API
    DL --> L_API & P_API
    AL --> L_API & U_API
    CH --> C_API
    ST --> U_API & A_API
    CRM_F --> CR_API
    ASSETS --> AS_API & P_API
    TV --> U_API & TM_API
    CV --> CAL_API

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

## Module Overview

| Module | What It Does | Key Interactions |
|---|---|---|
| **Frontend** | Renders the UI, manages local state | Calls API via Axios, animates via Framer Motion |
| **Auth** | JWT-based login/register | Protects all `/api/*` routes except login/register |
| **Tasks** | Create, update, complete tasks | Status transitions trigger progress rollups + auto-logging |
| **Projects** | Organize work into projects | Contains phases, tasks, members, and teams |
| **Admin Panel** | Manage users, teams, roles | User directory, team creation, activity feed |
| **Daily Logs** | Time tracking + work entries | Manual entries + auto-captured task completions |
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
