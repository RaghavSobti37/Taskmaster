const http = require('http');
const mongoose = require('mongoose');
const { config } = require('../config');
const { corsAllowlist } = require('./cors');
const logger = require('../utils/logger');
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
  logger.error('process', `${label}: ${err?.message || 'Unknown'}`, {
    errorCode: label,
    stack: err?.stack,
  });
}

function registerProcessHandlers() {
  process.on('uncaughtException', (err) => {
    logProcessCrash('uncaughtException', err);
  });

  process.on('unhandledRejection', (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    logProcessCrash('unhandledRejection', err);
  });
}

function connectMongo() {
  const { dbUri, source } = resolveMongoUri();
  assertSafeDbTarget(dbUri, { source });

  const resolvedDbName = getDbNameFromUri(dbUri);

  mongoose.connect(dbUri, getMongooseConnectOptions())
    .then(() => {
      // Defer index sync so first API requests after boot are not competing with syncIndexes.
      setTimeout(() => {
        const { ensurePerformanceIndexes } = require('../scripts/ensureIndexes');
        ensurePerformanceIndexes().catch((err) => {
          logger.warn('INDEX', 'Performance index sync skipped', { error: err.message });
        });
      }, 60_000);

      const { ensureDataHubBootstrap } = require('../utils/ensureDataHubBootstrap');
      ensureDataHubBootstrap().catch(() => {});

      const { ensureDevAdminUser } = require('../utils/ensureDevAdminUser');
      ensureDevAdminUser().catch((err) => {
        logger.warn('AUTH', 'Dev admin bootstrap skipped', { error: err.message });
      });

      const { loadPlatformSettings } = require('../services/platformSettingsService');
      loadPlatformSettings().catch((err) => {
        logger.warn('PLATFORM', 'Settings bootstrap skipped', { error: err.message });
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
      logger.error('MongoDB', 'Initial connection failed', { error: err.message });
      logger.info('SYSTEM', 'Server active; DB operations fail until connection established');
    });

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB', 'Connection error', { error: err.message });
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB', 'Disconnected; attempting reconnect');
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB', 'Reconnected');
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
      logger.warn('Campaign', 'Dispatch resume failed', { error: err.message });
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
        logger.warn('server', `Port ${PORT} held by PID(s): ${holders.join(', ')}`);
      }
      logger.warn('server', `Port ${PORT} in use; retry ${attempt + 1}/${LISTEN_RETRY_MAX}`);
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
    logger.error('server', 'Listen failed', { error: err.message, code: err.code });
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
