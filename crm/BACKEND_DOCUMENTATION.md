# TSC CRM Backend Documentation

This document provides a comprehensive overview of the TSC CRM backend structure, its operation, and a guide for migrating to a traditional database.

---

## 1. Backend Structure Overview

The CRM is built using **Next.js 14 (App Router)**. It follows a hybrid architecture where data is stored locally for performance and synced to a remote source for persistence and shared access.

### Core Directory Structure
- `app/api/`: RESTful API endpoints for leads, EMIs, audits, and synchronization.
- `lib/`: Core business logic and data access layers.
  - `csv-store.ts`: The primary Data Access Object (DAO) for local CSV files.
  - `holysheet.ts`: Client for the HolySheet API (Google Sheets integration).
  - `schema.ts`: Centralized definition of data structures and headers.
  - `auth.ts`: Authentication and session management.
- `data/`: Local storage directory for `.csv` files.
- `scripts/`: Utility scripts for maintenance and data tasks.

---

## 2. How It Works

### Data Persistence Model
The CRM uses a **Local-First with Remote Sync** strategy:
1.  **Local Storage**: All "write" operations (creating leads, updating status, adding EMIs) are performed on local CSV files located in the `data/` folder. This ensures near-instant response times.
2.  **Audit Logging**: Every change is recorded in `data/audit.csv`. This log tracks the timestamp, user, field changed, and old/new values.
3.  **Remote Sync**: A manual synchronization process (restricted to admins) reads the local CSVs and the audit log to push changes to **Google Sheets** via the **HolySheet API**.

### Key Workflows
- **Lead Management**: Fetched from `lib/csv-store.ts`. Updates are written back to `leads.csv` and an entry is added to `audit.csv`.
- **EMI Tracking**: Managed separately in `emis.csv`, linked to leads via `lead_row_id`.
- **Synchronization**: The sync route (`/api/sync/leads`) compares local data with Google Sheets and performs `POST` (for new rows) or `PATCH` (for updates) requests. It uses an incremental sync based on the `audit.csv` timestamp to avoid hitting Google Sheets rate limits.

### Specialized Logic
- **Lead Auto-Assignment**: Located in `lib/rep-assignment.ts`. It uses a **"Least-Loaded" strategy** to automatically assign incoming leads to sales reps based on their current workload (number of leads already assigned).
- **Row Locking**: Found in `lib/csv-store.ts`. When a sales rep opens a lead, a `locked_by` and `locked_at` timestamp are set to prevent other reps from editing the same lead simultaneously.

---

## 3. Database Migration Guide

If the project outgrows CSV files, follow these steps to migrate to a traditional database like **MongoDB** or **PostgreSQL**.

### Step 1: Data Export
The current source of truth is the `data/` directory.
1.  Collect `leads.csv`, `emis.csv`, and `audit.csv`.
2.  Convert these CSVs to JSON or SQL dump format.

### Step 2: Infrastructure Setup
1.  Initialize your database (e.g., a MongoDB Atlas cluster or a Supabase PostgreSQL instance).
2.  Add the connection string to the `.env` file.
3.  Install a database client/ORM (e.g., `npm install prisma` or `npm install mongoose`).

### Step 3: Schema Mapping
Map the headers in `lib/schema.ts` to your new database schema:
- **Leads**: `row_id` (Primary Key), `name`, `email`, `phone`, etc.
- **EMIs**: `row_id` (Primary Key), `lead_row_id` (Foreign Key), `amount`, etc.
- **Audit**: `timestamp`, `user_id`, `field_changed`, etc.

### Step 4: Refactor Data Access Layer (`lib/csv-store.ts`)
Instead of `fs.readFileSync` and `fs.writeFileSync`, update the functions to use your DB client.
Example (Mongoose):
```typescript
// Before
export function getLeads() {
  return parseCsv(readFileSync(LEADS_PATH, "utf8"));
}

// After
export async function getLeads() {
  return await LeadModel.find({});
}
```

### Step 5: Update API Routes
Since database operations are now asynchronous, ensure all API routes in `app/api/` use `await` when calling `lib/` functions.

### Step 6: Decommission Sync Logic
Once the migration is complete, the `lib/holysheet.ts` and `/api/sync` routes will no longer be necessary, as the database will provide real-time shared access.

---

## 4. Environment Variables
Ensure the following are configured in `.env`:
- `HOLYSHEET_API_KEY`: API key for Google Sheets sync.
- `HOLYSHEET_BASE_URL`: Base URL for the HolySheet service.
- `NEXT_PUBLIC_APP_URL`: The URL where the CRM is hosted.

---

## 5. Security & Access
- **Roles**: Defined in `lib/auth.ts`.
- **Sync Access**: Hardcoded to specific administrative IDs (e.g., `sr05`) in the sync route for safety.
- **Row Locking**: Prevents concurrent edits by different users on the same lead (see `locked_by` field).
