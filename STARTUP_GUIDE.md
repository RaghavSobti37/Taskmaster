# Taskmaster Startup Guide

Follow these steps to run the Taskmaster app locally.

## Prerequisites
- **Node.js** v16 or newer
- **MongoDB** running locally at `mongodb://localhost:27017/coreknot` (or set your own in `.env`)

## Step 1: Start the Backend

```bash
cd server
npm install
npm run dev
```
The API server starts on **http://localhost:5000**

## Step 2: Start the Frontend

```bash
cd client
npm install
npm run dev
```
The app opens at **http://localhost:5173**

## Step 3: Log In

### Option A — Use Test Accounts
These accounts are pre-seeded with password `1234`:
| Email | Role |
|---|---|
| `raghavraj@theshakticollective.in` | Admin |
| `harshika@theshakticollective.in` | Admin |
| `rohith@theshakticollective.in` | Admin |
| `ops@theshakticollective.in` | Admin |
| `atharva@theshakticollective.in` | Admin |

### Option B — Quick Login (Dev Only)
Click the **"Quick Login (Admin Demo)"** button on the login screen to bypass authentication and enter as the root admin.

### Option C — Register a New Account
Go to the Register page and create a new account. New accounts default to the `user` role.

## Step 4: Seed Sample Data (Optional)

```bash
cd server
node seeder.js
```
This creates test users, teams, and sample projects.

## Directory Structure

```
/server         — Backend API (Node.js, Express, MongoDB)
/client         — Frontend app (React, Vite)
/agentic_memory — Project documentation and architecture maps
```

## Troubleshooting

| Problem | Fix |
|---|---|
| MongoDB connection error | Make sure MongoDB is running locally |
| Port 5000 in use | Change `PORT` in `server/.env` |
| Blank page on frontend | Check that the backend is running first |
| Login fails | Run `node seeder.js` in `/server` to create test accounts |
