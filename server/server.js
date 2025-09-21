import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import morgan from 'morgan';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import userRoutes from './routes/userRoutes.js';

// Load environment variables
dotenv.config();

// Connect to Database
connectDB();

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  'https://taskmaster-sand.vercel.app',
  // Removed trailing slash for consistency
];

// Middleware
app.use(cors());
app.use(express.json()); // Body parser for JSON
app.use(morgan('dev')); // HTTP request logger

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));