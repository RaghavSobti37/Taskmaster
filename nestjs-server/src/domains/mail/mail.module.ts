import { Module } from '@nestjs/common';
import { BullMQModule } from '../../bullmq/bullmq.module';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { TrackingController } from './tracking/tracking.controller';
import { TrackingProcessor } from './tracking/tracking.processor';
import { TrackingQueueService } from './tracking/tracking-queue.service';
import { ResendWebhookProcessor } from './webhooks/resend-webhook.processor';
import { ResendWebhookService } from './webhooks/resend-webhook.service';

/** Phase 5 — high-risk async mail workflows (tracking + Resend webhooks). */
@Module({
  imports: [BullMQModule, DatabaseModule],
  controllers: [TrackingController],
  providers: [
    TrackingQueueService,
    TrackingProcessor,
    ResendWebhookService,
    ResendWebhookProcessor,
  ],
})
export class MailModule {}
