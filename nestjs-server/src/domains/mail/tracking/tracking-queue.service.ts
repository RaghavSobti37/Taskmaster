import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  TRACKING_QUEUE,
  TRACKING_JOB_CLICK,
  TRACKING_JOB_OPEN,
} from '../../../bullmq/queue.constants';
import type {
  TrackingClickJobPayload,
  TrackingOpenJobPayload,
} from './tracking.types';

@Injectable()
export class TrackingQueueService {
  constructor(
    @InjectQueue(TRACKING_QUEUE) private readonly trackingQueue: Queue,
  ) {}

  enqueueOpen(payload: Omit<TrackingOpenJobPayload, 'kind'>) {
    return this.trackingQueue.add(TRACKING_JOB_OPEN, {
      kind: TRACKING_JOB_OPEN,
      ...payload,
    } satisfies TrackingOpenJobPayload);
  }

  enqueueClick(payload: Omit<TrackingClickJobPayload, 'kind'>) {
    return this.trackingQueue.add(TRACKING_JOB_CLICK, {
      kind: TRACKING_JOB_CLICK,
      ...payload,
    } satisfies TrackingClickJobPayload);
  }
}
