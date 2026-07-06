import {

  CanActivate,

  ExecutionContext,

  Injectable,

  UnauthorizedException,

} from '@nestjs/common';

import type { Request } from 'express';

import { AppConfigService } from '../config/config.service';

import { TenantContextService } from '../tenant/tenant-context.service';

import {

  AUTH_COOKIE_NAME,

  LEGACY_AUTH_COOKIE_NAMES,

} from './auth.constants';

import {

  isAbsoluteSessionExpired,

  verifySessionToken,

} from './auth-session';

import { AuthService } from './auth.service';

import { TokenRevocationService } from './token-revocation.service';



const LOCALHOST_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);



/**

 * Port of server/middleware/authMiddleware.js protect().

 * READ-ONLY session validation — no cookie refresh / establishSession.

 */

@Injectable()

export class AuthGuard implements CanActivate {

  constructor(

    private readonly authService: AuthService,

    private readonly config: AppConfigService,

    private readonly tokenRevocation: TokenRevocationService,

    private readonly tenantContext: TenantContextService,

  ) {}



  async canActivate(context: ExecutionContext): Promise<boolean> {

    const request = context.switchToHttp().getRequest<Request>();

    const token = this.getTokenFromRequest(request);



    if (!token) {

      throw new UnauthorizedException({ error: 'Not authorized, no token' });

    }



    try {

      const resolved = await this.resolveUser(request, token);

      if (!resolved.user) {

        throw new UnauthorizedException({ error: 'User no longer exists' });

      }

      const sessionTenantId = resolved.activeTenantId ?? resolved.user.tenantId ?? undefined;

      request.user = resolved.user;

      request.tenantId = sessionTenantId;

      this.tenantContext.updateContext({

        tenantId: sessionTenantId ?? null,

        userId: resolved.user.id,

      });



      return true;

    } catch (error) {

      if (error instanceof UnauthorizedException) throw error;

      throw new UnauthorizedException({ error: 'Not authorized, token failed' });

    }

  }



  private async resolveUser(request: Request, token: string): Promise<{ user: Awaited<ReturnType<AuthService['loadAuthUser']>>; activeTenantId?: string }> {

    const bypassUser = await this.tryDebugBypass(request, token);

    if (bypassUser) {
      return { user: bypassUser, activeTenantId: bypassUser.tenantId ?? undefined };
    }



    const secret = this.config.get('JWT_SECRET');

    const decoded = verifySessionToken(token, secret);



    if (decoded.purpose) {

      throw new UnauthorizedException({ error: 'Not authorized, token failed' });

    }



    if (await this.tokenRevocation.isTokenRevoked(decoded)) {

      throw new UnauthorizedException({

        error: 'Session revoked. Please sign in again.',

      });

    }



    if (isAbsoluteSessionExpired(decoded)) {

      throw new UnauthorizedException({

        error: 'Session expired. Please sign in again.',

      });

    }



    const user = await this.authService.loadAuthUser(decoded.id);

    return { user, activeTenantId: decoded.activeTenantId };

  }



  private async tryDebugBypass(request: Request, token: string) {

    const isBypassEnabled =

      this.config.get('NODE_ENV') === 'development' &&

      String(this.config.get('DEBUG_BYPASS') ?? '').trim() === 'true';

    const isLocalhost = LOCALHOST_IPS.has(request.ip ?? '');

    const bypassToken = this.config.get('DEBUG_BYPASS_TOKEN') ?? 'bypass_token';



    if (!isBypassEnabled || !isLocalhost || token !== bypassToken) {

      return null;

    }



    const adminUser = await this.authService.loadBypassAdminUser();

    if (!adminUser) {

      throw new UnauthorizedException({

        error: 'No admin user available for bypass',

      });

    }

    return adminUser;

  }



  private getTokenFromRequest(req: Request): string | null {

    const cookies = req.cookies as Record<string, string | undefined> | undefined;

    if (cookies?.[AUTH_COOKIE_NAME]) return cookies[AUTH_COOKIE_NAME];

    for (const legacyName of LEGACY_AUTH_COOKIE_NAMES) {

      if (cookies?.[legacyName]) return cookies[legacyName];

    }



    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith('Bearer ')) {

      return authHeader.slice('Bearer '.length) || null;

    }

    return null;

  }

}

