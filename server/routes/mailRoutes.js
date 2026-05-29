const express = require('express');
const router = express.Router();
const MailCampaign = require('../models/MailCampaign');
const EmailProfile = require('../models/EmailProfile');
const MailTemplate = require('../models/MailTemplate');
const MailEvent = require('../models/MailEvent');
const Lead = require('../models/Lead');
const { protect, admin } = require('../middleware/authMiddleware');
const { isAdminUser } = require('../utils/departmentPermissions');
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
    const { name, content } = req.body;
    let template = await MailTemplate.findOne({ name });
    if (template) {
      template.content = content;
      await template.save();
    } else {
      template = await MailTemplate.create({ name, content, createdBy: req.user._id });
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
router.get('/profiles', protect, async (req, res) => {
  try {
    const filter = isAdminUser(req.user) ? {} : { createdBy: req.user._id };
    const profiles = await EmailProfile.find(filter).lean();
    res.json(profiles);
  } catch (err) {
    console.error('Get profiles error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/profiles', protect, async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.smtpHost && data.smtpHost.toLowerCase().trim() === 'gmail') {
      data.smtpHost = 'smtp.gmail.com';
      data.smtpPort = 587;
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
    if (data.smtpHost && data.smtpHost.toLowerCase().trim() === 'gmail') {
      data.smtpHost = 'smtp.gmail.com';
      data.smtpPort = 587;
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
    const { subject, content, testEmail, senderProfileId } = req.body;
    
    if (!subject || !content || !testEmail || !senderProfileId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const profile = await EmailProfile.findById(senderProfileId);
    if (!profile) return res.status(404).json({ error: 'Sender profile not found' });

    const mailService = require('../services/mailService');
    await mailService.sendTestEmail({
      to: testEmail,
      subject,
      html: content,
      profile: {
        email: profile.email,
        smtpHost: profile.smtpHost,
        smtpPort: profile.smtpPort,
        smtpUser: profile.smtpUser,
        smtpPass: profile.smtpPass
      }
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
    const mailCampaigns = await MailCampaign.find(filter).lean();
    const coreCampaigns = await Campaign.find(filter).lean();
    const allCampaigns = [...mailCampaigns, ...coreCampaigns];

    let totalCampaigns = allCampaigns.length;
    let totalSent = 0, totalOpened = 0, totalClicked = 0, totalBounced = 0, totalUnsubscribed = 0;

    allCampaigns.forEach(camp => {
      camp.recipients?.forEach(r => {
        if (['Sent', 'Opened', 'Clicked', 'Unsubscribed'].includes(r.status)) totalSent++;
        if (['Opened', 'Clicked'].includes(r.status)) totalOpened++;
        if (r.status === 'Clicked') totalClicked++;
        if (['Bounced', 'Failed', 'Invalid'].includes(r.status)) totalBounced++;
      });
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

// Pre-populate default templates if empty
const seedDefaultTemplates = () => {
  if (!fs.existsSync(TEMPLATE_DIR)) return;
  try {
    const files = fs.readdirSync(TEMPLATE_DIR);
    if (files.length > 0) return;
  } catch(e) {
    return;
  }

  const marketingHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Exclusive Announcement</title>
</head>
<body style="margin:0;padding:0;background-color:#0b0f19;color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#0b0f19;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#111827;border:1px solid #1f2937;border-radius:24px;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
          <!-- Banner -->
          <tr>
            <td>
              <img src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&h=250&q=80" alt="Banner" style="width:100%;height:auto;display:block;border-bottom:1px solid #1f2937;" />
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 32px;">
              <h2 style="font-size:24px;font-weight:800;color:#38bdf8;margin:0 0 16px 0;text-transform:uppercase;letter-spacing:1px;">Unlocking New Possibilities</h2>
              <p style="font-size:15px;line-height:1.6;color:#cbd5e1;margin:0 0 24px 0;">Hello {{name}},</p>
              <p style="font-size:15px;line-height:1.6;color:#cbd5e1;margin:0 0 24px 0;">We are thrilled to bring you our latest updates. We have optimized our pipeline to deliver maximum performance and reliability. Join us to explore how these features can accelerate your workflow.</p>
              <!-- CTA -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:32px 0;">
                <tr>
                  <td align="center">
                    <a href="{{cta_url}}" style="display:inline-block;background:linear-gradient(135deg,#0284c7 0%,#0369a1 100%);color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:16px 36px;border-radius:12px;text-transform:uppercase;letter-spacing:1px;box-shadow:0 10px 15px -3px rgba(2,132,199,0.3);">Explore Features</a>
                  </td>
                </tr>
              </table>
              <p style="font-size:14px;line-height:1.6;color:#94a3b8;margin:0;text-align:center;">Have questions? Reply directly to this email or visit our Help Center.</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="background-color:#0f172a;padding:24px;font-size:11px;color:#64748b;border-top:1px solid #1f2937;">
              <p style="margin:0 0 8px 0;">You are receiving this because you subscribed to our updates.</p>
              <p style="margin:0;"><a href="{{unsubscribe_url}}" style="color:#38bdf8;text-decoration:none;">Unsubscribe</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const reminderHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Session Reminder</title>
</head>
<body style="margin:0;padding:0;background-color:#0b0f19;color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#0b0f19;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#111827;border:1px solid #1f2937;border-radius:24px;padding:40px 32px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
          <tr>
            <td align="center" style="padding-bottom:24px;border-bottom:1px solid #1f2937;">
              <h2 style="font-size:20px;font-weight:800;color:#38bdf8;margin:0 0 4px 0;text-transform:uppercase;">The Shakti Collective</h2>
              <p style="font-size:12px;color:#94a3b8;margin:0;text-transform:uppercase;letter-spacing:2px;">Session Reminder</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 0;font-size:15px;line-height:1.6;color:#cbd5e1;">
              <p style="margin:0 0 16px 0;">Hello {{name}},</p>
              <p style="margin:0 0 24px 0;">This is a friendly reminder for your upcoming scheduled collective session. Please find the alignment details below:</p>
              <div style="background-color:#1e293b;border-left:4px solid #38bdf8;padding:16px 20px;border-radius:10px;margin-bottom:24px;">
                <p style="margin:0 0 4px 0;font-size:16px;font-weight:700;color:#f8fafc;">Acoustic Alignment Session</p>
                <p style="margin:0 0 2px 0;font-size:13px;color:#cbd5e1;"><strong>Date:</strong> Tomorrow</p>
                <p style="margin:0;font-size:13px;color:#cbd5e1;"><strong>Time:</strong> 4:00 PM IST</p>
              </div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <a href="{{cta_url}}" style="display:inline-block;background:#0284c7;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;text-transform:uppercase;letter-spacing:1px;">Confirm Attendance</a>
            </td>
          </tr>
          <tr>
            <td align="center" style="border-top:1px solid #1f2937;padding-top:20px;font-size:11px;color:#64748b;">
              <p style="margin:0;">The Shakti Collective • <a href="{{unsubscribe_url}}" style="color:#38bdf8;text-decoration:none;">Unsubscribe</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const newsletterHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Monthly Newsletter</title>
</head>
<body style="margin:0;padding:0;background-color:#0b0f19;color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#0b0f19;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#111827;border:1px solid #1f2937;border-radius:24px;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
          <!-- Header -->
          <td align="center" style="background-color:#1e293b;padding:32px 24px;border-bottom:1px solid #1f2937;">
            <h1 style="font-size:24px;font-weight:800;color:#38bdf8;margin:0;text-transform:uppercase;letter-spacing:3px;">SHAKTI DIGEST</h1>
            <p style="font-size:11px;color:#94a3b8;margin:6px 0 0 0;text-transform:uppercase;letter-spacing:4px;">Monthly Newsletter & updates</p>
          </td>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="font-size:14px;color:#94a3b8;margin:0 0 8px 0;font-weight:bold;text-transform:uppercase;">Update for {{name}}</p>
              <h2 style="font-size:20px;font-weight:700;color:#f8fafc;margin:0 0 16px 0;">This Month at the Collective</h2>
              <p style="font-size:15px;line-height:1.6;color:#cbd5e1;margin:0 0 20px 0;">Welcome to this month's digest. We have been working hard to push boundary lines in music production, artist routing networks, and performance optimization. Here is a summary of what's new:</p>
              
              <h3 style="font-size:16px;color:#38bdf8;margin:24px 0 8px 0;font-weight:bold;">1. Advanced routing pipelines</h3>
              <p style="font-size:14px;line-height:1.6;color:#cbd5e1;margin:0 0 16px 0;">Sales rep assignment metrics are now protected under isolated MongoDB transactions to eliminate duplicate allocations.</p>

              <h3 style="font-size:16px;color:#38bdf8;margin:24px 0 8px 0;font-weight:bold;">2. Dynamic geolocation metrics</h3>
              <p style="font-size:14px;line-height:1.6;color:#cbd5e1;margin:0 0 24px 0;">We now track exact client locations on email open and click events to provide complete geographical breakdown analytics.</p>
              
              <!-- CTA -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:24px 0;">
                <tr>
                  <td align="center">
                    <a href="{{cta_url}}" style="display:inline-block;background:#0284c7;color:#ffffff;font-size:13px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:8px;text-transform:uppercase;">Read Full Blog</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="background-color:#0f172a;padding:20px;font-size:11px;color:#64748b;border-top:1px solid #1f2937;">
              <p style="margin:0 0 6px 0;">The Shakti Collective • indigenously rooted music</p>
              <p style="margin:0;"><a href="{{unsubscribe_url}}" style="color:#38bdf8;text-decoration:none;">Unsubscribe</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    fs.writeFileSync(path.join(TEMPLATE_DIR, 'marketing.html'), marketingHTML, 'utf8');
    fs.writeFileSync(path.join(TEMPLATE_DIR, 'session-reminder.html'), reminderHTML, 'utf8');
    fs.writeFileSync(path.join(TEMPLATE_DIR, 'newsletter.html'), newsletterHTML, 'utf8');
  } catch(e) {
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
router.get('/holysheet/all', protect, async (req, res) => {
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

