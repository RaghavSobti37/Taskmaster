<p align="center">
  <img src="Taskmaster/client/public/coreknot-logo.svg" alt="CoreKnot logo" width="280" height="64" />
</p>

<h1 align="center">Coreknot</h1>

<p align="center">
  All-in-one operations platform — project management, CRM, email campaigns, finance, attendance, and team coordination.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/visibility-public-brightgreen" alt="Public repository" />
  <img src="https://img.shields.io/badge/maintained-yes-blue" alt="Maintained" />
  <img src="https://img.shields.io/badge/owner-CoreKnot-111827" alt="Owner" />
</p>
<p align="center">
  <a href="https://taskmaster-sand.vercel.app"><strong>Live Project</strong></a>
</p>


## Overview

CoreKnot is a multi-tenant workspace suite for modern operations teams — project governance, CRM, email campaigns, attendance, finance, and admin tooling in one integrated platform with role-based access and real-time collaboration.

This README explains the purpose, stack, setup flow, and maintenance expectations so the repository is easier to evaluate, run, and extend.

## Highlights

- Unified workspace — Projects, CRM, email campaigns, attendance, finance, and admin console in one platform with role-based access
- Multi-tenant isolation — Organisations share one deployment with complete data separation
- Rich UI — React 18, Tailwind v4, TanStack Query with PWA support, dark/light themes, keyboard shortcuts, and responsive layouts
- Offline-capable — Local-first architecture with SQLite, background mutation queue, and service worker caching
- Desktop + Mobile — Native wrappers via Electron (Windows/Mac) and Capacitor (Android/iOS)
- API-first design — Express REST API with Mongoose, Redis/BullMQ workers, Supabase mirror, and OpenAPI spec

## Tech Stack

- React 18 · TanStack Query · React Router 6 · Tailwind v4 · Framer Motion
- Express · Mongoose · NestJS (ETL pipelines) · BullMQ
- MongoDB Atlas · Redis · Supabase · Postgres
- Clerk (auth) · Resend (email) · UploadThing (file uploads)
- Vite 5 · Electron · Capacitor
- Vercel (SPA) · Render (API)

<p>
  <img src="https://img.shields.io/badge/React-111827?style=flat" alt="React" />
  <img src="https://img.shields.io/badge/Express-111827?style=flat" alt="Express" />
  <img src="https://img.shields.io/badge/MongoDB-111827?style=flat" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Vite-111827?style=flat" alt="Vite" />
  <img src="https://img.shields.io/badge/Tailwind-111827?style=flat" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Electron-111827?style=flat" alt="Electron" />
  <img src="https://img.shields.io/badge/Capacitor-111827?style=flat" alt="Capacitor" />
</p>

## Getting Started

### Prerequisites

- Node.js >= 20.x with npm 11.x
- MongoDB — local or Atlas connection string
- Redis — local or cloud instance (BullMQ queues)
- Git — version control and hooks

### Installation

```bash
git clone https://github.com/YOUR_USERNAME/CoreKnot.git
cd CoreKnot
npm install
```

Installs all workspaces (client, server, desktop, nestjs-server, shared/contracts) via npm workspaces.

### Development

```bash
npm run dev
```

Starts the Express API (port 5000) and Vite dev server (port 5173) concurrently.

### Production Build

```bash
npm run build
```

Builds the client SPA via Vite with code splitting, tree shaking, and PWA service worker generation.

## Project Structure

The repository is organized around the monorepo workspaces, configuration files, and project assets needed to run or extend the application. The `Taskmaster/` directory holds the core client (React SPA with 140+ page components, hooks, and a shared UI library), server (Express REST API with controllers, Mongoose models, middleware, and BullMQ workers), and desktop (Electron wrapper with auth navigation and auto-update). Shared packages live in `Taskmaster/packages/` for design tokens, local database, sync engine, and UI components. The `shared/` directory provides runtime config and validation contracts, while `scripts/`, `e2e/`, and `docs/` handle CLI automation, Playwright tests, and architecture reference. Additional workspaces include `nestjs-server/` for async ETL pipelines and `sites/` for Vercel subdomain configurations.

## Quality Notes

- Automated exposure scanning prevents hardcoded secrets/PII in committed files
- Server-side Jest tests and Playwright E2E suite run on every push
- TypeScript typechecking via tsc, ESLint linting, and dependency cruiser for module boundaries
- Pre-commit hooks run lint-staged and secret detection via Husky
- Real secrets live in env vars; committed examples use placeholder values

## Topics

- operations-platform
- project-management
- crm
- email-campaigns
- team-attendance
- finance
- pwa
- electron
- capacitor

## Author

Built and maintained by Raghav Raj Sobti.

Project link: [https://taskmaster-sand.vercel.app](https://taskmaster-sand.vercel.app)

