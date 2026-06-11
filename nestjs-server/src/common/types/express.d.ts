import type { AuthUser } from '../../auth/auth.service';

declare global {
  namespace Express {
    interface Request {
      traceId?: string;
      tenantId?: string;
      user?: AuthUser;
    }
  }
}

export {};
