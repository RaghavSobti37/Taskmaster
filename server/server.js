require('./datadog-init');
require('dotenv').config();
const { initSentry, setupSentryExpress, captureException } = require('./utils/sentry');
initSentry();
const express = require('express');
const cookieParser = require('cookie-parser');
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
const teamRoutes = require('./routes/teamRoutes');
const crmRoutes = require('./routes/crmRoutes');
const googleRoutes = require('./routes/googleRoutes');
const artistRoutes = require('./routes/artistRoutes');
const proxyRoutes = require('./routes/proxyRoutes');
const { qaProbeStorage } = require('./utils/qaProbeContext');

const app = express();
const fs = require('fs');
const path = require('path');

const PERF_LOG_PATH = path.join(__dirname, 'performance.log');
const PERF_LOG_MAX_BYTES = 5 * 1024 * 1024;
const PERF_LOG_ENABLED = String(process.env.PERF_LOG_ENABLED).trim() === 'true';

function appendPerfLog(line) {
  if (!PERF_LOG_ENABLED) return;
  fs.stat(PERF_LOG_PATH, (statErr, stats) => {
    if (!statErr && stats?.size > PERF_LOG_MAX_BYTES) {
      fs.writeFile(PERF_LOG_PATH, line, (writeErr) => {
        if (writeErr) console.error('Perf log rotate failed', writeErr);
      });
      return;
    }
    fs.appendFile(PERF_LOG_PATH, line, (err) => {
      if (err) console.error('Perf log write failed', err);
    });
  });
}

// Optional request performance logger (PERF_LOG_ENABLED=true)
app.use((req, res, next) => {
  if (!PERF_LOG_ENABLED) return next();
  const start = process.hrtime();
  res.on('finish', () => {
    const diff = process.hrtime(start);
    const timeInMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
    const logEntry = `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${timeInMs}ms - Status: ${res.statusCode}\n`;
    appendPerfLog(logEntry);
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
  'http://localhost:4173',
  'http://127.0.0.1:4173',
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

const allowVercelPreviews = process.env.NODE_ENV !== 'production'
  || String(process.env.CORS_ALLOW_VERCEL_PREVIEWS).trim() === 'true';

const isLocalDevOrigin = (origin) =>
  process.env.NODE_ENV !== 'production' &&
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin || '');

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (corsAllowlist.has(origin)) return callback(null, true);
    if (isLocalDevOrigin(origin)) return callback(null, true);
    if (allowVercelPreviews && origin.endsWith('.vercel.app')) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'x-skip-toast',
    'X-Skip-Toast',
    'X-Trace-Id',
    'x-trace-id',
    'x-uploadthing-package',
    'x-uploadthing-version',
    'b3',
    'traceparent',
  ],
  exposedHeaders: ['x-ratelimit-remaining', 'x-ratelimit-reset', 'ratelimit-remaining', 'ratelimit-reset']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(cookieParser());

const { purgeLegacyAuthCookies } = require('./utils/authCookie');
app.use((_req, res, next) => {
  purgeLegacyAuthCookies(res);
  next();
});

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

/** Integration probes: sync gamification scoped to request via AsyncLocalStorage. */
app.use('/api', (req, res, next) => {
  if (req.headers['x-qa-integration-probe'] !== 'true') return next();
  qaProbeStorage.run({ syncGamification: true }, next);
});

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

app.use('/api', require('./routes/openApiRoutes'));

app.get('/api/health', (_req, res) => {
  const detail = SystemHealthService.getDetailedStatus();
  const ok = detail.status === 'HEALTHY' || detail.status === 'STARTING';
  res.status(ok ? 200 : 503).json({
    ok,
    status: detail.status,
    reason: detail.reason || null,
    dependencies: detail.dependencies,
    uptimeSeconds: detail.uptimeSeconds,
  });
});

app.use('/api/', (req, res, next) => {
  if (req.path === '/health' || req.path === '/openapi.json') return next();
  return SystemHealthService.middleware(req, res, next);
});

const traceMiddleware = require('./middleware/traceMiddleware');
app.use(traceMiddleware);

// MongoDB Connection
const {
  resolveMongoUri,
  getDbNameFromUri,
  maskMongoUri,
  assertSafeDbTarget,
} = require('./config/database');

const { dbUri, source: dbSource } = resolveMongoUri();
assertSafeDbTarget(dbUri, { source: dbSource });

const maskedUri = maskMongoUri(dbUri);
const resolvedDbName = getDbNameFromUri(dbUri);
if (process.env.NODE_ENV !== 'test') {
  console.log(`[SYSTEM] Initializing DB Connection (${dbSource}): ${maskedUri}`);
  if (resolvedDbName) {
    console.log(`[SYSTEM] Target database name: ${resolvedDbName}`);
  }

  mongoose.connect(dbUri, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 60000,
    heartbeatFrequencyMS: 10000,
  })
    .then(() => {
      const connectedDb = mongoose.connection.db?.databaseName || resolvedDbName || 'unknown';
      console.log(`[SUCCESS] MongoDB Connected — database: ${connectedDb}`);

      const { resolveTrackingApiBaseUrl, getTrackingDbMismatchWarning } = require('./utils/trackingUrls');
      console.log(`[MAIL] Tracking pixel base URL: ${resolveTrackingApiBaseUrl()}`);
      const trackingWarn = getTrackingDbMismatchWarning();
      if (trackingWarn) console.warn('[MAIL] ⚠ ' + trackingWarn);

      const { ensureDataHubBootstrap } = require('./utils/ensureDataHubBootstrap');
      ensureDataHubBootstrap().catch(() => {});
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
}

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
app.use('/api/search', require('./routes/searchRoutes'));
app.use('/api/pinboard', require('./routes/pinBoardRoutes'));
app.use('/api/mail', require('./routes/mailRoutes'));
app.use('/api/ses', require('./routes/sesRoutes'));
app.use('/api/tsc', require('./routes/tscRoutes'));
app.use('/api/data-hub', require('./routes/dataHubRoutes'));
app.use('/api/artist-path', require('./routes/artistPathRoutes'));
app.use('/api/track', require('./routes/track'));
app.use('/api/campaigns', require('./routes/campaignRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));
app.use('/api/webhooks', require('./routes/webhookRoutes'));
app.use('/api/integrations', require('./routes/integrationsRoutes'));
app.use('/api/office-assets', require('./routes/officeAssetRoutes'));
app.use('/api/subscriptions', require('./routes/subscriptionRoutes'));
app.use('/api/contacts', require('./routes/contactRoutes'));
app.use('/api/exly', require('./routes/exlyRoutes'));
app.use('/api/finance', require('./routes/financeRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/announcements', require('./routes/announcementRoutes'));
app.use('/api/admin/scripts', require('./routes/adminScriptsRoutes'));
app.use('/api/admin/queues', require('./routes/queueAdminRoutes'));

const { createRouteHandler } = require("uploadthing/express");
const { uploadRouter } = require("./config/uploadthing");

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

setupSentryExpress(app);

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
  captureException(err, { label: 'uncaughtException' });
  logProcessCrash('uncaughtException', err);
});

process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  console.error('[FATAL] unhandledRejection', err);
  captureException(err, { label: 'unhandledRejection' });
  logProcessCrash('unhandledRejection', err);
});

const http = require('http');
const PORT = process.env.PORT || 5000;
const LISTEN_RETRY_MS = 800;
const LISTEN_RETRY_MAX = 25;
const { waitUntilPortFree, getListeningPids, freePort } = require('./scripts/freePort');
let server;

function onServerListening() {
  if (serverListening) {
    return;
  }
  serverListening = true;
  console.log(`Server running on port ${PORT}`);

  const notificationService = require('./services/notificationService');
  notificationService.init();
  const { configureWebPush } = require('./services/pushNotificationService');
  configureWebPush();

  const { initWorker } = require('./workers/statsWorker');
  initWorker();

  const { init: initTaskActivityPurge } = require('./workers/taskActivityPurgeWorker');
  initTaskActivityPurge();

  const { initWebhookWorker } = require('./workers/webhookWorker');
  initWebhookWorker();

  const { initImportWorker } = require('./workers/importWorker');
  initImportWorker();

  const { initLogArchiverWorker } = require('./workers/logArchiverWorker');
  initLogArchiverWorker();

  const { initRealtime } = require('./config/realtime');
  initRealtime(server, corsAllowlist);
}

function beginListen(attempt) {
  server = http.createServer(app);
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && attempt < LISTEN_RETRY_MAX) {
      const holders = [...getListeningPids(PORT)].filter((pid) => pid !== String(process.pid));
      if (attempt === 4 && holders.length) {
        console.warn(
          `[server] Port ${PORT} held by PID(s): ${holders.join(', ')}. ` +
            'Stop extra "npm run dev" in server/ — only one terminal.'
        );
      }
      console.warn(
        `[server] Port ${PORT} in use (waiting for release). Retry ${attempt + 1}/${LISTEN_RETRY_MAX} in ${LISTEN_RETRY_MS}ms`
      );
      server.close(() => {
        server = null;
        const retry = () => setTimeout(() => listenWithRetry(attempt + 1), LISTEN_RETRY_MS);
        if (process.env.NODE_ENV === 'production') {
          retry();
          return;
        }
        const free = waitUntilPortFree(PORT, { timeoutMs: 5000, exceptPid: process.pid });
        retry();
      });
      return;
    }
    console.error('[FATAL] Server listen failed', err);
    process.exit(1);
  });
  server.on('listening', onServerListening);
  server.listen(PORT);
}

function listenWithRetry(attempt = 0) {
  if (attempt === 0) serverListening = false;

  if (server) {
    server.close();
    server = null;
  }

  if (process.env.NODE_ENV !== 'production' && attempt === 0) {
    let ready = waitUntilPortFree(PORT, { timeoutMs: 8000, exceptPid: process.pid });
    if (!ready) {
      freePort(PORT, { exceptPid: process.pid });
      ready = waitUntilPortFree(PORT, { timeoutMs: 5000, exceptPid: process.pid });
    }
    beginListen(attempt);
    return;
  }

  beginListen(attempt);
}

let shuttingDown = false;
let serverListening = false;

async function gracefulShutdown(signal = 'unknown') {
  if (shuttingDown) return;
  shuttingDown = true;
  serverListening = false;

  const finish = () => process.exit(0);
  const forceExit = setTimeout(finish, 1500);
  forceExit.unref();

  try {
    const { closeRealtime } = require('./config/realtime');
    await closeRealtime();
  } catch {
    /* ignore */
  }

  if (server) {
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
    await new Promise((resolve) => {
      server.close(() => {
        server = null;
        resolve();
      });
    });
  }

  clearTimeout(forceExit);
  finish();
}

if (process.env.NODE_ENV !== 'test') {
  listenWithRetry();
}

process.once('SIGUSR2', () => { gracefulShutdown('SIGUSR2'); });
process.once('SIGTERM', () => { gracefulShutdown('SIGTERM'); });
process.once('SIGINT', () => { gracefulShutdown('SIGINT'); });

module.exports = app;



