import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import {
  WEBHOOK_QUEUE,
  WEBHOOK_JOB_RESEND,
} from '../../../bullmq/queue.constants';
import type { ResendWebhookJobPayload } from '../tracking/tracking.types';
import { ResendWebhookService } from './resend-webhook.service';

/**
 * Async Resend webhook consumer — locked geo path + MailEvent idempotency.
 * HTTP ingress should enqueue `WEBHOOK_JOB_RESEND` after Svix verify (future controller).
 */
@Processor(WEBHOOK_QUEUE)
export class ResendWebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(ResendWebhookProcessor.name);

  constructor(private readonly resendWebhookService: ResendWebhookService) {
    super();
  }

  async process(job: Job<ResendWebhookJobPayload>) {
    if (job.name !== WEBHOOK_JOB_RESEND) {
      this.logger.warn(`Unknown webhook job: ${job.name}`);
      return;
    }

    try {
      const verified = this.resendWebhookService.verifyPayload(
        job.data.rawBody,
        job.data.headers,
      );
      await this.resendWebhookService.processVerifiedWebhook(verified);
    } catch (error) {
      this.logger.error('Resend webhook job failed', error);
      throw error;
    }
  }
}
