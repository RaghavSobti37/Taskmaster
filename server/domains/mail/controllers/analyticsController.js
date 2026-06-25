const MailCampaign = require('../models/MailCampaign');
const MailEvent = require('../models/MailEvent');
const Campaign = require('../models/Campaign');
const { scanBounces, updateEmailTags } = require('../services/mailService');

exports.getStats = async (req, res) => {
  try {
    const mailCampaigns = await MailCampaign.find({}).select('-recipients -content').lean();
    const coreCampaigns = await Campaign.find({}).select('-recipients -content').lean();
    const allCampaigns = [...mailCampaigns, ...coreCampaigns];

    let totalCampaigns = allCampaigns.length;
    let totalSent = 0; let totalOpened = 0; let totalClicked = 0; let totalBounced = 0; let totalUnsubscribed = 0;

    allCampaigns.forEach((camp) => {
      const stats = camp.stats || {};
      const metrics = camp.metrics || {};
      totalSent += metrics.totalSent ?? stats.sent ?? 0;
      totalOpened += metrics.opened ?? stats.opened ?? 0;
      totalClicked += metrics.clicked ?? stats.clicked ?? 0;
      totalBounced += metrics.bounced ?? stats.bounced ?? 0;
    });
    const Contact = require('../../../models/Contact');
    totalUnsubscribed = await Contact.countDocuments({ unsubscribed: true });

    res.json({ totalCampaigns, totalSent, totalBounced, totalOpened, totalClicked, totalUnsubscribed });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.scanBounces = async (req, res) => {
  const { profileId } = req.body;
  try {
    const bounced = await scanBounces(profileId);
    res.json({ success: true, count: bounced.length, emails: bounced });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.trackOpen = async (req, res) => {
  const { campaignId, recipientId } = req.params;
  const { email } = req.query;

  const ipRaw = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  let ip = ipRaw ? ipRaw.split(',')[0].trim() : '';

  if (ip && ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  const geoip = require('geoip-lite');

  let city = 'Unknown City';
  let region = 'Unknown Region';
  let country = 'Unknown Country';

  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.includes('127.0.0.1')) {
    city = 'Mumbai';
    region = 'MH';
    country = 'IN';
  } else {
    const geo = geoip.lookup(ip);
    if (geo) {
      city = geo.city || 'Unknown City';
      region = geo.region || 'Unknown Region';
      country = geo.country || 'Unknown Country';
    }
  }
  const safeCity = city.replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Unknown';
  const location = `${city}, ${region}, ${country}`;

  try {
    await MailEvent.create({
      eventType: 'Open',
      email: email || 'unknown',
      timestamp: new Date(),
      campaignId: campaignId !== 'undefined' ? campaignId : null,
      metadata: { recipientId, ip, location },
    });

    if (campaignId && campaignId !== 'undefined') {
      const updateQuery = { _id: campaignId.match(/^[0-9a-fA-F]{24}$/) ? campaignId : null };

      const setPayload = { [`recipients.$[elem].status`]: 'Opened' };
      const incPayload = { 'metrics.opened': 1, 'stats.opened': 1 };

      const locKey = `locationBreakdown.${safeCity}.opens`;
      incPayload[locKey] = 1;


      const updatedCampaign = await Campaign.findOneAndUpdate(
        { $or: [updateQuery, { campaignId }] },
        {
          $set: setPayload,
          $inc: incPayload,
          $push: { timeSeries: { time: new Date(), opens: 1, clicks: 0 } },
        },
        {
          arrayFilters: [{ 'elem._id': recipientId, 'elem.status': { $nin: ['Opened', 'Clicked'] } }],
        },
      );

      if (!updatedCampaign) {
        await MailCampaign.findOneAndUpdate(
          updateQuery,
          {
            $set: setPayload,
            $inc: { 'stats.opened': 1 },
          },
          {
            arrayFilters: [{ 'elem._id': recipientId, 'elem.status': { $nin: ['Opened', 'Clicked'] } }],
          },
        );
      }
    }

    if (email) {
      await updateEmailTags(email, 'Active', 'Active');
    }
  } catch (err) {
    console.error('Tracking Error:', err);
  }

  const buf = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': buf.length,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  });
  res.end(buf);
};

exports.trackClick = async (req, res) => {
  const { campaignId, recipientId } = req.params;
  const { email, url } = req.query;
  const targetUrl = url && url !== '#' && url !== 'undefined' ? url : 'https://theshakticollective.in';

  const ipRaw = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  let ip = ipRaw ? ipRaw.split(',')[0].trim() : '';

  if (ip && ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  const geoip = require('geoip-lite');

  let city = 'Unknown City';
  let region = 'Unknown Region';
  let country = 'Unknown Country';

  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.includes('127.0.0.1')) {
    city = 'Mumbai';
    region = 'MH';
    country = 'IN';
  } else {
    const geo = geoip.lookup(ip);
    if (geo) {
      city = geo.city || 'Unknown City';
      region = geo.region || 'Unknown Region';
      country = geo.country || 'Unknown Country';
    }
  }
  const safeCity = city.replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Unknown';
  const location = `${city}, ${region}, ${country}`;

  try {
    await MailEvent.create({
      eventType: 'Click',
      email: email || 'unknown',
      timestamp: new Date(),
      campaignId: campaignId !== 'undefined' ? campaignId : null,
      metadata: { recipientId, url: targetUrl, ip, location },
    });

    if (campaignId && campaignId !== 'undefined') {
      const updateQuery = { _id: campaignId.match(/^[0-9a-fA-F]{24}$/) ? campaignId : null };

      const setPayload = { [`recipients.$[elem].status`]: 'Clicked' };
      const incPayload = { 'metrics.clicked': 1, 'stats.clicked': 1 };

      const locKey = `locationBreakdown.${safeCity}.clicks`;
      incPayload[locKey] = 1;


      const updatedCampaign = await Campaign.findOneAndUpdate(
        { $or: [updateQuery, { campaignId }] },
        {
          $set: setPayload,
          $inc: incPayload,
          $push: { timeSeries: { time: new Date(), opens: 0, clicks: 1 } },
        },
        {
          arrayFilters: [{ 'elem._id': recipientId, 'elem.status': { $ne: 'Clicked' } }],
        },
      );

      if (!updatedCampaign) {
        await MailCampaign.findOneAndUpdate(
          updateQuery,
          {
            $set: setPayload,
            $inc: { 'stats.clicked': 1 },
          },
          {
            arrayFilters: [{ 'elem._id': recipientId, 'elem.status': { $ne: 'Clicked' } }],
          },
        );
      }
    }

    if (email) {
      await updateEmailTags(email, 'Active', 'Active');
    }
  } catch (err) {
    console.error('Click Tracking Error:', err);
  }

  res.redirect(targetUrl);
};

exports.redirectUnsubscribe = async (req, res) => {
  const { campaignId, recipientId } = req.params;
  const { email } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  return res.redirect(`${frontendUrl}/unsubscribe?email=${encodeURIComponent(email || '')}&campaignId=${campaignId}&recipientId=${recipientId}`);
};
