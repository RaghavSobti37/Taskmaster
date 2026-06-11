import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { AppModule } from './app.module';
import { probeRedisUrl } from './bullmq/redis-connectivity';
import { parseEnv } from './config/config.schema';
import { AppConfigService } from './config/config.service';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

loadEnv({ path: resolve(__dirname, '../.env') });

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const env = parseEnv(process.env);
  let enableBullMQ = Boolean(env.REDIS_URL?.trim());

  if (enableBullMQ) {
    const redisOk = await probeRedisUrl(env.REDIS_URL);
    if (!redisOk) {
      enableBullMQ = false;
      const msg =
        'REDIS_URL unreachable — BullMQ workers skipped. Attendance/health still available.';
      if (env.isProduction) {
        logger.error(msg);
      } else {
        logger.warn(msg);
      }
    }
  }

  const app = await NestFactory.create(AppModule.register({ enableBullMQ }));
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new GlobalExceptionFilter());
  const config = app.get(AppConfigService);
  const port = config.get('PORT');
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
