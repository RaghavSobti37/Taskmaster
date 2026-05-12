# CoreKnot Startup Guide

Follow these steps to initialize and run the CoreKnot enterprise platform.

## Prerequisites
- **Node.js**: v16+ recommended.
- **MongoDB**: Local instance running at `mongodb://localhost:27017/coreknot` (or update `.env`).

## 1. Backend Setup (Server)
1. Navigate to the `server` directory.
2. Ensure `.env` exists with correct `MONGODB_URI`.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
   *Server will run on http://localhost:5000*

## 2. Frontend Setup (Client)
1. Navigate to the `client` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *Client will run on http://localhost:5173*

## 3. Temporary Admin Access
For development purposes, a **DEBUG BYPASS** is available on the Login screen:
- Click the **"DEBUG: SYSTEM BYPASS (ADMIN)"** button to enter the dashboard with full administrative privileges immediately.

## Directory Structure
- `/server`: Node/Express API with Mongoose models.
- `/client`: React/Vite/Tailwind v4 frontend.
