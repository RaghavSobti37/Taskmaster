require('dotenv').config();
const { z } = require('zod');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().optional(),
  MONGODB_URI_PROD: z.string().optional(),
  MONGO_URI: z.string().optional(),
  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),
  FRONTEND_URL: z.string().optional(),
  CLIENT_URL: z.string().optional(),
  SERVER_URL: z.string().optional(),
  APP_BASE_URL: z.string().optional(),
  TRACKING_BASE_URL: z.string().optional(),
  CORS_ALLOWED_ORIGINS: z.string().optional(),
  CORS_ALLOW_VERCEL_PREVIEWS: z.string().optional(),
  PERF_LOG_ENABLED: z.string().optional(),
  RESEND_WEBHOOK_SECRET: z.string().optional(),
  JWT_SECRET: z.string().optional(),
}).passthrough().superRefine((data, ctx) => {
  if (data.NODE_ENV === 'production' && !data.JWT_SECRET?.trim()) {
    ctx.addIssue({
      code: 'custom',
      message: 'JWT_SECRET is required in production',
      path: ['JWT_SECRET'],
    });
  }
});

let _config;

function loadConfig() {
  if (_config) return _config;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  const env = parsed.data;
  _config = {
    ...env,
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
    isDevelopment: env.NODE_ENV === 'development',
    /**
     * Redis is required for BullMQ workers (import, webhook, log archiver, supabase sync).
     * Dev may run without Redis — workers log warnings and skip queue init.
     * Production should always set REDIS_URL (Render Key Value or external Redis).
     */
    redis: {
      url: env.REDIS_URL,
      requiredInProduction: true,
    },
    urls: {
      frontend: env.FRONTEND_URL || env.CLIENT_URL || 'http://localhost:5173',
      server: env.SERVER_URL || env.APP_BASE_URL || `http://localhost:${env.PORT}`,
      tracking: env.TRACKING_BASE_URL || env.SERVER_URL || env.APP_BASE_URL,
    },
  };
  return _config;
}

module.exports = {
  loadConfig,
  get config() {
    return loadConfig();
  },
};
