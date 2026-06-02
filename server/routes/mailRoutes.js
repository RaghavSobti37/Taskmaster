const express = require('express');
const router = express.Router();
const MailCampaign = require('../models/MailCampaign');
const EmailProfile = require('../models/EmailProfile');
const MailTemplate = require('../models/MailTemplate');
const MailEvent = require('../models/MailEvent');
const Lead = require('../models/Lead');
const { protect, admin } = require('../middleware/authMiddleware');
const { isAdminUser } = require('../utils/departmentPermissions');
const { getDailyLimitForProvider, FREE_ROTATION_PROVIDER_KEYS } = require('../utils/smtpPresets');
const { mergeProviderCredentials } = require('../utils/profileCredentials');
const {
  getTodaySendCountsByProfileProvider,
  syncProviderUsageFromEvents,
  buildProfileUsage,
  nextResetAtUtc,
} = require('../services/profileSendStats');
const { sendCampaign, scanBounces, updateEmailTags } = require('../services/mailService');
const { google } = require('googleapis');

// --- TEMPLATES ---
router.get('/templates', protect, async (req, res) => {
  try {
    const templates = await MailTemplate.find().sort({ createdAt: -1 });
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/templates', protect, async (req, res) => {
  try {
    const { name, content, format } = req.body;
    const payload = {
      content,
      format: format === 'rawHtml' ? 'rawHtml' : 'visual',
    };
    let template = await MailTemplate.findOne({ name });
    if (template) {
      Object.assign(template, payload);
      await template.save();
    } else {
      template = await MailTemplate.create({ name, ...payload, createdBy: req.user._id });
    }
    res.json(template);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/templates/:id', protect, async (req, res) => {
  try {
    await MailTemplate.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- PROFILES ---
router.get('/smtp-usage', protect, async (req, res) => {
  try {
    const filter = isAdminUser(req.user) ? {} : { createdBy: req.user._id };
    await syncProviderUsageFromEvents();
    const todayCounts = await getTodaySendCountsByProfileProvider();
    const profiles = await EmailProfile.find(filter).lean();
    const usage = profiles.flatMap((p) => {
      const u = buildProfileUsage(p, todayCounts);
      if (u.rotation?.providers?.length) {
        return u.rotation.providers.map((prov) => ({
          profileId: p._id,
          profileName: p.name,
          email: p.email,
          providerKey: prov.providerKey,
          label: prov.label,
          smtpHost: prov.smtpHost,
          used: prov.used,
          limit: prov.limit,
          total: prov.total,
          percent: prov.percent,
          resetAt: prov.resetAt,
          resetLabel: u.resetLabel,
        }));
      }
      return [{
        profileId: p._id,
        profileName: p.name,
        email: p.email,
        providerKey: p.providerType || 'custom',
        label: p.providerType || 'custom',
        used: u.used,
        limit: u.limit,
        total: u.total,
        percent: u.percent,
        resetAt: u.resetAt,
        resetLabel: u.resetLabel,
      }];
    });
    res.json(usage);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/profiles', protect, async (req, res) => {
  try {
    const filter = isAdminUser(req.user) ? {} : { createdBy: req.user._id };
    const todayCounts = await getTodaySendCountsByProfileProvider();
    const profiles = await EmailProfile.find(filter).lean();
    const enriched = profiles.map((p) => ({
      ...p,
      rotationProviderCount: FREE_ROTATION_PROVIDER_KEYS.length,
      usage: buildProfileUsage(p, todayCounts),
    }));
    res.json(enriched);
  } catch (err) {
    console.error('Get profiles error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/profiles', protect, async (req, res) => {
  try {
    const data = { ...req.body };
    if (!data.name?.trim() || !data.email?.trim()) {
      return res.status(400).json({ error: 'Profile name and From email are required.' });
    }
    const hasPrimary = data.smtpUser?.trim() && data.smtpPass?.trim();
    const hasExtra = data.providerCredentials && Object.values(data.providerCredentials).some((c) => c?.enabled && c?.smtpPass?.trim());
    if (!hasPrimary && !hasExtra) {
      return res.status(400).json({ error: 'Primary SMTP credentials or at least one additional provider key is required.' });
    }
    if (!hasPrimary) {
      data.smtpUser = data.smtpUser?.trim() || data.email.trim();
      data.smtpPass = data.smtpPass?.trim() || 'unused';
    }
    if (data.rotationEnabled !== false) {
      data.rotationEnabled = true;
      data.providerType = 'rotation';
      data.smtpHost = 'rotation';
      data.smtpPort = 587;
    } else if (data.smtpHost && data.smtpHost.toLowerCase().trim() === 'gmail') {
      data.smtpHost = 'smtp.gmail.com';
      data.smtpPort = 587;
    }
    if (data.providerType && data.providerType !== 'rotation' && !data.dailyLimit) {
      data.dailyLimit = getDailyLimitForProvider(data.providerType);
    }
    if (data.providerCredentials) {
      data.providerCredentials = mergeProviderCredentials(new Map(), data.providerCredentials);
    }
    const profile = await EmailProfile.create({ ...data, createdBy: req.user._id });
    res.json(profile);
  } catch (err) {
    console.error('Create profile error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/profiles/:id', protect, async (req, res) => {
  try {
    const profile = await EmailProfile.findById(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    if (!isAdminUser(req.user) && profile.createdBy?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to delete this profile' });
    }
    await EmailProfile.findByIdAndDelete(req.params.id);
    res.json({ message: 'Profile deleted' });
  } catch (err) {
    console.error('Delete profile error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/profiles/:id', protect, async (req, res) => {
  try {
    const profile = await EmailProfile.findById(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    if (!isAdminUser(req.user) && profile.createdBy?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to edit this profile' });
    }
    const data = { ...req.body };
    if (data.rotationEnabled !== false) {
      data.rotationEnabled = true;
      data.providerType = 'rotation';
      data.smtpHost = 'rotation';
      data.smtpPort = 587;
    } else if (data.smtpHost && data.smtpHost.toLowerCase().trim() === 'gmail') {
      data.smtpHost = 'smtp.gmail.com';
      data.smtpPort = 587;
    }
    if (data.providerType && data.providerType !== 'rotation' && !data.dailyLimit) {
      data.dailyLimit = getDailyLimitForProvider(data.providerType);
    }
    if (!data.smtpPass) delete data.smtpPass;
    if (data.providerCredentials) {
      profile.providerCredentials = mergeProviderCredentials(profile.providerCredentials, data.providerCredentials);
      profile.markModified('providerCredentials');
      delete data.providerCredentials;
    }
    Object.assign(profile, data);
    await profile.save();
    res.json(profile);
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- CAMPAIGNS ---
router.get('/campaigns', protect, async (req, res) => {
  try {
    const filter = isAdminUser(req.user) ? {} : { createdBy: req.user._id };
    const campaigns = await MailCampaign.find(filter).sort('-createdAt').lean();
    for (const camp of campaigns) {
      let total = camp.recipients?.length || 0;
      let sent = 0, opened = 0, clicked = 0, bounced = 0, unsubscribed = 0, invalid = 0;
      camp.recipients?.forEach(r => {
        if (r.status === 'Sent') sent++;
        if (r.status === 'Opened') { sent++; opened++; }
        if (r.status === 'Clicked') { sent++; opened++; clicked++; }
        if (r.status === 'Bounced' || r.status === 'Failed') bounced++;
        if (r.status === 'Invalid') { bounced++; invalid++; }
        if (r.status === 'Unsubscribed') unsubscribed++;
      });
      camp.stats = { total, sent, opened, clicked, bounced, unsubscribed, invalid };
    }
    res.json(campaigns);
  } catch (err) {
    console.error('Get campaigns error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/campaigns', protect, async (req, res) => {
  try {
    const { leadIds, customRecipients, ...rest } = req.body;
    const mongoose = require('mongoose');
    const validLeadIds = Array.isArray(leadIds) ? leadIds.filter(id => mongoose.Types.ObjectId.isValid(id)) : [];
    const leads = validLeadIds.length ? await Lead.find({ _id: { $in: validLeadIds } }) : [];
    
    const recipients = leads.flatMap(l => {
      const emails = l.email ? l.email.toLowerCase().split(/[,;]/).map(e => e.trim()).filter(Boolean) : [];
      return emails.map(email => ({
        leadId: l._id,
        email: email,
        status: 'Pending'
      }));
    });

    const custom = (Array.isArray(customRecipients) ? customRecipients : []).flatMap(r => {
      const emails = r && r.email ? String(r.email).toLowerCase().split(/[,;]/).map(e => e.trim()).filter(Boolean) : [];
      return emails.map(email => ({
        email: email,
        status: 'Pending'
      }));
    });

    const uniqueEmails = new Set();
    const allRecipients = [...recipients, ...custom].filter(r => {
      if (uniqueEmails.has(r.email)) return false;
      uniqueEmails.add(r.email);
      return true;
    });

    const campaign = await MailCampaign.create({
      ...rest,
      attachments: rest.attachments || [],
      recipients: allRecipients,
      stats: { total: allRecipients.length, sent: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0, invalid: 0 },
      createdBy: req.user._id
    });
    res.json(campaign);
  } catch (err) {
    console.error('Create campaign error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/campaigns/:id/send', protect, async (req, res) => {
  try {
    const campaign = await MailCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    if (!isAdminUser(req.user) && campaign.createdBy?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to send this campaign' });
    }
    sendCampaign(req.params.id); // Run in background
    res.json({ message: 'Campaign dispatch started' });
  } catch (err) {
    console.error('Send campaign error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/test-campaign', protect, async (req, res) => {
  try {
    const {
      subject, content, testEmail, senderProfileId, includeSignature,
      senderMode, senderProfileIds
    } = req.body;

    if (!subject || !content || !testEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const mode = senderMode || 'single';
    if (mode === 'single' && !senderProfileId) {
      return res.status(400).json({ error: 'Select a sender profile, or choose System Resend / System SMTP mode.' });
    }
    if (mode === 'pool' && (!senderProfileIds || senderProfileIds.length === 0)) {
      return res.status(400).json({ error: 'Select at least one profile for pool mode test send.' });
    }

    let html = content;
    let profile = null;

    const profileIdForSig = senderProfileId || senderProfileIds?.[0];
    if (profileIdForSig) {
      profile = await EmailProfile.findById(profileIdForSig);
      if (!profile && mode === 'single') {
        return res.status(404).json({ error: 'Sender profile not found' });
      }
      if (profile && includeSignature !== false && profile.signature) {
        const { appendSignatureIfMissing } = require('../utils/emailSignature');
        html = appendSignatureIfMissing(html, profile.signature);
      }
    }

    if (mode === 'pool' && senderProfileIds?.length) {
      profile = await EmailProfile.findById(senderProfileIds[0]);
    }

    if (mode === 'system_resend' || mode === 'system_smtp') {
      profile = profile || {
        name: mode === 'system_resend' ? 'System Resend' : 'System SMTP',
        email: process.env.SYSTEM_VERIFIED_FROM_EMAIL || process.env.SMTP_USER || 'onboarding@resend.dev',
        smtpHost: '',
        smtpPort: 587,
        smtpUser: '',
        smtpPass: ''
      };
    }

    const mailService = require('../services/mailService');
    await mailService.sendTestEmail({
      to: testEmail,
      subject,
      html,
      profile,
      senderMode: mode
    });

    res.json({ success: true, message: `Test email sent to ${testEmail}` });
  } catch (err) {
    console.error('Test campaign error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/campaigns/:id', protect, async (req, res) => {
  try {
    const campaign = await MailCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    if (!isAdminUser(req.user) && campaign.createdBy?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to delete this campaign' });
    }
    const campaignId = req.params.id;
    await MailCampaign.findByIdAndDelete(campaignId);
    await MailEvent.deleteMany({ campaignId: campaignId });
    res.json({ message: 'Campaign and related tracking data deleted successfully' });
  } catch (err) {
    console.error('Delete campaign error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- EVENTS & ANALYTICS ---
router.get('/stats', protect, async (req, res) => {
  try {
    const Campaign = require('../models/Campaign');
    const filter = isAdminUser(req.user) ? {} : { createdBy: req.user._id };
    const mailCampaigns = await MailCampaign.find(filter).select('-recipients -content').lean();
    const coreCampaigns = await Campaign.find(filter).select('-recipients -content').lean();
    const allCampaigns = [...mailCampaigns, ...coreCampaigns];

    let totalCampaigns = allCampaigns.length;
    let totalSent = 0, totalOpened = 0, totalClicked = 0, totalBounced = 0, totalUnsubscribed = 0;

    allCampaigns.forEach(camp => {
      const stats = camp.stats || {};
      const metrics = camp.metrics || {};
      totalSent += metrics.totalSent ?? stats.sent ?? 0;
      totalOpened += metrics.opened ?? stats.opened ?? 0;
      totalClicked += metrics.clicked ?? stats.clicked ?? 0;
      totalBounced += metrics.bounced ?? stats.bounced ?? 0;
    });
    const Contact = require('../models/Contact');
    totalUnsubscribed = await Contact.countDocuments({ unsubscribed: true });

    res.json({ totalCampaigns, totalSent, totalBounced, totalOpened, totalClicked, totalUnsubscribed });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- BOUNCE SCAN ---
router.post('/scan-bounces', protect, async (req, res) => {
  const { profileId } = req.body;
  try {
    const bounced = await scanBounces(profileId);
    res.json({ success: true, count: bounced.length, emails: bounced });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- EMAIL TRACKING (Public endpoint) ---
router.get('/track/:campaignId/:recipientId', async (req, res) => {
  const { campaignId, recipientId } = req.params;
  const { email } = req.query;

  // Resolve client IP and Geolocation
  const ipRaw = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  let ip = ipRaw ? ipRaw.split(',')[0].trim() : '';

  // Strip ::ffff: prefix if present (IPv4-mapped IPv6 address)
  if (ip && ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  const geoip = require('geoip-lite');
  
  let geo = null;
  let city = 'Unknown City';
  let region = 'Unknown Region';
  let country = 'Unknown Country';

  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.includes('127.0.0.1')) {
    city = 'Mumbai';
    region = 'MH';
    country = 'IN';
  } else {
    geo = geoip.lookup(ip);
    if (geo) {
      city = geo.city || 'Unknown City';
      region = geo.region || 'Unknown Region';
      country = geo.country || 'Unknown Country';
    }
  }
  const safeCity = city.replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Unknown';
  const location = `${city}, ${region}, ${country}`;

  try {
    // 1. Record Open event
    await MailEvent.create({
      eventType: 'Open',
      email: email || 'unknown',
      timestamp: new Date(),
      campaignId: campaignId !== 'undefined' ? campaignId : null,
      metadata: { recipientId, ip, location }
    });

    // 2. Update campaign recipient status and stats Atomically ($inc / $set)
    if (campaignId && campaignId !== 'undefined') {
      const updateQuery = { _id: campaignId.match(/^[0-9a-fA-F]{24}$/) ? campaignId : null };
      
      const setPayload = { [`recipients.$[elem].status`]: 'Opened' };
      const incPayload = { 'metrics.opened': 1, 'stats.opened': 1 };
      
      const locKey = `locationBreakdown.${safeCity}.opens`;
      incPayload[locKey] = 1;

      const Campaign = require('../models/Campaign');
      
      // Update core campaign natively if it's the newer schema
      const updatedCampaign = await Campaign.findOneAndUpdate(
        { $or: [updateQuery, { campaignId }] },
        { 
          $set: setPayload,
          $inc: incPayload,
          $push: { timeSeries: { time: new Date(), opens: 1, clicks: 0 } }
        },
        { 
          arrayFilters: [{ 'elem._id': recipientId, 'elem.status': { $nin: ['Opened', 'Clicked'] } }] 
        }
      );

      // Fallback for MailCampaign if not found in Campaign
      if (!updatedCampaign) {
        await MailCampaign.findOneAndUpdate(
          updateQuery,
          { 
            $set: setPayload,
            $inc: { 'stats.opened': 1 }
          },
          { 
            arrayFilters: [{ 'elem._id': recipientId, 'elem.status': { $nin: ['Opened', 'Clicked'] } }]
          }
        );
      }
    }

    // 3. Update master Lead & Tsc data
    if (email) {
      await updateEmailTags(email, 'Active', 'Active');
    }
  } catch (err) {
    console.error('Tracking Error:', err);
  }

  // Send 1x1 transparent GIF
  const buf = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': buf.length,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.end(buf);
});

// --- CLICK TRACKING (Public endpoint) ---
router.get('/click/:campaignId/:recipientId', async (req, res) => {
  const { campaignId, recipientId } = req.params;
  const { email, url } = req.query;
  const targetUrl = url && url !== '#' && url !== 'undefined' ? url : 'https://theshakticollective.in';

  // Resolve client IP and Geolocation
  const ipRaw = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  let ip = ipRaw ? ipRaw.split(',')[0].trim() : '';

  // Strip ::ffff: prefix if present (IPv4-mapped IPv6 address)
  if (ip && ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  const geoip = require('geoip-lite');
  
  let geo = null;
  let city = 'Unknown City';
  let region = 'Unknown Region';
  let country = 'Unknown Country';

  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.includes('127.0.0.1')) {
    city = 'Mumbai';
    region = 'MH';
    country = 'IN';
  } else {
    geo = geoip.lookup(ip);
    if (geo) {
      city = geo.city || 'Unknown City';
      region = geo.region || 'Unknown Region';
      country = geo.country || 'Unknown Country';
    }
  }
  const safeCity = city.replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Unknown';
  const location = `${city}, ${region}, ${country}`;

  try {
    // 1. Record Click event
    await MailEvent.create({
      eventType: 'Click',
      email: email || 'unknown',
      timestamp: new Date(),
      campaignId: campaignId !== 'undefined' ? campaignId : null,
      metadata: { recipientId, url: targetUrl, ip, location }
    });


    // 2. Update campaign recipient status and stats Atomically ($inc / $set)
    if (campaignId && campaignId !== 'undefined') {
      const updateQuery = { _id: campaignId.match(/^[0-9a-fA-F]{24}$/) ? campaignId : null };
      
      const setPayload = { [`recipients.$[elem].status`]: 'Clicked' };
      const incPayload = { 'metrics.clicked': 1, 'stats.clicked': 1 };
      
      const locKey = `locationBreakdown.${safeCity}.clicks`;
      incPayload[locKey] = 1;

      const Campaign = require('../models/Campaign');
      
      const updatedCampaign = await Campaign.findOneAndUpdate(
        { $or: [updateQuery, { campaignId }] },
        { 
          $set: setPayload,
          $inc: incPayload,
          $push: { timeSeries: { time: new Date(), opens: 0, clicks: 1 } }
        },
        { 
          arrayFilters: [{ 'elem._id': recipientId, 'elem.status': { $ne: 'Clicked' } }] 
        }
      );

      // Fallback for MailCampaign
      if (!updatedCampaign) {
        await MailCampaign.findOneAndUpdate(
          updateQuery,
          { 
            $set: setPayload,
            $inc: { 'stats.clicked': 1 }
          },
          { 
            arrayFilters: [{ 'elem._id': recipientId, 'elem.status': { $ne: 'Clicked' } }]
          }
        );
      }
    }

    // 3. Update master Lead & Tsc data
    if (email) {
      await updateEmailTags(email, 'Active', 'Active');
    }
  } catch (err) {
    console.error('Click Tracking Error:', err);
  }

  res.redirect(targetUrl);
});

// --- UNSUBSCRIBE (Public endpoint) ---
router.get('/unsubscribe/:campaignId/:recipientId', async (req, res) => {
  const { campaignId, recipientId } = req.params;
  const { email } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  return res.redirect(`${frontendUrl}/unsubscribe?email=${encodeURIComponent(email || '')}&campaignId=${campaignId}&recipientId=${recipientId}`);
});

// --- LOCAL EMAIL TEMPLATES MANAGEMENT ---
const fs = require('fs');
const path = require('path');
const TEMPLATE_DIR = process.env.TEMPLATE_DIR || path.join(__dirname, '..', 'templates');

// Ensure template directory exists
if (!fs.existsSync(TEMPLATE_DIR)) {
  try {
    fs.mkdirSync(TEMPLATE_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create local template directory:', err);
  }
}

// Pre-populate default templates if empty (copy from bundled server/templates)
const BUNDLED_TEMPLATE_DIR = path.join(__dirname, '..', 'templates');

const seedDefaultTemplates = () => {
  if (!fs.existsSync(TEMPLATE_DIR)) return;
  try {
    const files = fs.readdirSync(TEMPLATE_DIR);
    if (files.length > 0) return;
  } catch (e) {
    return;
  }

  const templateNames = ['marketing.html', 'session-reminder.html', 'newsletter.html'];
  try {
    for (const name of templateNames) {
      const src = path.join(BUNDLED_TEMPLATE_DIR, name);
      if (!fs.existsSync(src)) continue;
      fs.copyFileSync(src, path.join(TEMPLATE_DIR, name));
    }
  } catch (e) {
    console.error('Failed to seed templates:', e);
  }
};

seedDefaultTemplates();

// GET /api/mail/templates
router.get('/templates', protect, async (req, res) => {
  try {
    if (!fs.existsSync(TEMPLATE_DIR)) {
      return res.json([]);
    }
    const files = fs.readdirSync(TEMPLATE_DIR);
    const templates = [];

    files.forEach(file => {
      if (file.endsWith('.html') || file.endsWith('.txt')) {
        const filePath = path.join(TEMPLATE_DIR, file);
        const content = fs.readFileSync(filePath, 'utf8');
        templates.push({
          name: file,
          path: filePath,
          content,
          type: file.endsWith('.html') ? 'html' : 'text'
        });
      }
    });

    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/mail/templates
router.post('/templates', protect, async (req, res) => {
  const { name, content } = req.body;
  if (!name || !content) {
    return res.status(400).json({ error: 'Name and content are required' });
  }
  const safeName = path.basename(name).replace(/\.[^/.]+$/, "") + ".html";
  try {
    const filePath = path.join(TEMPLATE_DIR, safeName);
    fs.writeFileSync(filePath, content, 'utf8');
    res.json({ success: true, name: safeName, filePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/mail/templates/:name
router.delete('/templates/:name', protect, async (req, res) => {
  const safeName = path.basename(req.params.name);
  try {
    const filePath = path.join(TEMPLATE_DIR, safeName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true, message: `Template ${safeName} deleted.` });
    } else {
      res.status(404).json({ error: 'Template not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- HOLYSHEET BULK FETCH ---
router.get('/holysheet/all', protect, admin, async (req, res) => {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL.trim(),
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = '1AvRDNpmSJqQJ9Hom7kQttr0IPNnid9iut3H6XSsWQY8';
    
    // First, get all tab names
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const tabNames = meta.data.sheets.map(s => s.properties.title);
    
    // Then fetch data for all tabs in parallel using batchGet
    const batch = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: tabNames.map(t => `'${t}'!A:Z`)
    });
    
    const results = [];
    batch.data.valueRanges.forEach((rangeData, i) => {
      const tabName = tabNames[i];
      const rows = rangeData.values || [];
      if (rows.length < 2) return;
      const headers = rows[0].map(h => String(h).toLowerCase().trim());
      const emailIdx = headers.findIndex(h => h.includes('email'));
      if (emailIdx === -1) return;
      
      let nameIdx = headers.findIndex(h => h === 'name' || h.includes('first name'));
      
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row) continue;
        const email = row[emailIdx];
        if (email && email.includes('@')) {
          results.push({
            name: nameIdx !== -1 ? (row[nameIdx] || '') : '',
            email: email.trim(),
            source: tabName
          });
        }
      }
    });
    
    res.json(results);
  } catch (err) {
    console.error('Fetch HolySheet all error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

