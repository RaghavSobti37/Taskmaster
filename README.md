# Taskmaster - Collaborative Task Management App

Taskmaster is a full-stack web application built with the MERN stack (MongoDB, Express.js, React, Node.js) designed for personal and collaborative task management. Users can create tasks, set priorities, and assign them to other users within their "circle."

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
Taskmaster/
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
    cd Taskmaster
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