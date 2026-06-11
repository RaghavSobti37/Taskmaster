import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/config.service';

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

    let mongoOk = false;
    let mongoState = 'unknown';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      mongoOk = true;
      mongoState = 'connected';
    } catch {
      mongoState = 'disconnected';
    }

    const redisUrl = this.config.get('REDIS_URL');
    const redisOk = Boolean(redisUrl);

    const status = mongoOk || this.config.get('NODE_ENV') === 'development'
      ? 'HEALTHY'
      : 'STARTING';
    const ok = status === 'HEALTHY' || status === 'STARTING';

    return {
      ok,
      status,
      reason: ok ? null : 'Database unavailable',
      dependencies: {
        postgres: { ok: mongoOk, state: mongoState },
        redis: { ok: redisOk, state: redisOk ? 'configured' : 'unavailable' },
      },
      uptimeSeconds,
    };
  }
}
