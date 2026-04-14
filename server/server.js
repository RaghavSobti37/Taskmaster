import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import morgan from 'morgan';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import userRoutes from './routes/userRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import { loggerMiddleware } from './middleware/logMiddleware.js';
import { logger, getLogConfig } from './utils/logger.js';
import { requestTracking, corsDebug, authDebug, logEnvironmentInfo } from './middleware/debugMiddleware.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

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

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Request tracking and debugging (add early)
app.use(requestTracking);
app.use(corsDebug);
app.use(authDebug);

// HTTP request logger
app.use(morgan('combined'));

// Custom logger middleware for DB logging
app.use(loggerMiddleware);

// Serve static files (uploaded images)
app.use('/uploads', express.static('public/uploads'));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/upload', uploadRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  logger.info('Health check requested', 'HEALTH_CHECK', { ip: req.ip });
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    corsOrigins: allowedOrigins,
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// 404 handler (must be before error handler)
app.use(notFoundHandler);

// Error handler (must be LAST)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Get API base URL based on environment
const getApiBaseUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    // Render sets RENDER_EXTERNAL_URL or we can infer from environment
    return 'https://taskmaster-jfw0.onrender.com';
  }
  return `http://localhost:${PORT}`;
};

// Connect to Database and start server
const startServer = async () => {
  try {
    const logConfig = getLogConfig();
    logger.info('Server initialization started', 'STARTUP', {
      nodeEnv: process.env.NODE_ENV,
      port: PORT,
      logsDir: logConfig.logsDir
    });

    logEnvironmentInfo();
    
    await connectDB();
    
    // Try to start server, with fallback to alternate port if in use
    const primaryPort = parseInt(PORT) || 5000;
    const alternatePort = primaryPort === 5000 ? 5001 : 5000;
    let actualPort = primaryPort;
    
    const startOnPort = (port) => {
      return new Promise((resolve, reject) => {
        const server = app.listen(port, () => {
          actualPort = port;
          const apiBaseUrl = getApiBaseUrl();
          logger.info('Server started successfully', 'STARTUP', {
            port: actualPort,
            environment: process.env.NODE_ENV || 'development',
            apiBase: apiBaseUrl + '/api',
            corsOrigins: allowedOrigins
          });
          
          // Additional startup info
          console.log('\n========================================');
          console.log('✓ Server is running');
          console.log(`Port: ${actualPort}${actualPort !== primaryPort ? ` (fallback from ${primaryPort})` : ''}`);
          console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
          console.log(`API Base: ${apiBaseUrl}/api`);
          console.log(`Log Config: ${JSON.stringify(logConfig, null, 2)}`);
          console.log('========================================\n');
          resolve(server);
        });

        server.on('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            reject(err);
          } else {
            logger.error('Server error', 'STARTUP', err);
            process.exit(1);
          }
        });
      });
    };

    // Try primary port first, then alternate if needed
    try {
      await startOnPort(primaryPort);
    } catch (err) {
      if (err.code === 'EADDRINUSE') {
        logger.warn(`Port ${primaryPort} is already in use, trying port ${alternatePort}`, 'STARTUP', { 
          attemptedPort: primaryPort,
          alternatePort: alternatePort,
          error: err.message 
        });
        
        try {
          await startOnPort(alternatePort);
        } catch (retryErr) {
          logger.error(`Failed to start server on both ports ${primaryPort} and ${alternatePort}`, 'STARTUP', retryErr);
          process.exit(1);
        }
      } else {
        logger.error('Server error', 'STARTUP', err);
        process.exit(1);
      }
    }

    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      logger.critical('Uncaught exception', 'PROCESS', err);
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.critical('Unhandled rejection', 'PROCESS', { reason });
    });

  } catch (error) {
    logger.critical('Failed to start server', 'STARTUP', error);
    console.error('[CRITICAL] Server startup failed:', error);
    process.exit(1);
  }
};

startServer();