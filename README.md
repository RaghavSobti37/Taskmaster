# Taskmaster: Enterprise Work Management

Taskmaster (formerly CoreKnot) is a premium, high-fidelity work orchestration platform designed for maximum operational clarity. It eliminates complexity through an "idiot-proof" interface, robust task automation, and a centralized administrative command center.

![Banner](https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2426&auto=format&fit=crop)

## 🚀 Key Features

- **Intuitive Dashboard**: A streamlined "Control Center" for tracking your projects and tasks without the jargon.
- **Dynamic Task Tracking**: Fluid transitions between Todo, Working, Review, and Done states with automatic progress rollups.
- **Daily Activity Logs**: Effortless time tracking and work logging with automated captures for every system event.
- **Admin Panel**: Centralized user management, team orchestration, and a live system activity feed.
- **Nexus Chat**: Real-time communication integrated directly with project workflows.
- **High-Fidelity UI**: Premium design system utilizing OKLCH colors, glassmorphism, and fluid Framer Motion animations.

## 🛠 Technology Stack

- **Frontend**: React 18, Vite, Tailwind CSS v4, Framer Motion, Lucide Icons.
- **Backend**: Node.js, Express, JWT Authentication.
- **Database**: MongoDB with Mongoose ODM.
- **Architecture**: RESTful API with automated logic rollups and activity logging.

## 🏗 System Architecture

Taskmaster follows a robust n-tier architecture connecting a reactive frontend to a persistent document-driven backend.

### Integrated System Graph

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

## 🏁 Getting Started

### Prerequisites
- **Node.js**: v16+
- **MongoDB**: Local instance running at `mongodb://localhost:27017/coreknot` (or update `.env`)

### Installation & Startup

1. **Backend Setup**:
   ```bash
   cd server
   npm install
   npm run dev
   ```
   *Server runs on http://localhost:5000*

2. **Frontend Setup**:
   ```bash
   cd client
   npm install
   npm run dev
   ```
   *Client runs on http://localhost:5173*

3. **Seeding (Optional)**:
   To populate the system with core team members and sample projects:
   ```bash
   cd server
   node seeder.js
   ```

## 🔐 Authentication & Access

### Default Admin Accounts (Password: 1234)
- `raghavraj@theshakticollective.in`
- `harshika@theshakticollective.in`
- `rohith@theshakticollective.in`
- `ops@theshakticollective.in`
- `atharva@theshakticollective.in`

### Debug Access
During development, a **DEBUG BYPASS** button is available on the login screen for immediate root admin access.

## 📂 Project Structure

```text
/server         - Node/Express API, Mongoose Models, Controllers
/client         - React/Vite/Tailwind v4 Frontend
/agentic_memory - AI-assisted project documentation and architecture maps
/crm            - Integrated HolySheet CRM modules
```

---
*Built with precision for The Shakti Collective.*
