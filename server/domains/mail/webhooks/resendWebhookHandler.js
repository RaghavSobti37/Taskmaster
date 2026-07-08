const mongoose = require('mongoose');
const Campaign = require('../models/Campaign');
const MailCampaign = require('../models/MailCampaign');
const MailEvent = require('../models/MailEvent');
const Lead = require('../../../models/Lead');
const { updateEmailTags } = require('../../../services/mailService');
const { resolveCampaignTenantId } = require('../../../utils/resolveCampaignTenantId');
const { runWithWorkerTenant } = require('../../../utils/workerTenantContext');
const {
  isValidDisplayCity,
  isEmailImageProxy,
  isEmailLinkScanner,
  isGoogleInfrastructureIp,
  lookupGeoAsync,
  lookupGeoForClick,
  normalizeIp,
} = require('../../../utils/geoLookup');
const { bypassOptions } = require('../../../infrastructure/database/bypassTenantPolicy');
const {
  isOpenMetricSatisfied,
  isClickMetricSatisfied,
  hasCustomOpenForRecipient,
} = require('../../../utils/trackingClaim');
const logger = require('../../../utils/logger');

const WEBHOOK_BYPASS = bypassOptions('RESEND_WEBHOOK');

async function resolveDefaultTenantId() {
  const Tenant = require('../../../models/Tenant');
  const tenant = await Tenant.findOne({}).select('_id').setOptions(WEBHOOK_BYPASS).lean();
  return tenant?._id ?? null;
}

async function resolveMailEventTenantId(camp, cleanEmail) {
  const fromCampaign = await resolveCampaignTenantId(camp);
  if (fromCampaign) return fromCampaign;
  const lead = await Lead.findOne({ email: cleanEmail })
    .select('tenantId')
    .setOptions(WEBHOOK_BYPASS)
    .lean();
  if (lead?.tenantId) return lead.tenantId;
  return resolveDefaultTenantId();
}

async function saveCampaignDoc(camp, cleanEmail) {
  if (!camp) return;
  if (!camp.tenantId) {
    const tenantId = await resolveMailEventTenantId(camp, cleanEmail);
    if (tenantId) camp.tenantId = tenantId;
  }
  if (!camp.tenantId) {
    console.warn(`[Resend Webhook] Skipping campaign save — no tenantId for ${camp._id}`);
    return;
  }
  await camp.save();
}

function scheduleUpdateEmailTags(cleanEmail, tag, status, tenantId) {
  if (!tenantId) {
    console.warn(`[Resend Webhook] PersonHub tag sync skipped for ${cleanEmail}: tenantId required`);
    return;
  }

  setImmediate(async () => {
    try {
      await runWithWorkerTenant(String(tenantId), () => updateEmailTags(cleanEmail, tag, status));
    } catch (err) {
      console.warn(`[Resend Webhook] PersonHub tag sync skipped for ${cleanEmail}:`, err.message);
    }
  });
}

/** Keep webhook response path lean; full mail/Data Hub sync runs with resolved ALS tenant. */
async function safeUpdateEmailTags(cleanEmail, tag, status, tenantId) {
  const update = {
    $set: {
      'metadata.lastEmailAction': tag,
      'metadata.lastEmailActionDate': new Date(),
    },
  };
  if (tag) update.$addToSet = { tags: tag };
  await Lead.updateMany({ email: cleanEmail }, update).setOptions(WEBHOOK_BYPASS);
  scheduleUpdateEmailTags(cleanEmail, tag, status, tenantId);
}

async function lookupCampaignByTag(campaignTag, recipientTag) {
  if (!campaignTag) return { camp: null, isCore: true, recipient: null };

  let camp = await Campaign.findOne({ campaignId: campaignTag }).setOptions(WEBHOOK_BYPASS);
  if (!camp && mongoose.Types.ObjectId.isValid(campaignTag)) {
    camp = await Campaign.findById(campaignTag).setOptions(WEBHOOK_BYPASS);
  }
  if (camp) {
    const recipient = camp.recipients?.id
      ? camp.recipients.id(recipientTag)
      : camp.recipients?.find((r) => r._id && r._id.toString() === recipientTag);
    return { camp, isCore: true, recipient: recipient || null };
  }

  camp = await MailCampaign.findOne({ campaignId: campaignTag }).setOptions(WEBHOOK_BYPASS);
  if (!camp && mongoose.Types.ObjectId.isValid(campaignTag)) {
    camp = await MailCampaign.findById(campaignTag).setOptions(WEBHOOK_BYPASS);
  }
  if (camp) {
    const recipient = camp.recipients?.id
      ? camp.recipients.id(recipientTag)
      : camp.recipients?.find((r) => r._id && r._id.toString() === recipientTag);
    return { camp, isCore: false, recipient: recipient || null };
  }

  return { camp: null, isCore: true, recipient: null };
}

async function createResendMailEvent(payload, tenantId) {
  if (!tenantId) {
    console.warn(
      `[Resend Webhook] Skipping MailEvent (${payload.eventType}) — no tenantId for ${payload.email}`,
    );
    return;
  }
  await MailEvent.create({ ...payload, tenantId });
}

function extractResendEngagement(payload, eventType) {
  let ip = '';
  let userAgent = 'Unknown';
  let url = '';

  if (eventType === 'email.clicked') {
    ip = payload.data.click?.ipAddress || payload.data.click?.ip_address || payload.data.ip_address || payload.data.ipAddress || '';
    userAgent = payload.data.click?.userAgent || payload.data.click?.user_agent || payload.data.user_agent || payload.data.userAgent || 'Unknown';
    url = payload.data.click?.link || payload.data.url || '';
  } else if (eventType === 'email.opened') {
    ip = payload.data.open?.ipAddress || payload.data.open?.ip_address || payload.data.ip_address || payload.data.ipAddress || '';
    userAgent = payload.data.open?.userAgent || payload.data.open?.user_agent || payload.data.user_agent || payload.data.userAgent || 'Unknown';
  }

  return { ip: normalizeIp(ip), userAgent, url };
}

async function resolveResendEngagementGeo(payload, eventType) {
  const details = extractResendEngagement(payload, eventType);
  const { ip, userAgent } = details;
  let locationObj = null;

  if (eventType === 'email.clicked') {
    if (!isEmailLinkScanner(userAgent) && ip) {
      const geo = await lookupGeoForClick(ip);
      if (!geo.untrusted && isValidDisplayCity(geo.city)) {
        locationObj = { city: geo.city, country: geo.country || undefined };
      }
    }
  } else if (eventType === 'email.opened' && ip && !isEmailImageProxy(userAgent) && !isGoogleInfrastructureIp(ip)) {
    const geo = await lookupGeoAsync(ip);
    if (isValidDisplayCity(geo.city)) {
      locationObj = { city: geo.city, country: geo.country || undefined };
    }
  }

  return { ...details, locationObj };
}

/** Track host: /webhooks/resend — locked geo + tag-based campaign lookup */
async function handleTrackResendWebhook(req, res) {
  try {
    const { Webhook } = require('svix');
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) {
      return res.status(500).send('Webhook secret unconfigured');
    }
    const wh = new Webhook(secret);

    let payload;
    const isProd = process.env.NODE_ENV === 'production';
    const hasSvixHeaders = (req.headers['svix-signature'] || req.headers['resend-signature'] || req.headers['resend-webhook-signature']);

    if (isProd || hasSvixHeaders) {
      try {
        const rawBodyStr = req.rawBody ? req.rawBody.toString('utf8') : '';
        const svixHeaders = {
          'svix-id': req.headers['svix-id'] || req.headers['resend-webhook-id'],
          'svix-timestamp': req.headers['svix-timestamp'] || req.headers['resend-webhook-timestamp'],
          'svix-signature': req.headers['svix-signature'] || req.headers['resend-signature'] || req.headers['resend-webhook-signature'],
        };
        payload = wh.verify(rawBodyStr, svixHeaders);
      } catch (err) {
        console.error('Resend Webhook Signature Verification Failed:', err.message);
        if (isProd) {
          return res.status(400).send('Invalid webhook signature');
        }
        payload = req.body;
      }
    } else {
      payload = req.body;
    }

    if (!payload || !payload.type || !payload.data) {
      return res.status(400).send('Invalid payload');
    }

    const eventType = payload.type;
    const emailId = payload.data.email_id;
    const email = Array.isArray(payload.data.to) ? payload.data.to[0] : (payload.data.to || payload.data.email);

    if (!email) {
      return res.status(200).send('No recipient email found');
    }

    const cleanEmail = email.toLowerCase().trim();

    logger.debug('resendWebhook', 'Processing event', { eventType, email: cleanEmail, emailId });

    let camp = null;
    let isCore = true;
    let recipient = null;

    let resendCampaignId = null;
    let resendRecipientId = null;
    if (payload.data.tags && Array.isArray(payload.data.tags)) {
      const campTag = payload.data.tags.find((t) => t.name === 'campaign_id');
      const recTag = payload.data.tags.find((t) => t.name === 'recipient_id');
      if (campTag) resendCampaignId = campTag.value;
      if (recTag) resendRecipientId = recTag.value;
    }

    if (resendCampaignId) {
      ({ camp, isCore, recipient } = await lookupCampaignByTag(resendCampaignId, resendRecipientId));
    }

    if (!camp && emailId) {
      camp = await Campaign.findOne({ 'recipients.messageId': emailId }).setOptions(WEBHOOK_BYPASS);
      if (camp) {
        recipient = camp.recipients.find((r) => r.messageId === emailId);
      }
      if (!camp) {
        camp = await MailCampaign.findOne({ 'recipients.messageId': emailId }).setOptions(WEBHOOK_BYPASS);
        if (camp) {
          isCore = false;
          recipient = camp.recipients.find((r) => r.messageId === emailId);
        }
      }
    }

    if (!recipient) {
      camp = await Campaign.findOne({ 'recipients.email': cleanEmail }).sort({ updatedAt: -1 }).setOptions(WEBHOOK_BYPASS);
      if (camp) {
        isCore = true;
        recipient = camp.recipients.find((r) => r.email && r.email.toLowerCase() === cleanEmail);
      } else {
        camp = await MailCampaign.findOne({ 'recipients.email': cleanEmail }).sort({ updatedAt: -1 }).setOptions(WEBHOOK_BYPASS);
        if (camp) {
          isCore = false;
          recipient = camp.recipients.find((r) => r.email && r.email.toLowerCase() === cleanEmail);
        }
      }
    }

    const { ip, userAgent, url, locationObj } = await resolveResendEngagementGeo(payload, eventType);

    const isWebhookBot = isEmailLinkScanner(userAgent);
    const mailEventTenantId = await resolveMailEventTenantId(camp, cleanEmail);

    if (eventType === 'email.bounced' || eventType === 'email.complained') {
      if (recipient) {
        recipient.status = 'Bounced';
        recipient.error = payload.data.error?.message || payload.data.error || 'Bounced via webhook';
        if (isCore) {
          camp.metrics.bounced = (camp.metrics.bounced || 0) + 1;
        } else {
          camp.stats.bounced = (camp.stats.bounced || 0) + 1;
        }
        await saveCampaignDoc(camp, cleanEmail);
      }

      const coreCamps = await Campaign.find({ 'recipients.email': cleanEmail }).setOptions(WEBHOOK_BYPASS);
      for (const c of coreCamps) {
        let changed = false;
        c.recipients?.forEach((r) => {
          if (r.email === cleanEmail && r.status !== 'Bounced') {
            r.status = 'Bounced';
            changed = true;
          }
        });
        if (changed) {
          if (!c.metrics) c.metrics = { totalSent: 0, opened: 0, clicked: 0, bounced: 0 };
          c.metrics.bounced = (c.metrics.bounced || 0) + 1;
          await saveCampaignDoc(c, cleanEmail);
        }
      }

      const mailCamps = await MailCampaign.find({ 'recipients.email': cleanEmail }).setOptions(WEBHOOK_BYPASS);
      for (const mc of mailCamps) {
        let changed = false;
        mc.recipients?.forEach((r) => {
          if (r.email === cleanEmail && r.status !== 'Bounced') {
            r.status = 'Bounced';
            changed = true;
          }
        });
        if (changed) {
          mc.stats.bounced = (mc.stats.bounced || 0) + 1;
          await saveCampaignDoc(mc, cleanEmail);
        }
      }

      await Lead.updateOne(
        { email: cleanEmail },
        { $inc: { bounceCount: 1 }, $set: { emailStatus: 'Bounced', status: 'inactive' } },
      ).setOptions(WEBHOOK_BYPASS);
      await safeUpdateEmailTags(cleanEmail, 'Invalid', 'Invalid', mailEventTenantId);

      await createResendMailEvent({
        eventType: 'Bounce',
        email: cleanEmail,
        timestamp: payload.created_at || new Date(),
        campaignId: camp?._id,
        messageId: emailId,
        metadata: {
          source: 'RESEND_WEBHOOK',
          error: payload.data.error?.message || payload.data.error || 'Bounced',
        },
      }, mailEventTenantId);
    } else if (eventType === 'email.opened') {
      if (isWebhookBot) return res.status(200).send('Ignored bot open');

      const priorStatus = recipient?.status;
      const countOpenMetric = recipient
        && !isOpenMetricSatisfied(priorStatus)
        && !['Bounced', 'Unsubscribed', 'Invalid'].includes(priorStatus)
        && !(camp && await hasCustomOpenForRecipient(camp._id, cleanEmail));

      if (recipient) {
        if (!['Bounced', 'Unsubscribed', 'Invalid'].includes(priorStatus)) {
          if (!isOpenMetricSatisfied(priorStatus)) {
            recipient.status = 'Opened';
          }

          if (countOpenMetric) {
            if (isCore) {
              camp.metrics.opened = (camp.metrics.opened || 0) + 1;
              camp.timeSeries.push({ time: new Date(), opens: 1, clicks: 0 });
            } else {
              camp.stats.opened = (camp.stats.opened || 0) + 1;
            }
          }
          await saveCampaignDoc(camp, cleanEmail);
        }
      }

      if (!countOpenMetric) {
        return res.status(200).send('Duplicate open ignored');
      }

      await Lead.updateOne(
        { email: cleanEmail },
        { $set: { status: 'active', emailStatus: 'Active' } },
      ).setOptions(WEBHOOK_BYPASS);
      await safeUpdateEmailTags(cleanEmail, 'Active', 'Active', mailEventTenantId);

      await createResendMailEvent({
        eventType: 'Open',
        email: cleanEmail,
        timestamp: payload.created_at || new Date(),
        campaignId: camp?._id,
        messageId: emailId,
        ipAddress: ip || undefined,
        userAgent,
        ...(locationObj ? { location: locationObj } : {}),
      }, mailEventTenantId);
    } else if (eventType === 'email.clicked') {
      if (isWebhookBot) return res.status(200).send('Ignored bot click');

      const priorStatus = recipient?.status;
      const countClickMetric = recipient
        && !isClickMetricSatisfied(priorStatus)
        && !['Bounced', 'Unsubscribed', 'Invalid'].includes(priorStatus);

      if (recipient) {
        if (!['Bounced', 'Unsubscribed', 'Invalid'].includes(priorStatus)) {
          if (!isClickMetricSatisfied(priorStatus)) {
            recipient.status = 'Clicked';
          }

          if (countClickMetric) {
            if (isCore) {
              camp.metrics.clicked = (camp.metrics.clicked || 0) + 1;
              const city = locationObj?.city;
              if (isValidDisplayCity(city)) {
                if (!camp.locationBreakdown) {
                  camp.locationBreakdown = new Map();
                }
                const locData = camp.locationBreakdown.get(city) || { opens: 0, clicks: 0 };
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
          }
          await saveCampaignDoc(camp, cleanEmail);
        }
      }

      if (!countClickMetric) {
        return res.status(200).send('Duplicate click ignored');
      }

      await Lead.updateOne(
        { email: cleanEmail },
        { $set: { status: 'engaged', emailStatus: 'Active' } },
      ).setOptions(WEBHOOK_BYPASS);
      await safeUpdateEmailTags(cleanEmail, 'Active', 'Active', mailEventTenantId);

      await createResendMailEvent({
        eventType: 'Click',
        email: cleanEmail,
        timestamp: payload.created_at || new Date(),
        campaignId: camp?._id,
        messageId: emailId,
        linkClicked: url,
        ipAddress: ip || undefined,
        userAgent,
        ...(locationObj ? { location: locationObj } : {}),
      }, mailEventTenantId);
    } else if (eventType === 'email.delivered') {
      if (recipient) {
        if (recipient.status === 'Pending') {
          recipient.status = 'Sent';
          await saveCampaignDoc(camp, cleanEmail);
        }
      }

      await createResendMailEvent({
        eventType: 'Delivery',
        email: cleanEmail,
        timestamp: payload.created_at || new Date(),
        campaignId: camp?._id,
        messageId: emailId,
      }, mailEventTenantId);
    }

    res.status(200).send('Webhook processed');
  } catch (err) {
    console.error('Resend Webhook Error:', err);
    res.status(500).send('Server Error');
  }
}

/** API host: /api/webhooks/resend — same trusted geo + bot filtering as track host. */
async function handleApiResendWebhook(req, res) {
  try {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (secret) {
      const { Webhook } = require('svix');
      const wh = new Webhook(secret);
      const svix_id = req.headers['svix-id'];
      const svix_timestamp = req.headers['svix-timestamp'];
      const svix_signature = req.headers['svix-signature'];

      if (!svix_id || !svix_timestamp || !svix_signature) {
        return res.status(400).send('MISSING_SVIX_HEADERS');
      }

      const payloadString = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);
      try {
        wh.verify(payloadString, {
          'svix-id': svix_id,
          'svix-timestamp': svix_timestamp,
          'svix-signature': svix_signature,
        });
      } catch (err) {
        console.warn('❌ [Resend Webhook] Signature verification failed:', err.message);
        return res.status(401).send('INVALID_SIGNATURE');
      }
    }

    const payload = req.body;
    if (!payload || !payload.type || !payload.data) {
      return res.status(400).send('INVALID_PAYLOAD');
    }

    const eventType = payload.type;
    const emailId = payload.data.email_id;
    const email = Array.isArray(payload.data.to) ? payload.data.to[0] : (payload.data.to || payload.data.email);

    if (!email) {
      return res.status(200).send('NO_EMAIL_FOUND');
    }

    const cleanEmail = email.toLowerCase().trim();

    logger.debug('resendWebhook', 'Processing event (API)', { eventType, email: cleanEmail, emailId });

    let camp = null;
    let isCore = true;
    let recipient = null;

    let resendCampaignId = null;
    let resendRecipientId = null;
    if (payload.data.tags && Array.isArray(payload.data.tags)) {
      const campTag = payload.data.tags.find((t) => t.name === 'campaign_id');
      const recTag = payload.data.tags.find((t) => t.name === 'recipient_id');
      if (campTag) resendCampaignId = campTag.value;
      if (recTag) resendRecipientId = recTag.value;
    }

    if (resendCampaignId) {
      ({ camp, isCore, recipient } = await lookupCampaignByTag(resendCampaignId, resendRecipientId));
    }

    if (!camp && emailId) {
      camp = await Campaign.findOne({ 'recipients.messageId': emailId }).setOptions(WEBHOOK_BYPASS);
      if (camp) {
        recipient = camp.recipients.find((r) => r.messageId === emailId);
      }
      if (!camp) {
        camp = await MailCampaign.findOne({ 'recipients.messageId': emailId }).setOptions(WEBHOOK_BYPASS);
        if (camp) {
          isCore = false;
          recipient = camp.recipients.find((r) => r.messageId === emailId);
        }
      }
    }

    if (!recipient) {
      camp = await Campaign.findOne({ 'recipients.email': cleanEmail }).sort({ updatedAt: -1 }).setOptions(WEBHOOK_BYPASS);
      if (camp) {
        isCore = true;
        recipient = camp.recipients.find((r) => r.email && r.email.toLowerCase() === cleanEmail);
      } else {
        camp = await MailCampaign.findOne({ 'recipients.email': cleanEmail }).sort({ updatedAt: -1 }).setOptions(WEBHOOK_BYPASS);
        if (camp) {
          isCore = false;
          recipient = camp.recipients.find((r) => r.email && r.email.toLowerCase() === cleanEmail);
        }
      }
    }

    const { ip, userAgent, url, locationObj } = await resolveResendEngagementGeo(payload, eventType);

    const mailEventTenantId = await resolveMailEventTenantId(camp, cleanEmail);
    const apiWebhookBot = isEmailLinkScanner(userAgent || '');

    if (eventType === 'email.bounced' || eventType === 'email.complained') {
      if (recipient) {
        recipient.status = 'Bounced';
        recipient.error = payload.data.error?.message || payload.data.error || 'Bounced via webhook';
        if (isCore) {
          camp.metrics.bounced = (camp.metrics.bounced || 0) + 1;
        } else {
          camp.stats.bounced = (camp.stats.bounced || 0) + 1;
        }
        await saveCampaignDoc(camp, cleanEmail);
      }

      const coreCamps = await Campaign.find({ 'recipients.email': cleanEmail }).setOptions(WEBHOOK_BYPASS);
      for (const c of coreCamps) {
        let changed = false;
        c.recipients?.forEach((r) => {
          if (r.email === cleanEmail && r.status !== 'Bounced') {
            r.status = 'Bounced';
            changed = true;
          }
        });
        if (changed) {
          if (!c.metrics) c.metrics = { totalSent: 0, opened: 0, clicked: 0, bounced: 0 };
          c.metrics.bounced = (c.metrics.bounced || 0) + 1;
          await saveCampaignDoc(c, cleanEmail);
        }
      }

      const mailCamps = await MailCampaign.find({ 'recipients.email': cleanEmail }).setOptions(WEBHOOK_BYPASS);
      for (const mc of mailCamps) {
        let changed = false;
        mc.recipients?.forEach((r) => {
          if (r.email === cleanEmail && r.status !== 'Bounced') {
            r.status = 'Bounced';
            changed = true;
          }
        });
        if (changed) {
          mc.stats.bounced = (mc.stats.bounced || 0) + 1;
          await saveCampaignDoc(mc, cleanEmail);
        }
      }

      await Lead.updateOne(
        { email: cleanEmail },
        { $inc: { bounceCount: 1 }, $set: { emailStatus: 'Bounced', status: 'inactive' } },
      ).setOptions(WEBHOOK_BYPASS);
      await safeUpdateEmailTags(cleanEmail, 'Invalid', 'Invalid', mailEventTenantId);

      await createResendMailEvent({
        eventType: 'Bounce',
        email: cleanEmail,
        timestamp: payload.created_at || new Date(),
        campaignId: camp?._id,
        messageId: emailId,
        metadata: {
          source: 'RESEND_WEBHOOK',
          error: payload.data.error?.message || payload.data.error || 'Bounced',
        },
      }, mailEventTenantId);
    } else if (eventType === 'email.opened') {
      if (apiWebhookBot) return res.status(200).send('Ignored bot open');

      const priorStatus = recipient?.status;
      const countOpenMetric = recipient
        && !isOpenMetricSatisfied(priorStatus)
        && !['Bounced', 'Unsubscribed', 'Invalid'].includes(priorStatus)
        && !(camp && await hasCustomOpenForRecipient(camp._id, cleanEmail));

      if (recipient) {
        if (!['Bounced', 'Unsubscribed', 'Invalid'].includes(priorStatus)) {
          if (!isOpenMetricSatisfied(priorStatus)) {
            recipient.status = 'Opened';
          }

          if (countOpenMetric) {
            if (isCore) {
              camp.metrics.opened = (camp.metrics.opened || 0) + 1;
              const city = locationObj?.city;
              if (isValidDisplayCity(city)) {
                if (!camp.locationBreakdown) {
                  camp.locationBreakdown = new Map();
                }
                const locData = camp.locationBreakdown.get(city) || { opens: 0, clicks: 0 };
                camp.locationBreakdown.set(city, {
                  opens: (locData.opens || 0) + 1,
                  clicks: locData.clicks || 0,
                });
                camp.markModified('locationBreakdown');
              }
              camp.timeSeries.push({ time: new Date(), opens: 1, clicks: 0 });
            } else {
              camp.stats.opened = (camp.stats.opened || 0) + 1;
            }
          }
          await saveCampaignDoc(camp, cleanEmail);
        }
      }

      if (!countOpenMetric) {
        return res.status(200).send('Duplicate open ignored');
      }

      await Lead.updateOne(
        { email: cleanEmail },
        { $set: { status: 'active', emailStatus: 'Active' } },
      ).setOptions(WEBHOOK_BYPASS);
      await safeUpdateEmailTags(cleanEmail, 'Active', 'Active', mailEventTenantId);

      await createResendMailEvent({
        eventType: 'Open',
        email: cleanEmail,
        timestamp: payload.created_at || new Date(),
        campaignId: camp?._id,
        messageId: emailId,
        ipAddress: ip || undefined,
        userAgent,
        ...(locationObj ? { location: locationObj } : {}),
      }, mailEventTenantId);
    } else if (eventType === 'email.clicked') {
      if (apiWebhookBot) return res.status(200).send('Ignored bot click');

      const priorStatus = recipient?.status;
      const countClickMetric = recipient
        && !isClickMetricSatisfied(priorStatus)
        && !['Bounced', 'Unsubscribed', 'Invalid'].includes(priorStatus);

      if (recipient) {
        if (!['Bounced', 'Unsubscribed', 'Invalid'].includes(priorStatus)) {
          if (!isClickMetricSatisfied(priorStatus)) {
            recipient.status = 'Clicked';
          }

          if (countClickMetric) {
            if (isCore) {
              camp.metrics.clicked = (camp.metrics.clicked || 0) + 1;
              const city = locationObj?.city;
              if (isValidDisplayCity(city)) {
                if (!camp.locationBreakdown) {
                  camp.locationBreakdown = new Map();
                }
                const locData = camp.locationBreakdown.get(city) || { opens: 0, clicks: 0 };
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
          }
          await saveCampaignDoc(camp, cleanEmail);
        }
      }

      if (!countClickMetric) {
        return res.status(200).send('Duplicate click ignored');
      }

      await Lead.updateOne(
        { email: cleanEmail },
        { $set: { status: 'engaged', emailStatus: 'Active' } },
      ).setOptions(WEBHOOK_BYPASS);
      await safeUpdateEmailTags(cleanEmail, 'Active', 'Active', mailEventTenantId);

      await createResendMailEvent({
        eventType: 'Click',
        email: cleanEmail,
        timestamp: payload.created_at || new Date(),
        campaignId: camp?._id,
        messageId: emailId,
        linkClicked: url,
        ipAddress: ip || undefined,
        userAgent,
        ...(locationObj ? { location: locationObj } : {}),
      }, mailEventTenantId);
    } else if (eventType === 'email.delivered') {
      if (recipient) {
        if (recipient.status === 'Pending') {
          recipient.status = 'Sent';
          await saveCampaignDoc(camp, cleanEmail);
        }
      }

      await createResendMailEvent({
        eventType: 'Delivery',
        email: cleanEmail,
        timestamp: payload.created_at || new Date(),
        campaignId: camp?._id,
        messageId: emailId,
      }, mailEventTenantId);
    }

    res.status(200).send('SUCCESS');
  } catch (err) {
    console.error('Error in Resend webhook processing:', err);
    res.status(500).send('SERVER_ERROR');
  }
}

module.exports = {
  handleTrackResendWebhook,
  handleApiResendWebhook,
  __private: {
    safeUpdateEmailTags,
    scheduleUpdateEmailTags,
    extractResendEngagement,
    resolveResendEngagementGeo,
  },
};
