# Taskmaster

**Taskmaster** (formerly CoreKnot) is a team work management platform for tracking projects, tasks, daily work logs, and team communication — all in one place.

![Banner](https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2426&auto=format&fit=crop)

## What It Does

| Feature | Description |
|---|---|
| **Dashboard** | See all your tasks at a glance with quick filters and completion tracking |
| **Projects** | Create projects, add team members, track progress with List/Kanban/Gantt views |
| **Daily Logs** | Log your work each day with time tracking and project tagging |
| **Team Chat** | Send messages, mention teammates, create tasks from chat |
| **CRM** | Manage leads and contacts with import, status tracking, and assignment |
| **Assets** | Store important links (up to 3 per asset) organized by project |
| **Admin Panel** | Manage users, teams, roles, and view system activity |
| **Settings** | Update your profile, avatar, and app preferences |

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS v4, Framer Motion, Lucide Icons |
| Backend | Node.js, Express, JWT Authentication |
| Database | MongoDB with Mongoose ODM |
| Architecture | RESTful API with auto-logging and progress rollups |

## System Architecture

```mermaid
graph TD
    subgraph Frontend ["Frontend (React/Vite)"]
        D[Dashboard]
        PL[Projects]
        PD[Project Detail]
        AP[Admin Panel]
        DL[Daily Logs]
        CH[Team Chat]
        ST[Settings]
        CRM_F[CRM]
        ASSETS[Assets]
        TV[Team Directory]
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
    end

    subgraph Models ["Database (MongoDB)"]
        M_Task[(Task)]
        M_Project[(Project)]
        M_User[(User)]
        M_Log[(Log)]
        M_Phase[(Phase)]
        M_Team[(Team)]
        M_Message[(Message)]
        M_Lead[(Lead)]
        M_Asset[(Asset)]
    end

    D --> T_API
    D --> L_API
    PL --> P_API
    PD --> P_API & T_API
    AP --> U_API & L_API & TM_API
    DL --> L_API & P_API
    CH --> C_API
    ST --> U_API & A_API
    CRM_F --> CR_API
    ASSETS --> AS_API & P_API
    TV --> U_API & TM_API

    T_API --> M_Task
    P_API --> M_Project
    U_API --> M_User
    L_API --> M_Log
    A_API --> M_User
    TM_API --> M_Team
    C_API --> M_Message
    CR_API --> M_Lead
    AS_API --> M_Asset

    M_Project -- "has" --> M_Phase
    M_Phase -- "contains" --> M_Task
    M_Task -- "assigned to" --> M_User
    M_User -- "member of" --> M_Team
    M_Project -- "assigned to" --> M_Team
    M_Log -- "records" --> M_User
    M_Asset -- "belongs to" --> M_Project
```

## Getting Started

### Prerequisites
- **Node.js** v16+
- **MongoDB** running locally at `mongodb://localhost:27017/coreknot`

### Quick Start

```bash
# 1. Start the backend
cd server
npm install
npm run dev
# Server runs on http://localhost:5000

# 2. Start the frontend (new terminal)
cd client
npm install
npm run dev
# App opens at http://localhost:5173
```

### Seed Test Data (Optional)
```bash
cd server
node seeder.js
```

## Login

### Test Accounts (Password: `1234`)
- `REDACTED_ADMIN@example.com`
- `redacted-staff@example.com`
- `redacted-staff@example.com`
- `ops@theshakticollective.in`
- `atharva@theshakticollective.in`

### Quick Login (Dev)
Click **"Quick Login (Admin Demo)"** on the login screen for instant admin access.

## Project Structure

```
/server             — Node/Express API, Mongoose Models, Controllers
/client             — React/Vite Frontend
/agentic_memory     — Architecture docs and project documentation
```

### Key Frontend Pages

| Page | File | Purpose |
|---|---|---|
| Dashboard | `Dashboard.jsx` | Task overview with completion + undo |
| Projects | `ProjectsView.jsx` | List all projects |
| Project Detail | `ProjectDetail.jsx` | List/Kanban/Gantt/Team views per project |
| Daily Logs | `DailyLogPage.jsx` | Log work entries with time tracking |
| Team Chat | `ChatPage.jsx` | Real-time messaging with channels |
| Team Directory | `TeamView.jsx` | Browse all team members |
| CRM | `CRMPage.jsx` | Lead management with CSV import |
| Assets | `AssetsPage.jsx` | Project resources and links |
| Admin Panel | `AdminPanel.jsx` | User/team management + activity feed |
| Settings | `SettingsPage.jsx` | Profile, avatar, preferences |
| Login | `LoginPage.jsx` | Authentication entry |
| Register | `RegisterPage.jsx` | New account creation |

### Key Backend Routes

| Route | Purpose |
|---|---|
| `/api/auth/*` | Login, register, token validation |
| `/api/tasks/*` | CRUD tasks, status/progress updates |
| `/api/projects/*` | CRUD projects, member management |
| `/api/users/*` | User directory, profile, role management |
| `/api/teams/*` | Team creation and listing |
| `/api/logs/*` | Daily work logs and system activity |
| `/api/chat/*` | Channel-based messaging |
| `/api/crm/*` | Lead CRUD, CSV import, batch operations |
| `/api/assets/*` | Asset CRUD with project linking |

---
*Built for The Shakti Collective.*
