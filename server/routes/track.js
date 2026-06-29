const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const {
  isValidDisplayCity,
  isEmailImageProxy,
  isEmailLinkScanner,
  isGoogleInfrastructureIp,
  extractClientIp,
  lookupGeoAsync,
  lookupGeoSync,
  lookupGeoForClick,
  normalizeIp,
} = require('../utils/geoLookup');
const Lead = require('../models/Lead');
const Campaign = require('../models/Campaign');
const { claimEmailLogOpen, claimEmailLogClick } = require('../utils/trackingClaim');





function isAntiSpamBot(userAgent) {
  if (!userAgent) return false;
  if (isEmailImageProxy(userAgent)) return false;
  if (/AppleMail/i.test(userAgent)) return false;
  return isEmailLinkScanner(userAgent);
}

const buildEventLocation = async (req, userAgent, { skipProxyGeo = false, enrich = false, clickGeo = false } = {}) => {
  const ip = extractClientIp(req);

  if (clickGeo && isEmailLinkScanner(userAgent)) {
    return { city: null, region: null, country: null, ip, untrusted: true };
  }

  let raw = clickGeo
    ? await lookupGeoForClick(ip)
    : enrich
      ? await lookupGeoAsync(ip)
      : lookupGeoSync(ip);

  if (skipProxyGeo && isEmailImageProxy(userAgent)) {
    return { city: null, region: raw.region, country: raw.country, ip: raw.ip };
  }
  if (raw.untrusted) {
    return { city: null, region: raw.region, country: raw.country, ip: raw.ip };
  }
  if (raw.city && !isValidDisplayCity(raw.city)) {
    return { ...raw, city: null };
  }
  return raw;
};

const mailEventGeoPayload = (location) => {
  const city = isValidDisplayCity(location?.city) ? location.city.trim() : undefined;
  const country = location?.country || undefined;
  return {
    ipAddress: location?.ip || undefined,
    location: city || country ? { city, country } : undefined,
  };
};

const locationIncForCity = (city, field) => {
  if (!isValidDisplayCity(city)) return {};
  const cleanCity = city.replace(/\./g, '');
  return { [`locationBreakdown.${cleanCity}.${field}`]: 1 };
};

// Open Tracking Pixel Endpoint
router.get('/open/:pixelId.gif', async (req, res) => {
  try {
    const { pixelId } = req.params;

    // 1. Instantly return a 1x1 transparent tracking GIF to prevent email loading delays
    const pixelBuffer = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 
      'base64'
    );
    res.writeHead(200, {
      'Content-Type': 'image/gif',
      'Content-Length': pixelBuffer.length,
      'Cache-Control': 'no-store, no-cache, must-revalidate, private'
    });
    res.end(pixelBuffer);

    // 2. Offload GeoIP and database writes to a non-blocking background thread
    setImmediate(async () => {
      try {
        const userAgent = req.headers['user-agent'] || 'Unknown';
        
        // Anti-Bot Protection
        if (isAntiSpamBot(userAgent)) return;

        // Run the local in-memory location lookup (Gmail proxy IP ≠ reader city — skip geo on opens)
        const location = isEmailImageProxy(userAgent) || isGoogleInfrastructureIp(extractClientIp(req))
          ? await buildEventLocation(req, userAgent, { skipProxyGeo: true })
          : await buildEventLocation(req, userAgent, { enrich: true });

        const log = await claimEmailLogOpen(pixelId);
        if (!log) return;

        const MailCampaign = require('../models/MailCampaign');
        const MailEvent = require('../models/MailEvent');

        let camp = await Campaign.findOne({ $or: [{ campaignId: String(log.campaignId) }, { _id: log.campaignId.match(/^[0-9a-fA-F]{24}$/) ? log.campaignId : null }] });
        let isCore = true;
        if (!camp) {
          camp = await MailCampaign.findOne({ _id: log.campaignId.match(/^[0-9a-fA-F]{24}$/) ? log.campaignId : null });
          isCore = false;
        }

        if (camp) {
          if (isCore) {
            await Promise.all([
              Campaign.updateOne(
                { _id: camp._id, "recipients.email": log.leadEmail.toLowerCase() },
                { 
                  $set: { "recipients.$.status": "Opened" },
                  $inc: { 
                    "metrics.opened": 1,
                    ...locationIncForCity(location.city, 'opens')
                  },
                  $push: { timeSeries: { time: new Date(), opens: 1, clicks: 0 } }
                }
              ),
              Lead.updateOne(
                { email: log.leadEmail },
                { $set: { status: 'active', emailStatus: 'Active' } }
              ),
              MailEvent.create({
                eventType: 'Open',
                email: log.leadEmail,
                timestamp: new Date(),
                campaignId: camp._id,
                tenantId: camp.tenantId,
                userAgent,
                ...mailEventGeoPayload(location),
              })
            ]);
          } else {
            const updateObj = {
              $set: { "recipients.$.status": "Opened" },
              $inc: {
                "stats.opened": 1,
                ...locationIncForCity(location.city, 'opens')
              }
            };

            await Promise.all([
              MailCampaign.updateOne(
                { _id: camp._id, "recipients.email": log.leadEmail.toLowerCase() },
                updateObj
              ),
              Lead.updateOne(
                { email: log.leadEmail },
                { $set: { status: 'active', emailStatus: 'Active' } }
              ),
              MailEvent.create({
                eventType: 'Open',
                email: log.leadEmail,
                timestamp: new Date(),
                campaignId: camp._id,
                tenantId: camp.tenantId,
                userAgent,
                ...mailEventGeoPayload(location),
              })
            ]);
          }
        }
      } catch (bgError) {
        console.error('[GEOLOCATION_TRACK_OPEN_ERROR]', bgError);
      }
    });
  } catch (error) {
    if (!res.headersSent) {
      res.sendStatus(204);
    }
  }
});

// Click Tracking Redirect Wrapper
router.get('/click/:clickId', async (req, res) => {
  try {
    const { clickId } = req.params;
    const destinationUrl = req.query.redirect;
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const fallbackRedirect = process.env.FRONTEND_URL || 'http://localhost:5173';
    const finalUrl = destinationUrl ? decodeURIComponent(destinationUrl) : fallbackRedirect;

    // 1. Instantly return HTML redirection content
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta http-equiv="refresh" content="0; url=${finalUrl}">
          <title>Redirecting...</title>
        </head>
        <body>
          <script>window.location.href = "${finalUrl}";</script>
          <p>If you are not redirected automatically, <a href="${finalUrl}">click here</a>.</p>
        </body>
      </html>
    `);

    // 2. Offload telemetry writes to setImmediate
    setImmediate(async () => {
      try {
        if (isAntiSpamBot(userAgent)) return;

        const location = await buildEventLocation(req, userAgent, { enrich: true, clickGeo: true });

        const log = await claimEmailLogClick(clickId);
        if (!log) return;

        const MailCampaign = require('../models/MailCampaign');
        const MailEvent = require('../models/MailEvent');

        let camp = await Campaign.findOne({ $or: [{ campaignId: String(log.campaignId) }, { _id: log.campaignId.match(/^[0-9a-fA-F]{24}$/) ? log.campaignId : null }] });
        let isCore = true;
        if (!camp) {
          camp = await MailCampaign.findOne({ _id: log.campaignId.match(/^[0-9a-fA-F]{24}$/) ? log.campaignId : null });
          isCore = false;
        }

        if (camp) {
          const backfillOpenGeo = async () => {
            if (!isValidDisplayCity(location?.city)) return;
            await MailEvent.updateMany(
              {
                campaignId: camp._id,
                email: log.leadEmail.toLowerCase(),
                eventType: 'Open',
              },
              {
                $set: {
                  'location.city': location.city,
                  ...(location.country ? { 'location.country': location.country } : {}),
                },
              }
            ).setOptions({ bypassTenant: true });
          };

          if (isCore) {
            const updateObj = {
              $set: { "recipients.$.status": "Clicked" },
              $inc: { 
                "metrics.clicked": 1,
                ...locationIncForCity(location.city, 'clicks')
              },
              $push: { timeSeries: { time: new Date(), opens: 0, clicks: 1 } }
            };

            await Promise.all([
              Campaign.updateOne(
                { _id: camp._id, "recipients.email": log.leadEmail.toLowerCase() },
                updateObj
              ),
              Lead.updateOne(
                { email: log.leadEmail },
                { $set: { status: 'engaged', emailStatus: 'Active' } }
              ),
              MailEvent.create({
                eventType: 'Click',
                email: log.leadEmail,
                timestamp: new Date(),
                campaignId: camp._id,
                tenantId: camp.tenantId,
                linkClicked: finalUrl,
                userAgent,
                ...mailEventGeoPayload(location),
              }),
              backfillOpenGeo(),
            ]);
          } else {
            const updateObj = {
              $set: { "recipients.$.status": "Clicked" },
              $inc: {
                "stats.clicked": 1,
                ...locationIncForCity(location.city, 'clicks')
              }
            };

            await Promise.all([
              MailCampaign.updateOne(
                { _id: camp._id, "recipients.email": log.leadEmail.toLowerCase() },
                updateObj
              ),
              Lead.updateOne(
                { email: log.leadEmail },
                { $set: { status: 'engaged', emailStatus: 'Active' } }
              ),
              MailEvent.create({
                eventType: 'Click',
                email: log.leadEmail,
                timestamp: new Date(),
                campaignId: camp._id,
                tenantId: camp.tenantId,
                linkClicked: finalUrl,
                userAgent,
                ...mailEventGeoPayload(location),
              }),
              backfillOpenGeo(),
            ]);
          }
        }
      } catch (bgError) {
        console.error('[GEOLOCATION_TRACK_CLICK_ERROR]', bgError);
      }
    });

  } catch (err) {
    console.error('Click Tracking Error:', err);
    if (!res.headersSent) {
      res.redirect(302, process.env.FRONTEND_URL || 'http://localhost:5173');
    }
  }
});

const { handleTrackResendWebhook } = require('../domains/mail/webhooks/resendWebhookHandler');

// Unified Resend Webhook Handler (Opens, Clicks, Bounces, Delivered)
router.post('/webhooks/resend', handleTrackResendWebhook);


// Legacy GET /unsubscribe on API host → frontend page (old emails pointed at API /unsubscribe)
router.get('/unsubscribe', (req, res) => {
  if (req.headers['user-agent'] && req.headers['user-agent'].toLowerCase().includes('axios')) {
    return res.status(401).json({ error: 'Unauthorized API access' });
  }
  const frontend = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  res.redirect(302, `${frontend}/unsubscribe${qs}`);
});

// Unsubscribe Handler
router.post('/unsubscribe', async (req, res) => {
  const { email, reason, campaignId, recipientId, token } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  // Token verification for legacy pre-signed links; email-only self-service allowed
  if (token) {
    const crypto = require('crypto');
    const { getJwtSecretForHmac } = require('../utils/jwtSecret');
    const expectedToken = crypto.createHmac('sha256', getJwtSecretForHmac())
      .update(email.toLowerCase().trim())
      .digest('hex');

    if (token !== expectedToken) {
      return res.status(403).json({ error: 'Invalid unsubscribe token' });
    }
  }

  try {
    const cleanEmail = email.toLowerCase().trim();
    
    // Find lead details to get name
    const leadDoc = await Lead.findOne({ email: cleanEmail });
    const leadName = leadDoc ? leadDoc.name : '';

    // 1. Update Lead Status
    await Lead.updateMany(
      { email: cleanEmail }, 
      { $set: { unsubscribed: true, unsubscribeReason: reason || 'Opt-out', emailStatus: 'Unsubscribed', status: 'inactive' } }
    );

    const Contact = require('../models/Contact');
    await Contact.updateMany(
      { email: cleanEmail },
      {
        $set: {
          unsubscribed: true,
          unsubscribeReason: reason || 'Opt-out',
          emailStatus: 'Unsubscribed',
        },
      }
    ).setOptions({ bypassTenant: true });

    // Sync to HolySheet
    const { syncUnsubscribeToSheet } = require('../services/holySheetService');
    await syncUnsubscribeToSheet({
      email: cleanEmail,
      name: leadName,
      campaignId: campaignId || 'N/A',
      reason: reason || 'Opt-out',
      unsubscribedAt: new Date()
    });

    const Campaign = require('../models/Campaign');
    const MailCampaign = require('../models/MailCampaign');
    const MailEvent = require('../models/MailEvent');

    // 2. Track MailEvent for Campaign if campaignId exists
    if (campaignId && campaignId !== 'undefined' && campaignId !== 'null') {
      await MailEvent.create({
        eventType: 'Unsubscribe',
        email: cleanEmail,
        timestamp: new Date(),
        campaignId: campaignId,
        metadata: { recipientId, reason }
      });

      // Update specific campaign recipient status
      let campaign = await MailCampaign.findById(campaignId);
      let isCore = false;
      if (!campaign) {
        campaign = await Campaign.findOne({ $or: [{ _id: campaignId.match(/^[0-9a-fA-F]{24}$/) ? campaignId : null }, { campaignId }] });
        isCore = true;
      }

      if (campaign) {
        const recipient = campaign.recipients?.id ? campaign.recipients.id(recipientId) : campaign.recipients?.find(r => r._id.toString() === recipientId.toString() || r.email === cleanEmail);
        if (recipient && recipient.status !== 'Unsubscribed') {
          recipient.status = 'Unsubscribed';
          if (!isCore) {
            campaign.stats.unsubscribed = (campaign.stats.unsubscribed || 0) + 1;
          }
          await campaign.save();
        }
      }
    }

    // 3. Mark this email as Unsubscribed in all other Campaign/MailCampaign recipients
    const camps = await Campaign.find({ 'recipients.email': new RegExp(`^${cleanEmail}$`, 'i') });
    for (const camp of camps) {
      let changed = false;
      camp.recipients.forEach(r => {
        if (r.email && r.email.toLowerCase() === cleanEmail && r.status !== 'Unsubscribed') {
          r.status = 'Unsubscribed';
          changed = true;
        }
      });
      if (changed) await camp.save();
    }

    const mailCamps = await MailCampaign.find({ 'recipients.email': new RegExp(`^${cleanEmail}$`, 'i') });
    for (const camp of mailCamps) {
      let changed = false;
      camp.recipients.forEach(r => {
        if (r.email && r.email.toLowerCase() === cleanEmail && r.status !== 'Unsubscribed') {
          r.status = 'Unsubscribed';
          changed = true;
        }
      });
      if (changed) {
        // Recalculate stats
        let uns = 0;
        camp.recipients.forEach(r => {
          if (r.status === 'Unsubscribed') uns++;
        });
        camp.stats.unsubscribed = uns;
        await camp.save();
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Unsubscribe error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
