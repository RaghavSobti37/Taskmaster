import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import {
  TRACKING_QUEUE,
  TRACKING_JOB_CLICK,
  TRACKING_JOB_OPEN,
} from '../../../bullmq/queue.constants';
import { legacyModels, trackingClaim } from '../../../shared/email-engine/legacy-bridge';
import {
  buildEventLocation,
  buildTrackingRequestLike,
  isAntiSpamBot,
  isGmailProxyOpen,
  isValidDisplayCity,
  locationIncForCity,
  mailEventGeoPayload,
} from '../../../shared/email-engine/tracking.helpers';
import type {
  TrackingClickJobPayload,
  TrackingJobPayload,
  TrackingOpenJobPayload,
} from './tracking.types';

const { EmailLog, Lead, Campaign, MailCampaign, MailEvent } = legacyModels;

/**
 * Background geo + DB writes — verbatim port of `track.js` setImmediate blocks.
 * Locked behavior: Gmail proxy skip, click backfillOpenGeo, no hardcoded cities.
 */
@Processor(TRACKING_QUEUE)
export class TrackingProcessor extends WorkerHost {
  private readonly logger = new Logger(TrackingProcessor.name);

  async process(job: Job<TrackingJobPayload>) {
    if (job.name === TRACKING_JOB_OPEN) {
      await this.processOpen(job.data as TrackingOpenJobPayload);
      return;
    }
    if (job.name === TRACKING_JOB_CLICK) {
      await this.processClick(job.data as TrackingClickJobPayload);
      return;
    }
    this.logger.warn(`Unknown tracking job: ${job.name}`);
  }

  private async processOpen(data: TrackingOpenJobPayload) {
    try {
      const { pixelId, userAgent } = data;
      if (isAntiSpamBot(userAgent)) return;

      const req = buildTrackingRequestLike(data);
      const location = isGmailProxyOpen(req, userAgent)
        ? await buildEventLocation(req, userAgent, { skipProxyGeo: true })
        : await buildEventLocation(req, userAgent, { enrich: true });

      const log = await trackingClaim.claimEmailLogOpen(pixelId);
      if (!log) return;

      const camp = await this.resolveCampaign(log.campaignId);
      if (!camp) return;

      const { doc: campDoc, isCore } = camp;
      const leadEmail = String(log.leadEmail).toLowerCase();

      if (isCore) {
        await Promise.all([
          Campaign.updateOne(
            { _id: campDoc._id, 'recipients.email': leadEmail },
            {
              $set: { 'recipients.$.status': 'Opened' },
              $inc: {
                'metrics.opened': 1,
                ...locationIncForCity(location.city, 'opens'),
              },
              $push: {
                timeSeries: { time: new Date(), opens: 1, clicks: 0 },
              },
            },
          ),
          Lead.updateOne(
            { email: log.leadEmail },
            { $set: { status: 'active', emailStatus: 'Active' } },
          ),
          MailEvent.create({
            eventType: 'Open',
            email: log.leadEmail,
            timestamp: new Date(),
            campaignId: campDoc._id,
            tenantId: campDoc.tenantId,
            userAgent,
            ...mailEventGeoPayload(location),
          }),
        ]);
      } else {
        await Promise.all([
          MailCampaign.updateOne(
            { _id: campDoc._id, 'recipients.email': leadEmail },
            {
              $set: { 'recipients.$.status': 'Opened' },
              $inc: {
                'stats.opened': 1,
                ...locationIncForCity(location.city, 'opens'),
              },
            },
          ),
          Lead.updateOne(
            { email: log.leadEmail },
            { $set: { status: 'active', emailStatus: 'Active' } },
          ),
          MailEvent.create({
            eventType: 'Open',
            email: log.leadEmail,
            timestamp: new Date(),
            campaignId: campDoc._id,
            tenantId: campDoc.tenantId,
            userAgent,
            ...mailEventGeoPayload(location),
          }),
        ]);
      }
    } catch (error) {
      this.logger.error('[GEOLOCATION_TRACK_OPEN_ERROR]', error);
      throw error;
    }
  }

  private async processClick(data: TrackingClickJobPayload) {
    try {
      const { clickId, userAgent, finalUrl } = data;
      if (isAntiSpamBot(userAgent)) return;

      const req = buildTrackingRequestLike(data);
      const location = await buildEventLocation(req, userAgent, {
        enrich: true,
        clickGeo: true,
      });

      const log = await trackingClaim.claimEmailLogClick(clickId);
      if (!log) return;

      const camp = await this.resolveCampaign(log.campaignId);
      if (!camp) return;

      const { doc: campDoc, isCore } = camp;
      const leadEmail = String(log.leadEmail).toLowerCase();

      const backfillOpenGeo = async () => {
        if (!isValidDisplayCity(location?.city)) return;
        await MailEvent.updateMany(
          {
            campaignId: campDoc._id,
            email: leadEmail,
            eventType: 'Open',
          },
          {
            $set: {
              'location.city': location.city,
              ...(location.country
                ? { 'location.country': location.country }
                : {}),
            },
          },
        ).setOptions({ bypassTenant: true });
      };

      if (isCore) {
        await Promise.all([
          Campaign.updateOne(
            { _id: campDoc._id, 'recipients.email': leadEmail },
            {
              $set: { 'recipients.$.status': 'Clicked' },
              $inc: {
                'metrics.clicked': 1,
                ...locationIncForCity(location.city, 'clicks'),
              },
              $push: {
                timeSeries: { time: new Date(), opens: 0, clicks: 1 },
              },
            },
          ),
          Lead.updateOne(
            { email: log.leadEmail },
            { $set: { status: 'engaged', emailStatus: 'Active' } },
          ),
          MailEvent.create({
            eventType: 'Click',
            email: log.leadEmail,
            timestamp: new Date(),
            campaignId: campDoc._id,
            tenantId: campDoc.tenantId,
            linkClicked: finalUrl,
            userAgent,
            ...mailEventGeoPayload(location),
          }),
          backfillOpenGeo(),
        ]);
      } else {
        await Promise.all([
          MailCampaign.updateOne(
            { _id: campDoc._id, 'recipients.email': leadEmail },
            {
              $set: { 'recipients.$.status': 'Clicked' },
              $inc: {
                'stats.clicked': 1,
                ...locationIncForCity(location.city, 'clicks'),
              },
            },
          ),
          Lead.updateOne(
            { email: log.leadEmail },
            { $set: { status: 'engaged', emailStatus: 'Active' } },
          ),
          MailEvent.create({
            eventType: 'Click',
            email: log.leadEmail,
            timestamp: new Date(),
            campaignId: campDoc._id,
            tenantId: campDoc.tenantId,
            linkClicked: finalUrl,
            userAgent,
            ...mailEventGeoPayload(location),
          }),
          backfillOpenGeo(),
        ]);
      }
    } catch (error) {
      this.logger.error('[GEOLOCATION_TRACK_CLICK_ERROR]', error);
      throw error;
    }
  }

  private async resolveCampaign(campaignId: string) {
    const objectId =
      typeof campaignId === 'string' &&
      /^[0-9a-fA-F]{24}$/.test(campaignId)
        ? campaignId
        : null;

    let doc = await Campaign.findOne({
      $or: [{ campaignId: String(campaignId) }, { _id: objectId }],
    });
    if (doc) return { doc, isCore: true };

    doc = await MailCampaign.findOne({ _id: objectId });
    if (doc) return { doc, isCore: false };

    return null;
  }
}
