require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const authRoutes = require('./routes/authRoutes');
const projectRoutes = require('./routes/projectRoutes');
const taskRoutes = require('./routes/taskRoutes');
const userRoutes = require('./routes/userRoutes');
const logRoutes = require('./routes/logRoutes');
const chatRoutes = require('./routes/chatRoutes');
const teamRoutes = require('./routes/teamRoutes');
const crmRoutes = require('./routes/crmRoutes');

const app = express();

// Trust proxy for Render/Vercel (required for express-rate-limit)
app.set('trust proxy', 1);

// Middleware
app.use(helmet());
app.use(compression());

// Production CORS Configuration
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS ? process.env.CORS_ALLOWED_ORIGINS.split(',') : ['http://localhost:5173', 'http://localhost:5174'];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '10kb' }));
app.use(mongoSanitize());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000 
});
app.use('/api/', limiter);

// MongoDB Connection
const dbUri = (process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/coreknot').trim();

// Mask URI for logging
const maskedUri = dbUri.replace(/\/\/.*:.*@/, '//****:****@');
console.log(`[SYSTEM] Initializing DB Connection: ${maskedUri}`);

mongoose.connect(dbUri, {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
})
  .then(() => console.log('[SUCCESS] MongoDB Connected'))
  .catch(err => {
    console.error('[ERROR] Initial MongoDB connection failed:', err.message);
    console.log('[SYSTEM] Server will remain active but DB operations will fail until connection is established.');
  });

mongoose.connection.on('error', err => {
  console.error('[ERROR] Mongoose connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('[WARN] Mongoose disconnected. Attempting reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('[SUCCESS] Mongoose reconnected.');
});

// Routes
app.use('/api/auth', authRoutes);

// Apply logger to all subsequent routes (which usually require auth)
// Logger middleware
const systemLogger = require('./middleware/loggerMiddleware');
app.use(systemLogger);

app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/assets', require('./routes/assetRoutes'));
app.get('/', (req, res) => res.send('CoreKnot API Active'));

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  const message = process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message;
  res.status(500).json({ error: message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
