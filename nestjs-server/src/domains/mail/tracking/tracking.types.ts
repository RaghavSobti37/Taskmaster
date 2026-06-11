import {
  TRACKING_JOB_CLICK,
  TRACKING_JOB_OPEN,
} from '../../../bullmq/queue.constants';

export interface TrackingOpenJobPayload {
  kind: typeof TRACKING_JOB_OPEN;
  pixelId: string;
  userAgent: string;
  clientIp?: string;
  forwardedFor?: string;
  realIp?: string;
}

export interface TrackingClickJobPayload {
  kind: typeof TRACKING_JOB_CLICK;
  clickId: string;
  userAgent: string;
  finalUrl: string;
  clientIp?: string;
  forwardedFor?: string;
  realIp?: string;
}

export type TrackingJobPayload =
  | TrackingOpenJobPayload
  | TrackingClickJobPayload;

export interface ResendWebhookJobPayload {
  rawBody: string;
  headers: Record<string, string | undefined>;
  /** Parsed body when signature verification skipped (dev) */
  body?: Record<string, unknown>;
}
