import { randomUUID } from 'crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { TenantContextService } from '../../tenant/tenant-context.service';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resolveTraceId(headerValue: string | string[] | undefined): string {
  const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (typeof raw === 'string' && UUID_RE.test(raw.trim())) {
    return raw.trim();
  }
  return randomUUID();
}

/** Ported from server/middleware/traceMiddleware.js */
@Injectable()
export class TraceMiddleware implements NestMiddleware {
  constructor(private readonly tenantContext: TenantContextService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers['x-trace-id'] ?? req.headers['X-Trace-Id'];
    const traceId = resolveTraceId(incoming);
    req.traceId = traceId;
    res.setHeader('X-Trace-Id', traceId);

    this.tenantContext.run(
      {
        traceId,
        tenantId: req.tenantId ?? null,
        userId: req.user?.id ?? null,
      },
      () => next(),
    );
  }
}
