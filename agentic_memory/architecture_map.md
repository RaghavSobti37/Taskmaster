# System Architecture & Data Flow

This document maps the entire Taskmaster ecosystem, showing how the Frontend interacts with the Backend API and how data is structured in the Database.

## Integrated System Graph

```mermaid
graph TD
    %% Frontend Layer
    subgraph Frontend ["Frontend (React/Vite)"]
        D[Dashboard]
        PL[Project List]
        PD[Project Details]
        AP[Admin Panel]
        DL[Daily Logs]
        CH[Nexus Chat]
        ST[Settings]
    end

    %% API Layer
    subgraph API ["Backend API (Node/Express)"]
        T_API["/api/tasks"]
        P_API["/api/projects"]
        U_API["/api/users"]
        L_API["/api/logs"]
        A_API["/api/auth"]
        TM_API["/api/teams"]
    end

    %% Model Layer
    subgraph Models ["Mongoose Models (MongoDB)"]
        M_Task[(Task Model)]
        M_Project[(Project Model)]
        M_User[(User Model)]
        M_Log[(Log Model)]
        M_Phase[(Phase Model)]
        M_Team[(Team Model)]
    end

    %% Connections: Frontend to API
    D --> T_API
    D --> L_API
    PL --> P_API
    PD --> P_API
    PD --> T_API
    AP --> U_API
    AP --> L_API
    DL --> L_API
    DL --> P_API
    CH --> L_API
    ST --> U_API
    ST --> A_API

    %% Connections: API to Models
    T_API --> M_Task
    P_API --> M_Project
    U_API --> M_User
    L_API --> M_Log
    A_API --> M_User
    TM_API --> M_Team

    %% Connections: Model Relationships
    M_Project -- "has" --> M_Phase
    M_Phase -- "contains" --> M_Task
    M_Project -- "managed by" --> M_User
    M_Task -- "assigned to" --> M_User
    M_Log -- "records" --> M_User
    M_Log -- "links to" --> M_Project
    M_Log -- "links to" --> M_Task
    M_User -- "member of" --> M_Team
    M_Project -- "assigned to" --> M_Team
```

## Documentation Registry

| Module | Responsibility | Key Interactions |
| :--- | :--- | :--- |
| **Frontend** | UI Rendering & Local State | Consumes API via Axios, uses Framer Motion for premium feel. |
| **Auth System** | JWT-based Security | Protects all `/api/*` routes except `/api/auth/login`. |
| **Task Engine** | Workflow Logic | Handles status transitions (Todo -> Done) and auto-logging. |
| **Admin Deck** | User & Team Management | Multi-team assignments and role-based access control (RBAC). |
| **Log Stream** | Audit & Productivity | Tracks every system event and manual user work logs. |

## Data Schema Connections

### 1. Project -> Phase -> Task
Projects are divided into multiple **Phases** (Stages), which contain individual **Tasks**. Completion of tasks automatically rolls up to update Phase and Project progress percentages.

### 2. User -> Team -> Project
Users are organized into **Teams**. A Project can be assigned to one or more Teams, granting all members of those teams access to the project tasks.

### 3. Log -> Everything
The **Log** model acts as the central nervous system, recording:
- `TASK_COMPLETION`: When a task status changes.
- `DAILY_LOG`: Manual work entries from users.
- `CHAT_MESSAGE`: System-wide communication.
- `USER_LOGIN`: Security audit trails.
