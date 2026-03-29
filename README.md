# CoreKnot - Team Task Management with Shakti Collective Branding

## Quick Start Guide

### Prerequisites
- Node.js (v16+)
- npm or yarn
- MongoDB connection (configured in `.env`)

### Setup Instructions

#### 1. Frontend Setup (Client)
```bash
cd client
npm install
npm run dev
```
Frontend will be available at: **http://localhost:5173**

#### 2. Backend Setup (Server)
In a new terminal:
```bash
cd server
npm install
npm run dev
```
Backend will be available at: **http://localhost:5000**

### Environment Configuration

**Client** (`.env.local` in `/client`):
```
VITE_API_URL=http://localhost:5000
```

**Server** (`.env` in `/server`):
```
PORT=5000
MONGO_URI=<your-mongodb-connection-string>
JWT_SECRET=a_very_strong_and_secret_key_that_is_long
```

### Verify Everything is Working
1. Frontend loads at http://localhost:5173
2. You can see network requests going to http://localhost:5000/api
3. Try logging in with your credentials

## Troubleshooting

### Connection Refused Error
- Make sure the backend server is running (`npm run dev` in `/server` folder)
- Check that port 5000 is available with `netstat -ano | findstr :5000` (Windows)
- Verify `.env` in server has `PORT=5000`

### "Failed to login" Error
- Check browser console for detailed error messages
- Verify MongoDB connection is working
- Check server terminal for error logs

## Project Structure

```
src/
├── api/
│   └── index.js           # Axios configuration
├── components/
│   ├── TeamDashboard.jsx  # Team management
│   ├── TaskBoard.jsx      # Task management
│   └── BrandedLayout.jsx  # Shakti branding wrapper
├── contexts/
│   ├── AuthContext.jsx    # Authentication
│   └── TeamContext.jsx    # Team management
├── styles/
│   └── brand.css          # Shakti Collective branding
├── pages/
│   ├── LoginPage.jsx
│   ├── RegisterPage.jsx
│   ├── DashboardPage.jsx
│   └── TeamPage.jsx
└── App.jsx

backend/
├── app.py                 # Flask app
├── routes/
│   ├── auth.py
│   ├── teams.py
│   ├── tasks.py
│   └── logs.py
├── models.py
├── config.py
└── logs.db
```

## Brand Colors (Shakti Collective)
- Primary: Pumpkin (#b74b02), Deep Teal (#083d3a), Cream (#ffecd1)
- Secondary: Sea Foam (#126d5e), Wine (#6d2034), Mustard (#ad6517)

## Features
- ✅ Team creation and management
- ✅ Task assignment (self and team members)
- ✅ Real-time task updates
- ✅ Backend dashboard with logs
- ✅ Shakti Collective brand aesthetic
- ✅ User authentication - Collaborative Task Management App

CoreKnot is a full-stack web application built with the MERN stack (MongoDB, Express.js, React, Node.js) designed for personal and collaborative task management. Users can create tasks, set priorities, and assign them to other users within their "circle."

## ✨ Features

- **User Authentication**: Secure registration and login system with JWT, allowing users to sign in with either a username or email.
- **Task Management**: Full CRUD (Create, Read, Update, Delete) functionality for tasks.
- **Priority System**: Categorize tasks as Normal, Important, or Urgent with distinct visual tags.
- **Collaborative Circles**: Add other users to a personal "circle" to enable task assignment.
- **Task Assignment**: Assign tasks to yourself or to any user within your circle.
- **Dynamic Dashboard**: View tasks assigned to you and tasks you've created in separate, organized columns.
- **Real-time User Search**: Find and add users to your circle with a debounced search interface.
- **Modern UI/UX**: A vibrant, professional, and fully responsive design system.
- **Theme Customization**: Seamlessly toggle between a light and dark mode.
- **Backend Logging**: Logs user actions like task creation, completion, and assignment for auditing purposes.

## 🚀 Tech Stack

- **Frontend**:
  - React
  - Vite
  - React Router
  - Axios
- **Backend**:
  - Node.js
  - Express.js
- **Database**:
  - MongoDB
  - Mongoose
- **Authentication**:
  - JSON Web Tokens (JWT)
  - bcrypt.js

## 📂 Project Structure

The project is organized into two main directories: `client` for the frontend and `server` for the backend.

```
CoreKnot/
├── client/         # React Frontend
└── server/         # Node.js/Express Backend
```

## ⚙️ Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

- Node.js (v18.x or higher)
- MongoDB or a MongoDB Atlas account.

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd CoreKnot
    ```

2.  **Setup the Backend:**
    ```bash
    cd server
    npm install
    ```
    - Create a `.env` file in the `server` directory and add your environment variables:
      ```
      MONGO_URI=<your_mongodb_connection_string>
      JWT_SECRET=<your_jwt_secret>
      PORT=5001
      ```

3.  **Setup the Frontend:**
    ```bash
    cd ../client
    npm install
    ```

### Available Scripts

-   **Run the Backend Server:**
    From the `/server` directory:
    ```bash
    npm run dev
    ```

-   **Run the Frontend Application:**
    From the `/client` directory:
    ```bash
    npm run dev
    ```

-   **Seed the Database:**
    To populate the database with test users, run this command from the `/server` directory:
    ```bash
    npm run data:import
    ```