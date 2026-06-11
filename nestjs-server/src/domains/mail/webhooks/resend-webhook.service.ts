import { Injectable, Logger } from '@nestjs/common';
import { geoLookup, legacyModels, mailService } from '../../../shared/email-engine/legacy-bridge';
import { isValidDisplayCity } from '../../../shared/email-engine/tracking.helpers';

const {
  isEmailImageProxy,
  isEmailLinkScanner,
  isGoogleInfrastructureIp,
  lookupGeoAsync,
  lookupGeoForClick,
  normalizeIp,
} = geoLookup;

const { Campaign, MailCampaign, MailEvent, Lead } = legacyModels;
const { updateEmailTags } = mailService;

type ResendPayload = {
  type: string;
  created_at?: string | Date;
  data: Record<string, unknown>;
};

export interface VerifiedResendWebhook {
  payload: ResendPayload;
  svixId?: string;
}

/** Maps Resend event types to MailEvent.eventType values. */
const EVENT_TYPE_MAP: Record<string, string> = {
  'email.opened': 'Open',
  'email.clicked': 'Click',
  'email.bounced': 'Bounce',
  'email.complained': 'Bounce',
  'email.delivered': 'Delivery',
};

/**
 * Port of locked `handleTrackResendWebhook` with MailEvent idempotency guard.
 * Uses legacy geoLookup — not handleApiResendWebhook (Mumbai fallback path).
 */
@Injectable()
export class ResendWebhookService {
  private readonly logger = new Logger(ResendWebhookService.name);

  verifyPayload(rawBody: string, headers: Record<string, string | undefined>) {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) {
      throw new Error('Webhook secret unconfigured');
    }

    const { Webhook } = require('svix');
    const wh = new Webhook(secret);
    const isProd = process.env.NODE_ENV === 'production';
    const hasSvixHeaders = Boolean(
      headers['svix-signature'] ||
        headers['resend-signature'] ||
        headers['resend-webhook-signature'],
    );

    if (isProd || hasSvixHeaders) {
      const svixHeaders = {
        'svix-id':
          headers['svix-id'] || headers['resend-webhook-id'] || '',
        'svix-timestamp':
          headers['svix-timestamp'] ||
          headers['resend-webhook-timestamp'] ||
          '',
        'svix-signature':
          headers['svix-signature'] ||
          headers['resend-signature'] ||
          headers['resend-webhook-signature'] ||
          '',
      };
      return {
        payload: wh.verify(rawBody, svixHeaders) as ResendPayload,
        svixId: svixHeaders['svix-id'] || undefined,
      };
    }

    return {
      payload: JSON.parse(rawBody) as ResendPayload,
      svixId: undefined,
    };
  }

  async processVerifiedWebhook(input: VerifiedResendWebhook): Promise<void> {
    const { payload, svixId } = input;
    if (!payload?.type || !payload?.data) {
      throw new Error('Invalid payload');
    }

    const eventType = payload.type;
    const data = payload.data;
    const emailId = data.email_id as string | undefined;
    const rawEmail = Array.isArray(data.to)
      ? data.to[0]
      : (data.to as string | undefined) ||
        (data.email as string | undefined);

    if (!rawEmail) return;

    const cleanEmail = String(rawEmail).toLowerCase().trim();
    this.logger.log(
      `Processing ${eventType} for ${cleanEmail} (Email ID: ${emailId || 'N/A'})`,
    );

    const { camp, isCore, recipient } = await this.resolveCampaignRecipient(
      payload,
      cleanEmail,
      emailId,
    );

    const mappedEventType = EVENT_TYPE_MAP[eventType];
    if (
      mappedEventType &&
      !(await this.shouldInsertMailEvent({
        svixId,
        messageId: emailId,
        eventType: mappedEventType,
        email: cleanEmail,
      }))
    ) {
      this.logger.debug(`Skipping duplicate MailEvent for ${eventType}`);
      return;
    }

    let locationObj: { city?: string; country?: string } | null = null;
    let ip = '';
    let userAgent = 'Unknown';
    let url = '';

    if (eventType === 'email.opened' || eventType === 'email.clicked') {
      if (eventType === 'email.clicked') {
        const click = (data.click || {}) as Record<string, string>;
        ip =
          click.ipAddress ||
          click.ip_address ||
          (data.ip_address as string) ||
          (data.ipAddress as string) ||
          '';
        userAgent =
          click.userAgent ||
          click.user_agent ||
          (data.user_agent as string) ||
          (data.userAgent as string) ||
          'Unknown';
        url = click.link || (data.url as string) || '';
      } else {
        const open = (data.open || {}) as Record<string, string>;
        ip =
          open.ipAddress ||
          open.ip_address ||
          (data.ip_address as string) ||
          (data.ipAddress as string) ||
          '';
        userAgent =
          open.userAgent ||
          open.user_agent ||
          (data.user_agent as string) ||
          (data.userAgent as string) ||
          'Unknown';
      }

      ip = normalizeIp(ip);

      if (eventType === 'email.clicked') {
        if (!isEmailLinkScanner(userAgent) && ip) {
          const geo = await lookupGeoForClick(ip);
          if (!geo.untrusted && isValidDisplayCity(geo.city)) {
            locationObj = {
              city: geo.city,
              country: geo.country || undefined,
            };
          }
        }
      } else if (
        ip &&
        !isEmailImageProxy(userAgent) &&
        !isGoogleInfrastructureIp(ip)
      ) {
        const geo = await lookupGeoAsync(ip);
        if (isValidDisplayCity(geo.city)) {
          locationObj = {
            city: geo.city,
            country: geo.country || undefined,
          };
        }
      }
    }

    const isWebhookBot = isEmailLinkScanner(userAgent);

    if (eventType === 'email.bounced' || eventType === 'email.complained') {
      await this.handleBounce(camp, isCore, recipient, cleanEmail, payload, emailId);
      return;
    }

    if (eventType === 'email.opened') {
      if (isWebhookBot) return;
      await this.handleOpen(
        camp,
        isCore,
        recipient,
        cleanEmail,
        payload,
        emailId,
        ip,
        userAgent,
        locationObj,
        svixId,
      );
      return;
    }

    if (eventType === 'email.clicked') {
      if (isWebhookBot) return;
      await this.handleClick(
        camp,
        isCore,
        recipient,
        cleanEmail,
        payload,
        emailId,
        ip,
        userAgent,
        url,
        locationObj,
        svixId,
      );
      return;
    }

    if (eventType === 'email.delivered') {
      await this.handleDelivered(camp, recipient, cleanEmail, payload, emailId, svixId);
    }
  }

  private async shouldInsertMailEvent(params: {
    svixId?: string;
    messageId?: string;
    eventType: string;
    email: string;
  }): Promise<boolean> {
    if (params.svixId) {
      const bySvix = await MailEvent.findOne({
        'metadata.svixId': params.svixId,
      }).setOptions({ bypassTenant: true });
      if (bySvix) return false;
    }

    if (params.messageId) {
      const byMessage = await MailEvent.findOne({
        messageId: params.messageId,
        eventType: params.eventType,
        email: params.email,
      }).setOptions({ bypassTenant: true });
      if (byMessage) return false;
    }

    return true;
  }

  private async resolveCampaignRecipient(
    payload: ResendPayload,
    cleanEmail: string,
    emailId?: string,
  ) {
    let camp: any = null;
    let isCore = true;
    let recipient: any = null;

    const tags = (payload.data.tags || []) as Array<{
      name: string;
      value: string;
    }>;
    let resendCampaignId: string | null = null;
    let resendRecipientId: string | null = null;
    const campTag = tags.find((t) => t.name === 'campaign_id');
    const recTag = tags.find((t) => t.name === 'recipient_id');
    if (campTag) resendCampaignId = campTag.value;
    if (recTag) resendRecipientId = recTag.value;

    if (resendCampaignId) {
      camp = await Campaign.findById(resendCampaignId);
      if (camp) {
        recipient = camp.recipients?.id
          ? camp.recipients.id(resendRecipientId)
          : camp.recipients?.find(
              (r: { _id?: { toString(): string } }) =>
                r._id && r._id.toString() === resendRecipientId,
            );
      }
      if (!camp) {
        camp = await MailCampaign.findById(resendCampaignId);
        if (camp) {
          isCore = false;
          recipient = camp.recipients?.id
            ? camp.recipients.id(resendRecipientId)
            : camp.recipients?.find(
                (r: { _id?: { toString(): string } }) =>
                  r._id && r._id.toString() === resendRecipientId,
              );
        }
      }
    }

    if (!camp && emailId) {
      camp = await Campaign.findOne({ 'recipients.messageId': emailId });
      if (camp) {
        recipient = camp.recipients.find(
          (r: { messageId?: string }) => r.messageId === emailId,
        );
      }
      if (!camp) {
        camp = await MailCampaign.findOne({ 'recipients.messageId': emailId });
        if (camp) {
          isCore = false;
          recipient = camp.recipients.find(
            (r: { messageId?: string }) => r.messageId === emailId,
          );
        }
      }
    }

    if (!recipient) {
      camp = await Campaign.findOne({ 'recipients.email': cleanEmail }).sort({
        updatedAt: -1,
      });
      if (camp) {
        isCore = true;
        recipient = camp.recipients.find(
          (r: { email?: string }) =>
            r.email && r.email.toLowerCase() === cleanEmail,
        );
      } else {
        camp = await MailCampaign.findOne({
          'recipients.email': cleanEmail,
        }).sort({ updatedAt: -1 });
        if (camp) {
          isCore = false;
          recipient = camp.recipients.find(
            (r: { email?: string }) =>
              r.email && r.email.toLowerCase() === cleanEmail,
          );
        }
      }
    }

    return { camp, isCore, recipient };
  }

  private mailEventMetadata(svixId?: string, extra?: Record<string, unknown>) {
    return svixId ? { svixId, ...extra } : extra;
  }

  private async handleBounce(
    camp: any,
    isCore: boolean,
    recipient: any,
    cleanEmail: string,
    payload: ResendPayload,
    emailId?: string,
  ) {
    const data = payload.data;
    if (recipient) {
      recipient.status = 'Bounced';
      recipient.error =
        (data.error as { message?: string })?.message ||
        data.error ||
        'Bounced via webhook';
      if (isCore) {
        camp.metrics.bounced = (camp.metrics.bounced || 0) + 1;
      } else {
        camp.stats.bounced = (camp.stats.bounced || 0) + 1;
      }
      await camp.save();
    }

    const coreCamps = await Campaign.find({ 'recipients.email': cleanEmail });
    for (const c of coreCamps) {
      let changed = false;
      c.recipients?.forEach((r: { email?: string; status?: string }) => {
        if (r.email === cleanEmail && r.status !== 'Bounced') {
          r.status = 'Bounced';
          changed = true;
        }
      });
      if (changed) {
        if (!c.metrics) c.metrics = { totalSent: 0, opened: 0, clicked: 0, bounced: 0 };
        c.metrics.bounced = (c.metrics.bounced || 0) + 1;
        await c.save();
      }
    }

    const mailCamps = await MailCampaign.find({ 'recipients.email': cleanEmail });
    for (const mc of mailCamps) {
      let changed = false;
      mc.recipients?.forEach((r: { email?: string; status?: string }) => {
        if (r.email === cleanEmail && r.status !== 'Bounced') {
          r.status = 'Bounced';
          changed = true;
        }
      });
      if (changed) {
        mc.stats.bounced = (mc.stats.bounced || 0) + 1;
        await mc.save();
      }
    }

    await Lead.updateOne(
      { email: cleanEmail },
      {
        $inc: { bounceCount: 1 },
        $set: { emailStatus: 'Bounced', status: 'inactive' },
      },
    );
    await updateEmailTags(cleanEmail, 'Invalid', 'Invalid');

    await MailEvent.create({
      eventType: 'Bounce',
      email: cleanEmail,
      timestamp: payload.created_at || new Date(),
      campaignId: camp?._id,
      messageId: emailId,
      metadata: {
        source: 'RESEND_WEBHOOK',
        error:
          (data.error as { message?: string })?.message ||
          data.error ||
          'Bounced',
      },
    });
  }

  private async handleOpen(
    camp: any,
    isCore: boolean,
    recipient: any,
    cleanEmail: string,
    payload: ResendPayload,
    emailId: string | undefined,
    ip: string,
    userAgent: string,
    locationObj: { city?: string; country?: string } | null,
    svixId?: string,
  ) {
    if (recipient) {
      if (
        !['Clicked', 'Bounced', 'Unsubscribed', 'Invalid'].includes(
          recipient.status,
        )
      ) {
        recipient.status = 'Opened';
        if (isCore) {
          camp.metrics.opened = (camp.metrics.opened || 0) + 1;
          camp.timeSeries.push({ time: new Date(), opens: 1, clicks: 0 });
        } else {
          camp.stats.opened = (camp.stats.opened || 0) + 1;
        }
        await camp.save();
      }
    }

    await Lead.updateOne(
      { email: cleanEmail },
      { $set: { status: 'active', emailStatus: 'Active' } },
    );
    await updateEmailTags(cleanEmail, 'Active', 'Active');

    await MailEvent.create({
      eventType: 'Open',
      email: cleanEmail,
      timestamp: payload.created_at || new Date(),
      campaignId: camp?._id,
      messageId: emailId,
      ipAddress: ip || undefined,
      userAgent,
      ...(locationObj ? { location: locationObj } : {}),
      ...(svixId ? { metadata: this.mailEventMetadata(svixId) } : {}),
    });
  }

  private async handleClick(
    camp: any,
    isCore: boolean,
    recipient: any,
    cleanEmail: string,
    payload: ResendPayload,
    emailId: string | undefined,
    ip: string,
    userAgent: string,
    url: string,
    locationObj: { city?: string; country?: string } | null,
    svixId?: string,
  ) {
    if (recipient) {
      if (!['Bounced', 'Unsubscribed', 'Invalid'].includes(recipient.status)) {
        recipient.status = 'Clicked';
        if (isCore) {
          camp.metrics.clicked = (camp.metrics.clicked || 0) + 1;
          const city = locationObj?.city;
          if (isValidDisplayCity(city)) {
            if (!camp.locationBreakdown) {
              camp.locationBreakdown = new Map();
            }
            const locData = camp.locationBreakdown.get(city) || {
              opens: 0,
              clicks: 0,
            };
            camp.locationBreakdown.set(city, {
              opens: locData.opens || 0,
              clicks: (locData.clicks || 0) + 1,
            });
            camp.markModified('locationBreakdown');
          }
          camp.timeSeries.push({ time: new Date(), opens: 0, clicks: 1 });
        } else {
          camp.stats.clicked = (camp.stats.clicked || 0) + 1;
        }
        await camp.save();
      }
    }

    await Lead.updateOne(
      { email: cleanEmail },
      { $set: { status: 'engaged', emailStatus: 'Active' } },
    );
    await updateEmailTags(cleanEmail, 'Active', 'Active');

    await MailEvent.create({
      eventType: 'Click',
      email: cleanEmail,
      timestamp: payload.created_at || new Date(),
      campaignId: camp?._id,
      messageId: emailId,
      linkClicked: url,
      ipAddress: ip || undefined,
      userAgent,
      ...(locationObj ? { location: locationObj } : {}),
      ...(svixId ? { metadata: this.mailEventMetadata(svixId) } : {}),
    });
  }

  private async handleDelivered(
    camp: any,
    recipient: any,
    cleanEmail: string,
    payload: ResendPayload,
    emailId: string | undefined,
    svixId?: string,
  ) {
    if (recipient && recipient.status === 'Pending') {
      recipient.status = 'Sent';
      await camp.save();
    }

    await MailEvent.create({
      eventType: 'Delivery',
      email: cleanEmail,
      timestamp: payload.created_at || new Date(),
      campaignId: camp?._id,
      messageId: emailId,
      ...(svixId ? { metadata: this.mailEventMetadata(svixId) } : {}),
    });
  }
}
