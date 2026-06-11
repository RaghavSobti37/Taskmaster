import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AppConfigService } from '../config/config.service';
import {
  IMPORT_QUEUE,
  SUPABASE_SYNC_QUEUE,
  TRACKING_QUEUE,
  WEBHOOK_QUEUE,
} from './queue.constants';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        connection: {
          url: config.get('REDIS_URL'),
          maxRetriesPerRequest: null,
        },
      }),
    }),
    BullModule.registerQueue(
      { name: WEBHOOK_QUEUE },
      { name: TRACKING_QUEUE },
      { name: IMPORT_QUEUE },
      { name: SUPABASE_SYNC_QUEUE },
    ),
  ],
  exports: [BullModule],
})
export class BullMQModule {}

export {
  WEBHOOK_QUEUE,
  TRACKING_QUEUE,
  IMPORT_QUEUE,
  SUPABASE_SYNC_QUEUE,
  TRACKING_JOB_OPEN,
  TRACKING_JOB_CLICK,
  WEBHOOK_JOB_RESEND,
} from './queue.constants';
