import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import type { SessionTokenPayload } from './auth-session';
import { AppConfigService } from '../config/config.service';

const REVOKE_PREFIX = 'revoked:jti:';

@Injectable()
export class TokenRevocationService {
  private readonly logger = new Logger(TokenRevocationService.name);
  private readonly memoryRevoked = new Map<string, number>();
  private redis: Redis | null = null;
  private redisReady = false;

  constructor(private readonly config: AppConfigService) {
    this.initRedis();
  }

  private initRedis(): void {
    try {
      this.redis = new Redis(this.config.get('REDIS_URL'), {
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        lazyConnect: true,
        retryStrategy: () => null,
      });
      void this.redis
        .connect()
        .then(() => {
          this.redisReady = true;
        })
        .catch(() => {
          this.redisReady = false;
        });
      this.redis.on('error', () => {
        this.redisReady = false;
      });
    } catch {
      this.redis = null;
    }
  }

  private pruneMemory(): void {
    const now = Date.now();
    for (const [jti, expMs] of this.memoryRevoked.entries()) {
      if (expMs <= now) this.memoryRevoked.delete(jti);
    }
  }

  async isTokenRevoked(decoded: SessionTokenPayload): Promise<boolean> {
    const jti = decoded.jti;
    if (!jti) return false;

    const key = `${REVOKE_PREFIX}${jti}`;
    if (this.redis && this.redisReady) {
      try {
        const hit = await this.redis.get(key);
        return hit === '1';
      } catch {
        /* fall through */
      }
    }

    this.pruneMemory();
    const expMs = this.memoryRevoked.get(jti);
    if (!expMs) return false;
    if (expMs <= Date.now()) {
      this.memoryRevoked.delete(jti);
      return false;
    }
    return true;
  }
}
