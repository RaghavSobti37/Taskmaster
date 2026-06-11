const cors = require('cors');
const { config } = require('../config');

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'https://tsccoreknot.com',
  'https://www.tsccoreknot.com',
  'https://theshakticollective.in',
  'https://www.theshakticollective.in',
];

const allowedOrigins = (config.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsAllowlist = new Set([
  ...DEFAULT_ALLOWED_ORIGINS,
  ...allowedOrigins,
]);

const allowVercelPreviews = config.NODE_ENV !== 'production'
  || String(config.CORS_ALLOW_VERCEL_PREVIEWS).trim() === 'true';

const isLocalDevOrigin = (origin) =>
  config.NODE_ENV !== 'production'
  && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin || '');

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
  exposedHeaders: ['x-ratelimit-remaining', 'x-ratelimit-reset', 'ratelimit-remaining', 'ratelimit-reset'],
};

function applyCors(app) {
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));
}

module.exports = {
  corsOptions,
  corsAllowlist,
  applyCors,
};
