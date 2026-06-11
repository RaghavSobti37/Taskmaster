import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import type { AppConfig } from './config.schema';

@Injectable()
export class AppConfigService {
  constructor(private readonly nestConfig: NestConfigService<AppConfig, true>) {}

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.nestConfig.get(key, { infer: true });
  }

  get config(): AppConfig {
    return this.nestConfig.getOrThrow<AppConfig>('app');
  }
}
