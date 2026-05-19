const Campaign = require('../models/Campaign');
const MailCampaign = require('../models/MailCampaign');
const Lead = require('../models/Lead');

exports.getCumulativeMetrics = async (req, res) => {
  try {
    const userId = req.user._id;
    const coreCamps = await Campaign.find({ createdBy: userId }).lean();
    const mailCamps = await MailCampaign.find({ createdBy: userId }).lean();
    const allCamps = [...coreCamps, ...mailCamps];

    const tagMap = {};
    for (const c of allCamps) {
      const tag = c.eventTag || 'General';
      if (!tagMap[tag]) {
        tagMap[tag] = { eventTag: tag, totalSent: 0, totalOpens: 0, totalClicks: 0 };
      }
      const sent = c.metrics?.totalSent || c.stats?.sent || 0;
      const opened = c.metrics?.opened || c.stats?.opened || 0;
      const clicked = c.metrics?.clicked || c.stats?.clicked || 0;

      tagMap[tag].totalSent += sent;
      tagMap[tag].totalOpens += opened;
      tagMap[tag].totalClicks += clicked;
    }

    const aggregateData = Object.values(tagMap).map(item => {
      const openRate = item.totalSent > 0 ? Math.round((item.totalOpens / item.totalSent) * 100) : (item.totalOpens > 0 ? 100 : 0);
      const ctr = item.totalSent > 0 ? Math.round((item.totalClicks / item.totalSent) * 100) : (item.totalClicks > 0 ? 100 : 0);
      return { ...item, openRate, ctr };
    }).sort((a, b) => b.totalSent - a.totalSent);

    const MailEvent = require('../models/MailEvent');
    const camps = await MailCampaign.find({}, 'recipients.email recipients.status').lean();
    const engagedEmailsSet = new Set();
    camps.forEach(c => {
      c.recipients?.forEach(r => {
        if (r.status === 'Opened' || r.status === 'Clicked' || r.status === 'Sent') {
          if (r.email) engagedEmailsSet.add(r.email.toLowerCase().trim());
        }
      });
    });

    const events = await MailEvent.find({ eventType: { $in: ['Open', 'Click', 'Send'] } }, 'email').lean();
    events.forEach(e => {
      if (e.email) engagedEmailsSet.add(e.email.toLowerCase().trim());
    });

    const engagedEmails = Array.from(engagedEmailsSet);
    const matchQuery = engagedEmails.length > 0 
      ? { email: { $in: engagedEmails } }
      : { emailStatus: 'Active' };

    const engagedLeads = await Lead.find(matchQuery, 'location city').lean();
    const locMap = {};
    for (const l of engagedLeads) {
      let rawLoc = l.location || l.city || 'unknown';
      let loc = rawLoc.toLowerCase().replace(/[().,]/g, '').replace(/\s+/g, ' ').trim();
      if (!locMap[loc]) locMap[loc] = 0;
      locMap[loc]++;
    }

    const dynamicBreakdown = Object.entries(locMap).map(([location, count]) => ({
      location: location.charAt(0).toUpperCase() + location.slice(1),
      count
    })).sort((a, b) => b.count - a.count);

    res.status(200).json({ aggregateData, dynamicBreakdown });
  } catch (error) {
    console.error('Cumulative metrics error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getLocationLeads = async (req, res) => {
  try {
    const { location } = req.query;
    if (!location) return res.status(400).json({ error: 'Location query parameter required' });

    const userId = req.user._id;
    const Campaign = require('../models/Campaign');
    const MailCampaign = require('../models/MailCampaign');
    const MailEvent = require('../models/MailEvent');

    const coreCamps = await Campaign.find({ createdBy: userId }).lean();
    const mailCamps = await MailCampaign.find({ createdBy: userId }).lean();
    const allCamps = [...coreCamps, ...mailCamps];

    const engagedEmailsSet = new Set();
    allCamps.forEach(c => {
      c.recipients?.forEach(r => {
        if (r.status === 'Opened' || r.status === 'Clicked' || r.status === 'Sent') {
          if (r.email) engagedEmailsSet.add(r.email.toLowerCase().trim());
        }
      });
    });

    const events = await MailEvent.find({ eventType: { $in: ['Open', 'Click', 'Send'] } }, 'email').lean();
    events.forEach(e => {
      if (e.email) engagedEmailsSet.add(e.email.toLowerCase().trim());
    });

    const engagedEmails = Array.from(engagedEmailsSet);
    const matchQuery = engagedEmails.length > 0 
      ? { email: { $in: engagedEmails } }
      : { emailStatus: 'Active' };

    const engagedLeads = await Lead.find(matchQuery).lean();
    
    // Filter matching location
    const matchedLeads = engagedLeads.filter(l => {
      let rawLoc = l.location || l.city || 'unknown';
      let loc = rawLoc.toLowerCase().replace(/[().,]/g, '').replace(/\s+/g, ' ').trim();
      return loc === location.toLowerCase().trim();
    });

    res.status(200).json(matchedLeads);
  } catch (error) {
    console.error('Get location leads error:', error);
    res.status(500).json({ error: error.message });
  }
};

