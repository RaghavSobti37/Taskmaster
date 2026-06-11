const http = require('http');
const mongoose = require('mongoose');
const { config } = require('../config');
const { corsAllowlist } = require('./cors');
const { captureException } = require('../utils/sentry');
const { writeSystemLog } = require('../services/systemLogService');
const { SEVERITY, MODULE } = require('../../shared/systemLogContract');
const {
  resolveMongoUri,
  getDbNameFromUri,
  assertSafeDbTarget,
  getMongooseConnectOptions,
} = require('../config/database');
const { waitUntilPortFree, getListeningPids, freePort } = require('../scripts/freePort');

const PORT = config.PORT;
const LISTEN_RETRY_MS = 800;
const LISTEN_RETRY_MAX = 25;

let server;
let shuttingDown = false;
let serverListening = false;
let jobsBootstrapResult = null;

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

function registerProcessHandlers() {
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
}

function connectMongo() {
  const { dbUri, source } = resolveMongoUri();
  assertSafeDbTarget(dbUri, { source });

  const resolvedDbName = getDbNameFromUri(dbUri);

  mongoose.connect(dbUri, getMongooseConnectOptions())
    .then(() => {
      const { ensurePerformanceIndexes } = require('../scripts/ensureIndexes');
      ensurePerformanceIndexes().catch((err) => {
        console.warn('[INDEX] Performance index sync skipped:', err.message);
      });

      const { ensureDataHubBootstrap } = require('../utils/ensureDataHubBootstrap');
      ensureDataHubBootstrap().catch(() => {});

      const { ensureDevAdminUser } = require('../utils/ensureDevAdminUser');
      ensureDevAdminUser().catch((err) => {
        console.warn('[AUTH] Dev admin bootstrap skipped:', err.message);
      });

      const { loadPlatformSettings } = require('../services/platformSettingsService');
      loadPlatformSettings().catch((err) => {
        console.warn('[PLATFORM] Settings bootstrap skipped:', err.message);
      });

      const { isSupabaseEnabled } = require('../config/supabase');
      const { registerSupabaseMirrors } = require('../services/supabase/registerMirrors');
      if (isSupabaseEnabled()) {
        registerSupabaseMirrors();
      }

      const { printStartupBanner } = require('./startupBanner');
      printStartupBanner(jobsBootstrapResult || {});
    })
    .catch((err) => {
      console.error('[ERROR] Initial MongoDB connection failed:', err.message);
      console.log('[SYSTEM] Server will remain active but DB operations will fail until connection is established.');
    });

  mongoose.connection.on('error', (err) => {
    console.error('[ERROR] Mongoose connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[WARN] Mongoose disconnected. Attempting reconnect...');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('[SUCCESS] Mongoose reconnected.');
  });
}

function onServerListening() {
  if (serverListening) return;
  serverListening = true;

  const { bootstrapBackgroundJobs } = require('../jobs/bootstrap');
  jobsBootstrapResult = bootstrapBackgroundJobs();

  setTimeout(() => {
    const { resumeStuckCampaigns } = require('../services/queueService');
    resumeStuckCampaigns().catch((err) => {
      console.warn('[WARN] Campaign dispatch resume failed:', err.message);
    });
  }, 5000);

  const { configureWebPush } = require('../services/pushNotificationService');
  configureWebPush();

  const { initRealtime } = require('../config/realtime');
  initRealtime(server, corsAllowlist);

  setTimeout(() => {
    const { printStartupBanner } = require('./startupBanner');
    printStartupBanner(jobsBootstrapResult || {});
  }, 2500);
}

function beginListen(app, attempt) {
  server = http.createServer(app);
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && attempt < LISTEN_RETRY_MAX) {
      const holders = [...getListeningPids(PORT)].filter((pid) => pid !== String(process.pid));
      if (attempt === 4 && holders.length) {
        console.warn(
          `[server] Port ${PORT} held by PID(s): ${holders.join(', ')}. ` +
            'Stop extra "npm run dev" in server/ — only one terminal.',
        );
      }
      console.warn(
        `[server] Port ${PORT} in use (waiting for release). Retry ${attempt + 1}/${LISTEN_RETRY_MAX} in ${LISTEN_RETRY_MS}ms`,
      );
      server.close(() => {
        server = null;
        const retry = () => setTimeout(() => listenWithRetry(app, attempt + 1), LISTEN_RETRY_MS);
        if (config.NODE_ENV === 'production') {
          retry();
          return;
        }
        waitUntilPortFree(PORT, { timeoutMs: 5000, exceptPid: process.pid });
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

function listenWithRetry(app, attempt = 0) {
  if (attempt === 0) serverListening = false;

  if (server) {
    server.close();
    server = null;
  }

  if (config.NODE_ENV !== 'production' && attempt === 0) {
    let ready = waitUntilPortFree(PORT, { timeoutMs: 8000, exceptPid: process.pid });
    if (!ready) {
      freePort(PORT, { exceptPid: process.pid });
      ready = waitUntilPortFree(PORT, { timeoutMs: 5000, exceptPid: process.pid });
    }
    beginListen(app, attempt);
    return;
  }

  beginListen(app, attempt);
}

async function gracefulShutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  serverListening = false;

  const finish = () => process.exit(0);
  const forceExit = setTimeout(finish, 1500);
  forceExit.unref();

  try {
    const { closeRealtime } = require('../config/realtime');
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

function startServer(app) {
  registerProcessHandlers();
  if (!config.isTest) {
    connectMongo();
    listenWithRetry(app);
  }
  process.once('SIGUSR2', () => { gracefulShutdown(); });
  process.once('SIGTERM', () => { gracefulShutdown(); });
  process.once('SIGINT', () => { gracefulShutdown(); });
}

module.exports = { startServer, connectMongo, gracefulShutdown };
