import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/config.service';
import { probeRedisUrl } from '../bullmq/redis-connectivity';

function getBuildMeta() {
  const fullSha = (
    process.env.RENDER_GIT_COMMIT
    || process.env.VERCEL_GIT_COMMIT_SHA
    || ''
  ).trim();

  return {
    commitSha: fullSha ? fullSha.slice(0, 12) : null,
    deployTier: (process.env.COREKNOT_DEPLOY_TIER || process.env.DD_ENV || '').trim() || null,
    service: (process.env.RENDER_SERVICE_NAME || '').trim() || null,
  };
}

@Controller('health')
export class HealthController {
  private startedAt = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  @Get()
  async getHealth() {
    const uptimeSeconds = Math.floor((Date.now() - this.startedAt) / 1000);
    const isProd = this.config.get('NODE_ENV') === 'production';

    let postgresOk = false;
    let postgresState = 'unknown';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      postgresOk = true;
      postgresState = 'connected';
    } catch {
      postgresState = 'disconnected';
    }

    const redisUrl = this.config.get('REDIS_URL');
    let redisOk = false;
    let redisState = 'unavailable';
    if (redisUrl?.trim()) {
      redisOk = await probeRedisUrl(redisUrl);
      redisState = redisOk ? 'connected' : 'unavailable';
    } else {
      redisState = 'not_configured';
    }

    const status = postgresOk && (!isProd || redisOk || redisState === 'not_configured')
      ? 'HEALTHY'
      : postgresOk
        ? 'STARTING'
        : 'FAIL';
    const ok = status === 'HEALTHY';

    return {
      ok,
      status,
      reason: ok ? null : (postgresOk ? 'Redis unavailable' : 'Database unavailable'),
      build: getBuildMeta(),
      dependencies: {
        postgres: { ok: postgresOk, state: postgresState },
        redis: { ok: redisOk, state: redisState },
      },
      uptimeSeconds,
    };
  }
}
