import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import morgan from 'morgan';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import userRoutes from './routes/userRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { loggerMiddleware } from './middleware/logMiddleware.js';

// Load environment variables
dotenv.config();

// Connect to Database
connectDB();

const app = express();

const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:5174', 'https://taskmaster-sand.vercel.app'];

// Middleware
app.use(cors({ origin: allowedOrigins }));
app.use(express.json()); // Body parser for JSON
app.use(morgan('dev')); // HTTP request logger
app.use(loggerMiddleware); // Custom logger middleware for DB logging

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));