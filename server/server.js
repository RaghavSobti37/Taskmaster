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

const app = express();

const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:5174', 'https://taskmaster-sand.vercel.app'];

// Middleware
app.use(cors({ 
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
// Increased limit to 10MB to handle base64-encoded profile pictures
app.use(express.json({ limit: '10mb' })); // Body parser for JSON
app.use(morgan('dev')); // HTTP request logger
app.use(loggerMiddleware); // Custom logger middleware for DB logging

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    corsOrigins: allowedOrigins
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(err.status || 500).json({ 
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'production' ? {} : err 
  });
});

const PORT = process.env.PORT || 5000;

// Connect to Database and start server
const startServer = async () => {
  try {
    console.log('[STARTUP] Initializing server...');
    console.log('[STARTUP] NODE_ENV:', process.env.NODE_ENV);
    console.log('[STARTUP] CORS Origins:', allowedOrigins);
    
    await connectDB();
    
    app.listen(PORT, () => {
      console.log('[STARTUP] Server running on port', PORT);
      console.log('[STARTUP] API base: http://localhost:' + PORT + '/api');
    });
  } catch (error) {
    console.error('[STARTUP] Failed to start server:', error);
    process.exit(1);
  }
};

startServer();