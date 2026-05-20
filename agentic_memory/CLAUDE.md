# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Server (Backend)
- `npm run dev` - Start development server with nodemon (auto-restarts on changes)
- `npm start` - Start production server
- `npm run build` - Build client and prepare for production

### Client (Frontend)
- From client directory:
  - `npm run dev` - Start Vite development server
  - `npm run build` - Build for production
  - `npm run lint` - Run ESLint
  - `npm run preview` - Preview production build locally

### Database
- `node seeder.js` - Initialize database with sample data (run from server directory)

## Project Structure

### Architecture Overview
Taskmaster follows a MERN stack architecture with React/Vite frontend and Node.js/Express backend:

**Frontend (client/):**
- React 18 with Vite build tool
- State management via React Query (TanStack)
- Styling with Tailwind CSS v4
- Real-time features using Supabase Realtime
- Background jobs coordination with Trigger.dev
- File uploads handled by UploadThing
- Calendar integration with Google OAuth

**Backend (server/):**
- Node.js with Express.js framework
- MongoDB database using Mongoose ODM
- Modular route organization by feature
- Authentication via Clerk
- Email services using Resend
- Webhook handling with Svix verification
- Background job processing with BullMQ and Trigger.dev

### Key Directories
- `client/src/` - Frontend source code
  - `components/` - Reusable UI components
  - `pages/` - Route-based page components
  - `hooks/` - Custom React hooks
  - `utils/` - Utility functions
- `server/` - Backend source code
  - `routes/` - API route handlers
  - `controllers/` - Business logic
  - `models/` - Mongoose schemas
  - `services/` - External service integrations
  - `middleware/` - Custom Express middleware
  - `config/` - Configuration files

## Code Patterns & Conventions

### API Routes
- RESTful API design under `/api/` prefix
- Route files in `server/routes/` directory
- Authentication middleware applied to protected routes
- Error handling centralized in `server/middleware/errorMiddleware.js`

### Database Models
- Mongoose schemas in `server/models/`
- Lean queries used for performance (`Model.find().lean()`)
- Indexes defined on frequently queried fields
- Virtuals and middleware for derived properties

### State Management
- React Query for server state caching
- Optimistic updates for instant UI feedback
- Supabase Realtime subscriptions for live data sync
- Query invalidation patterns for data consistency

### File Uploads
- UploadThing integration via `server/config/uploadthing.js`
- React component wrapper in `client/src/components/ui/uploadthing.jsx`
- Edge storage configuration for performance

### Background Jobs
- Trigger.dev for long-running processes
- BullMQ queues for job orchestration
- Webhook endpoints for external service integrations

## Environment Variables
Required `.env` file in server directory:
- `MONGO_URI` - MongoDB connection string
- `JWT_SECRET` - Authentication token secret
- `RESEND_API_KEY` - Email service key
- `SUPABASE_URL` & `SUPABASE_ANON_KEY` - Realtime database
- `UPLOADTHING_SECRET` & `UPLOADTHING_APP_ID` - File storage
- `TRIGGER_DEV_API_KEY` - Background job processing
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET` - Calendar sync
- `CLERK_PUBLISHABLE_KEY` & `CLERK_SECRET_KEY` - Authentication

## Testing
- No formal test framework configured in current setup
- Manual testing recommended via development servers
- API testing possible with tools like Postman or curl

## Common Tasks
1. **Adding new feature**: Create route, controller, model, then frontend components
2. **Database changes**: Modify Mongoose model, run seeder if sample data needed
3. **UI updates**: Modify React components in client/src/, use Tailwind for styling
4. **Email functionality**: Use Resend service in server/services/mailService.js
5. **Webhook handling**: Check server/routes/track/ and server/routes/webhookRoutes.js

This CLAUDE.md file should help future instances of Claude Code quickly understand and work with the Taskmaster codebase.