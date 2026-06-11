import { z } from 'zod';

/** Ported from server/config/index.js — extended for NestJS auth + Prisma. */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(5001),
    DATABASE_URL: z.string().optional(),
    MONGODB_URI: z.string().optional(),
    MONGODB_URI_PROD: z.string().optional(),
    MONGO_URI: z.string().optional(),
    REDIS_URL: z.string().default('redis://127.0.0.1:6379'),
    JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
    JWT_EXPIRES_IN: z.string().default('7d'),
    JWT_ABSOLUTE_MAX_DAYS: z.coerce.number().int().positive().default(30),
    JWT_REFRESH_MINUTES: z.coerce.number().int().positive().default(60),
    FRONTEND_URL: z.string().optional(),
    CLIENT_URL: z.string().optional(),
    SERVER_URL: z.string().optional(),
    APP_BASE_URL: z.string().optional(),
    TRACKING_BASE_URL: z.string().optional(),
    CORS_ALLOWED_ORIGINS: z.string().optional(),
    CORS_ALLOW_VERCEL_PREVIEWS: z.string().optional(),
    PERF_LOG_ENABLED: z.string().optional(),
    RESEND_WEBHOOK_SECRET: z.string().optional(),
    DEBUG_BYPASS: z.string().optional(),
    DEBUG_BYPASS_TOKEN: z.string().optional(),
  })
  .passthrough();

export type EnvSchema = z.infer<typeof envSchema>;

export interface AppConfig extends EnvSchema {
  isProduction: boolean;
  isTest: boolean;
  isDevelopment: boolean;
  redis: {
    url: string;
    requiredInProduction: boolean;
  };
  urls: {
    frontend: string;
    server: string;
    tracking: string | undefined;
  };
}

export function parseEnv(raw: NodeJS.ProcessEnv): AppConfig {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  const env = parsed.data;
  return {
    ...env,
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
    isDevelopment: env.NODE_ENV === 'development',
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
}
