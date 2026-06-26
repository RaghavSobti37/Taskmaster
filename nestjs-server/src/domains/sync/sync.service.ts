import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { AppConfigService } from '../../config/config.service';
import type { AuthUser } from '../../auth/auth.types';

export interface SyncTokenResponse {
  endpoint: string;
  token: string;
  expiresAt: string;
}

@Injectable()
export class SyncService {
  constructor(private readonly config: AppConfigService) {}

  issueSyncToken(user: AuthUser): SyncTokenResponse {
    const secret = this.config.get('JWT_SECRET');
    const endpoint = String(
      process.env.POWERSYNC_URL ?? 'http://127.0.0.1:8080',
    );

    const expiresInSec = 60 * 60 * 12;
    const token = jwt.sign(
      {
        sub: user.id,
        tenantId: user.tenantId,
        purpose: 'powersync',
      },
      secret,
      { expiresIn: expiresInSec },
    );

    return {
      endpoint,
      token,
      expiresAt: new Date(Date.now() + expiresInSec * 1000).toISOString(),
    };
  }
}
