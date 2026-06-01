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
const googleRoutes = require('./routes/googleRoutes');
const artistRoutes = require('./routes/artistRoutes');
const proxyRoutes = require('./routes/proxyRoutes');


const app = express();
const fs = require('fs');
const path = require('path');

// Global Performance Logger
app.use((req, res, next) => {
    const start = process.hrtime();
    res.on('finish', () => {
        const diff = process.hrtime(start);
        const timeInMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
        const logEntry = `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${timeInMs}ms - Status: ${res.statusCode}\n`;
        
        // Log to file for the report
        fs.appendFile(path.join(__dirname, 'performance.log'), logEntry, (err) => {
            if (err) console.error('Logging failed', err);
        });
    });
    next();
});

// Trust proxy for Render/Vercel (required for express-rate-limit)
app.set('trust proxy', 1);

// Middleware
app.use(helmet());
app.use(compression());

// Production CORS Configuration
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://tsccoreknot.com',
  'https://www.tsccoreknot.com',
  'https://theshakticollective.in',
  'https://www.theshakticollective.in'
];

const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsAllowlist = new Set([
  ...DEFAULT_ALLOWED_ORIGINS,
  ...allowedOrigins
]);

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (corsAllowlist.has(origin)) return callback(null, true);
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-skip-toast', 'X-Skip-Toast', 'X-Trace-Id', 'x-trace-id'],
  exposedHeaders: ['x-ratelimit-remaining', 'x-ratelimit-reset', 'ratelimit-remaining', 'ratelimit-reset']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ 
  limit: '50mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(mongoSanitize({ allowDots: true }));

// Rate Limiting (Loosened for CRM usage)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 1000 : 2000 
});
app.use('/api/', limiter);

// Strict Rate Limiting for Auth Routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 10 : 100, // Relaxed for dev
  message: { error: 'Too many authentication attempts, please try again after 15 minutes.' }
});
app.use('/api/auth/', authLimiter);

// Rate limit public tracking endpoints (outside /api/ limiter scope)
const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 300 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many tracking requests, please try again later.' },
});
app.use((req, res, next) => {
  const path = req.path || '';
  if (
    path.startsWith('/open/')
    || path.startsWith('/click/')
    || path === '/unsubscribe'
    || path.startsWith('/webhooks/')
    || path.startsWith('/api/track')
  ) {
    return trackLimiter(req, res, next);
  }
  return next();
});

// System Health Check Middleware
const SystemHealthService = require('./services/SystemHealthService');
app.use('/api/', SystemHealthService.middleware);

const traceMiddleware = require('./middleware/traceMiddleware');
app.use(traceMiddleware);

// MongoDB Connection
const isProd = process.env.NODE_ENV === 'production';
const isVercelPreview = process.env.VERCEL_ENV === 'preview';
const vercelBranch = process.env.VERCEL_GIT_COMMIT_REF;

let dbUri;

if (isVercelPreview && process.env.MONGODB_URI) {
  // Vercel preview deployments use local database
  dbUri = process.env.MONGODB_URI.trim();
  console.log(`[VERCEL PREVIEW] Using local MongoDB for branch: ${vercelBranch}`);
} else if (isProd) {
  // Production uses production database
  dbUri = (process.env.MONGODB_URI_PROD || process.env.MONGODB_URI).trim();
} else {
  // Development uses local or specified database
  dbUri = (process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/testing').trim();
}

// Local mail tests: tracking pixels hit public API which reads prod DB — opt-in sync
if (!isProd && !isVercelPreview && process.env.MAIL_USE_PROD_DB === 'true' && process.env.MONGODB_URI_PROD) {
  dbUri = process.env.MONGODB_URI_PROD.trim();
  console.log('[SYSTEM] MAIL_USE_PROD_DB=true — using production MongoDB for mail tracking sync');
}

// Mask URI for logging
const maskedUri = dbUri.replace(/\/\/.*:.*@/, '//****:****@');
console.log(`[SYSTEM] Initializing DB Connection: ${maskedUri}`);

mongoose.connect(dbUri, {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 60000,
  heartbeatFrequencyMS: 10000,
})
  .then(() => {
    console.log('[SUCCESS] MongoDB Connected');

    const { resolveTrackingApiBaseUrl, getTrackingDbMismatchWarning } = require('./utils/trackingUrls');
    console.log(`[MAIL] Tracking pixel base URL: ${resolveTrackingApiBaseUrl()}`);
    const trackingWarn = getTrackingDbMismatchWarning();
    if (trackingWarn) console.warn('[MAIL] ⚠ ' + trackingWarn);
    
    // Auto-repair zero-dipped history snapshots in background (non-blocking)
    setImmediate(async () => {
      try {
        if (mongoose.connection.readyState !== 1) return;
        const Artist = require('./models/Artist');
        const artists = await Artist.find().select('_id name analytics analyticsHistory').lean();
        for (const artist of artists) {
          if (artist.analyticsHistory && artist.analyticsHistory.length > 0) {
            const currentIg = artist.analytics?.instagram?.followers || 0;
            const currentSp = artist.analytics?.spotify?.followers || 0;

            const cleanHistory = artist.analyticsHistory.filter((h) => {
              const ig = h.metrics?.instagram?.followers;
              const sp = h.metrics?.spotify?.followers;
              if (currentIg > 0 && ig === 0) return false;
              if (currentSp > 0 && sp === 0) return false;
              return true;
            });

            if (cleanHistory.length !== artist.analyticsHistory.length) {
              const removedCount = artist.analyticsHistory.length - cleanHistory.length;
              await Artist.findByIdAndUpdate(artist._id, {
                $set: { analyticsHistory: cleanHistory },
              });
              console.log(`🧹 [Database Repair] Cleaned ${removedCount} corrupted snapshots for ${artist.name}`);
            }
          }
        }
      } catch (err) {
        console.error('❌ [Database Repair] Error during startup scan:', err.message);
      }
    });
  })
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
app.use('/api/system-logs', require('./routes/systemLogRoutes'));
app.use('/api/chat', chatRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/artists', artistRoutes);
app.use('/api/auth', require('./routes/authConnectRoutes'));
app.use('/api/v2/artists', require('./routes/artistV2Routes'));
    app.use('/api/gamification', require('./routes/gamificationRoutes'));
    app.use('/api/gamification-admin', require('./routes/gamificationAdminRoutes'));
app.use('/api/qa', require('./routes/qaRoutes'));
app.use('/api/customization', require('./routes/customizationRoutes'));

// Public tracking webhooks & unsubscribe endpoints
app.use(require('./routes/track')); // Mounts /webhooks/bounces and /unsubscribe at root
app.post('/api/crm/unsubscribe', async (req, res) => {
  const { email, reason } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    const Lead = require('./models/Lead');
    const cleanEmail = email.toLowerCase().trim();
    const leadDoc = await Lead.findOne({ email: cleanEmail });
    const leadName = leadDoc ? leadDoc.name : '';

    await Lead.updateMany(
      { email: cleanEmail },
      { $set: { unsubscribed: true, unsubscribeReason: reason || 'Opt-out', emailStatus: 'Unsubscribed', status: 'inactive' } }
    );

    // Sync to HolySheet
    const { syncUnsubscribeToSheet } = require('./services/holySheetService');
    await syncUnsubscribeToSheet({
      email: cleanEmail,
      name: leadName,
      campaignId: 'CRM_MANUAL',
      reason: reason || 'Opt-out',
      unsubscribedAt: new Date()
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use('/api/crm', crmRoutes);
app.use('/api/assets', require('./routes/assetRoutes'));
app.use('/api/google', googleRoutes);
app.use('/api/google/accounts', require('./routes/googleAccounts'));
app.use('/api/proxy', proxyRoutes);
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/calendar', require('./routes/calendarRoutes'));
app.use('/api/departments', require('./routes/departmentRoutes'));
app.use('/api/schedule', require('./routes/scheduleRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/notes', require('./routes/noteRoutes'));
app.use('/api/pinboard', require('./routes/pinBoardRoutes'));
app.use('/api/mail', require('./routes/mailRoutes'));
app.use('/api/ses', require('./routes/sesRoutes'));
app.use('/api/tsc', require('./routes/tscRoutes'));
app.use('/api/track', require('./routes/track'));
app.use('/api/campaigns', require('./routes/campaignRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));
app.use('/api/webhooks', require('./routes/webhookRoutes'));
app.use('/api/office-assets', require('./routes/officeAssetRoutes'));
app.use('/api/contacts', require('./routes/contactRoutes'));
app.use('/api/exly', require('./routes/exlyRoutes'));
app.use('/api/finance', require('./routes/financeRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/announcements', require('./routes/announcementRoutes'));
app.use('/api/admin/scripts', require('./routes/adminScriptsRoutes'));

const { createRouteHandler } = require("uploadthing/express");
const { uploadRouter } = require("./config/uploadthing");

// #region agent log
app.use("/api/uploadthing", (req, res, next) => {
  const started = Date.now();
  res.on("finish", () => {
    try {
      fs.appendFileSync(
        path.join(__dirname, "../debug-0c5d79.log"),
        `${JSON.stringify({
          sessionId: "0c5d79",
          timestamp: Date.now(),
          location: "server.js:/api/uploadthing",
          message: "uploadthing route finished",
          hypothesisId: "H5",
          data: {
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            ms: Date.now() - started,
            hasAuth: Boolean(req.headers.authorization),
            slug: req.query?.slug || null,
          },
        })}\n`
      );
    } catch (_) {}
  });
  next();
});
// #endregion

app.use(
  "/api/uploadthing",
  createRouteHandler({
    router: uploadRouter,
  })
);

// path and fs already required above
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../client/dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath, {
      maxAge: '1y',
      etag: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      }
    }));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    app.get('/', (req, res) => res.send('CoreKnot API Active (Production backend online. Frontend build pending at: ' + distPath + ')'));
  }
} else {
  app.get('/', (req, res) => res.send('CoreKnot API Active (Development Mode)'));
}

// Centralized structured error handling middleware
const errorHandler = require('./middleware/errorMiddleware');
app.use(errorHandler);

const { writeSystemLog } = require('./services/systemLogService');
const { SEVERITY, MODULE } = require('../shared/systemLogContract');

function logProcessCrash(label, err) {
  writeSystemLog({
    severity: SEVERITY.ERROR,
    module: MODULE.SYSTEM,
    message: `${label}: ${err?.message || 'Unknown'}`,
    userVisible: false,
    actorId: 'SYSTEM',
    payload: { stack: err?.stack },
    errorCode: label,
  });
}

process.on('uncaughtException', (err) => {
  console.error('[FATAL] uncaughtException', err);
  logProcessCrash('uncaughtException', err);
});

process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  console.error('[FATAL] unhandledRejection', err);
  logProcessCrash('unhandledRejection', err);
});

const backupJob = require('./jobs/backupJob');

// Note: Disabled inline backup job to prevent multi-instance collisions.
// Use dedicated worker or Atlas Snapshots instead.
// backupJob.start();

const PORT = process.env.PORT || 5000;
let server;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    
    // Initialize Reminder Service
    const notificationService = require('./services/notificationService');
    notificationService.init();
    const { configureWebPush } = require('./services/pushNotificationService');
    configureWebPush();

    // Initialize Background Workers
    const { initWorker } = require('./workers/statsWorker');
    initWorker();
    
    const { initWebhookWorker } = require('./workers/webhookWorker');
    initWebhookWorker();

    const { initImportWorker } = require('./workers/importWorker');
    initImportWorker();

    const { initLogArchiverWorker } = require('./workers/logArchiverWorker');
    initLogArchiverWorker();
  });

  const { initRealtime } = require('./config/realtime');
  initRealtime(server, corsAllowlist);

  console.log('Server re-initialized after port release');
}

// Graceful shutdown for nodemon restarts to prevent EADDRINUSE
process.once('SIGUSR2', () => {
  if(server) server.close();
  process.exit(0);
});
process.on('SIGINT', () => {
  if(server) server.close();
  process.exit(0);
});

module.exports = app;

// Trigger nodemon restart

// Trigger nodemon restart 2

// Trigger nodemon restart 3
