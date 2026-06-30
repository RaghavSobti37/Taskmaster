const fs = require('fs');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const { config } = require('../config');
const { applyCors } = require('./cors');
const { applyRateLimits } = require('./rateLimits');
const { buildCspDirectives } = require('./csp');
const perfMiddleware = require('../middleware/perfMiddleware');
const { qaProbeStorage } = require('../utils/qaProbeContext');

const PERF_LOG_PATH = path.join(__dirname, '..', 'performance.log');
const PERF_LOG_MAX_BYTES = 5 * 1024 * 1024;
const PERF_LOG_ENABLED = String(config.PERF_LOG_ENABLED).trim() === 'true';

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

function createApp() {
  const app = express();

  if (PERF_LOG_ENABLED) {
    app.use((req, res, next) => {
      const start = process.hrtime();
      res.on('finish', () => {
        const diff = process.hrtime(start);
        const timeInMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
        const logEntry = `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${timeInMs}ms - Status: ${res.statusCode}\n`;
        appendPerfLog(logEntry);
      });
      next();
    });
  }

  app.set('trust proxy', 1);
  app.use(perfMiddleware);
  app.use(helmet({
    contentSecurityPolicy: {
      directives: buildCspDirectives(),
    },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginEmbedderPolicy: config.isDevelopment ? false : { policy: 'credentialless' },
  }));
  app.use(compression({ threshold: 1024 }));
  applyCors(app);
  app.use(cookieParser());
  app.use(express.json({
    limit: '50mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  // ponytail: express-mongo-sanitize mutates req.query — broken on Express 5 (read-only getter)
  app.use((req, _res, next) => {
    const { sanitize } = mongoSanitize;
    if (req.body && typeof req.body === 'object') req.body = sanitize(req.body);
    if (req.params && typeof req.params === 'object') req.params = sanitize(req.params);
    next();
  });
  applyRateLimits(app);

  app.use('/api/public', require('../routes/publicRoutes'));

  app.use('/api', (req, res, next) => {
    if (req.headers['x-qa-integration-probe'] !== 'true') return next();
    qaProbeStorage.run({ syncGamification: true }, next);
  });

  return app;
}

module.exports = { createApp };
