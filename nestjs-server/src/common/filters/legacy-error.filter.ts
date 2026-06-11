import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class LegacyErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'object' && payload !== null && 'error' in payload) {
        return response.status(status).json(payload);
      }
      const message = typeof payload === 'string'
        ? payload
        : (payload as { message?: string | string[] }).message;
      const error = Array.isArray(message) ? message.join('; ') : (message || 'Request failed');
      return response.status(status).json({ error });
    }

    const message = exception instanceof Error ? exception.message : 'Internal server error';
    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}
