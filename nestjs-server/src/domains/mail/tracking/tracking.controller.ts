import {
  Controller,
  Get,
  Header,
  Param,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { extractClientIp } from '../../../shared/email-engine/tracking.helpers';
import {
  TRACKING_PIXEL_GIF_BASE64,
  TRACKING_PIXEL_HEADERS,
} from './tracking.constants';
import { TrackingQueueService } from './tracking-queue.service';

/**
 * READ-ONLY tracking surface — mirrors `server/routes/track.js` open/click routes.
 * Accept hit → BullMQ → return pixel or redirect immediately (geo/DB in processor).
 */
@Controller('track')
export class TrackingController {
  constructor(private readonly trackingQueue: TrackingQueueService) {}

  @Get('open/:pixelId.gif')
  @Header('Content-Type', TRACKING_PIXEL_HEADERS['Content-Type'])
  @Header('Cache-Control', TRACKING_PIXEL_HEADERS['Cache-Control'])
  async trackOpen(
    @Param('pixelId') pixelId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const pixelBuffer = Buffer.from(TRACKING_PIXEL_GIF_BASE64, 'base64');
      res
        .status(200)
        .set({
          'Content-Length': String(pixelBuffer.length),
        })
        .send(pixelBuffer);

      const userAgent = String(req.headers['user-agent'] || 'Unknown');
      void this.trackingQueue.enqueueOpen({
        pixelId,
        userAgent,
        clientIp: req.ip,
        forwardedFor: headerString(req.headers['x-forwarded-for']),
        realIp: headerString(req.headers['x-real-ip']),
      });
    } catch {
      if (!res.headersSent) {
        res.sendStatus(204);
      }
    }
  }

  @Get('click/:clickId')
  async trackClick(
    @Param('clickId') clickId: string,
    @Query('redirect') redirect: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const userAgent = String(req.headers['user-agent'] || 'Unknown');
    const fallbackRedirect =
      process.env.FRONTEND_URL || 'http://localhost:5173';
    const finalUrl = redirect
      ? decodeURIComponent(redirect)
      : fallbackRedirect;

    try {
      res
        .status(200)
        .type('html')
        .send(buildClickRedirectHtml(finalUrl));

      void this.trackingQueue.enqueueClick({
        clickId,
        userAgent,
        finalUrl,
        clientIp: req.ip || extractClientIp(req),
        forwardedFor: headerString(req.headers['x-forwarded-for']),
        realIp: headerString(req.headers['x-real-ip']),
      });
    } catch {
      if (!res.headersSent) {
        res.redirect(302, fallbackRedirect);
      }
    }
  }
}

function headerString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function buildClickRedirectHtml(finalUrl: string): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta http-equiv="refresh" content="0; url=${finalUrl}">
    <title>Redirecting...</title>
  </head>
  <body>
    <script>window.location.href = "${finalUrl}";</script>
    <p>If you are not redirected automatically, <a href="${finalUrl}">click here</a>.</p>
  </body>
</html>`;
}
