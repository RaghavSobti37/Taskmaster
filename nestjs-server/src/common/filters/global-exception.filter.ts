import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ErrorBody {
  success: false;
  error: string;
  message: string;
  errors: Record<string, string> | null;
  code: string;
  path: string;
  timestamp: string;
  traceId: string | undefined;
  stack: string | null;
}

/** Matches Express errorMiddleware.js JSON shape. */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: Record<string, string> | null = null;
    let code = 'ServerError';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'string') {
        message = response;
      } else if (typeof response === 'object' && response !== null) {
        const body = response as Record<string, unknown>;
        if (typeof body.error === 'string') {
          message = body.error;
        } else if (typeof body.message === 'string') {
          message = body.message;
        } else if (Array.isArray(body.message)) {
          message = body.message.join('; ');
        }
        if (body.errors && typeof body.errors === 'object') {
          errors = body.errors as Record<string, string>;
        }
      }
      code = exception.name;
    } else if (exception instanceof Error) {
      message = exception.message;
      code = exception.name || 'ServerError';

      const errRecord = exception as Error & {
        type?: string;
        errors?: Record<string, string>;
      };
      if (errRecord.type === 'entity.too.large' || code === 'PayloadTooLargeError') {
        statusCode = HttpStatus.PAYLOAD_TOO_LARGE;
        message =
          'Request entity too large. Reduce HTML size, remove inline images, or upload attachments separately.';
      }
      if (errRecord.errors) {
        errors = errRecord.errors;
      }
    }

    const errorLog = {
      timestamp: new Date().toISOString(),
      route: req.originalUrl,
      method: req.method,
      userId: req.user?.id ?? 'unauthenticated',
      error: message,
      errors,
      status: statusCode,
      traceId: req.traceId,
    };

    if (statusCode >= 500) {
      this.logger.error(
        `[ERROR_MIDDLEWARE] Server Error: ${JSON.stringify({
          ...errorLog,
          stack: exception instanceof Error ? exception.stack : undefined,
        })}`,
      );
    } else {
      this.logger.log(
        `[CLIENT_ERROR] Route: ${req.method} ${req.originalUrl} | Status: ${statusCode} | Message: ${message}`,
      );
    }

    const body: ErrorBody = {
      success: false,
      error: message,
      message,
      errors,
      code,
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
      traceId: req.traceId,
      stack:
        process.env.NODE_ENV === 'production'
          ? null
          : statusCode >= 500 && exception instanceof Error
            ? exception.stack ?? null
            : null,
    };

    res.status(statusCode).json(body);
  }
}
