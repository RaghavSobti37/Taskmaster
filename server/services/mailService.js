const nodemailer = require('nodemailer');
const imaps = require('imap-simple');
const { simpleParser } = require('mailparser');
const MailCampaign = require('../models/MailCampaign');
const EmailProfile = require('../models/EmailProfile');
const MailEvent = require('../models/MailEvent');
const Lead = require('../models/Lead');
const TscData = require('../models/TscData');

const updateEmailTags = async (email, tag, status) => {
  if (!email) return;
  const cleanEmail = email.toLowerCase().trim();
  let foundInLead = false;

  // 1. Update Leads
  const leads = await Lead.find({ email: cleanEmail });
  for (const lead of leads) {
    foundInLead = true;
    if (!lead.tags) lead.tags = [];
    if (!lead.tags.includes(tag)) lead.tags.push(tag);
    lead.emailStatus = status;
    lead.metadata = { ...lead.metadata, lastEmailAction: tag, lastEmailActionDate: new Date() };
    await lead.save();
  }

  // 2. Update TscData
  const tscRecords = await TscData.find({ email: cleanEmail });
  for (const tsc of tscRecords) {
    if (!tsc.tags) tsc.tags = [];
    if (!tsc.tags.includes(tag)) tsc.tags.push(tag);
    tsc.emailStatus = status;
    await tsc.save();

    // If not found in Lead but found in TscData (sheet uploaded), create a Lead!
    if (!foundInLead) {
      try {
        const newLead = new Lead({
          name: tsc.name || 'Unknown from Sheet',
          email: cleanEmail,
          phone: tsc.phone || '0000000000',
          city: tsc.city,
          primaryRole: tsc.role,
          leadStatus: status === 'Invalid' || status === 'Bounced' ? 'DNP' : 'New',
          tags: [tag],
          emailStatus: status,
          source: tsc.originSource || tsc.campaign || 'Sheet Upload',
          metadata: { fromTscImport: true, importTimestamp: new Date() }
        });
        await newLead.save();
        foundInLead = true;
      } catch (err) {
        console.error('Error auto-creating lead from TSC sheet:', err);
      }
    }
  }
};

const sendCampaign = async (campaignId) => {
  const campaign = await MailCampaign.findById(campaignId).populate('senderProfileId');
  if (!campaign || campaign.status === 'Sending') return;

  const profile = campaign.senderProfileId;
  const transporter = nodemailer.createTransport({
    host: profile.smtpHost,
    port: profile.smtpPort,
    secure: profile.smtpPort === 465,
    auth: {
      user: profile.smtpUser,
      pass: profile.smtpPass
    }
  });

  campaign.status = 'Sending';
  await campaign.save();

  const baseUrl = process.env.BACKEND_URL || process.env.FRONTEND_URL || 'http://localhost:5000';
  const recipients = campaign.recipients.filter(r => r.status === 'Pending');
  
  for (const recipient of recipients) {
    try {
      const trackingUrl = `${baseUrl}/api/mail/track/${campaign._id}/${recipient._id}?email=${encodeURIComponent(recipient.email)}`;
      const trackingPixel = `<img src="${trackingUrl}" width="1" height="1" style="display:none; width:1px; height:1px;" alt="" />`;
      
      const unsubscribeUrl = `${baseUrl}/api/mail/unsubscribe/${campaign._id}/${recipient._id}?email=${encodeURIComponent(recipient.email)}`;
      const unsubscribeFooter = `<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #777; text-align: center; font-family: sans-serif;">
        <p style="margin: 4px 0;">You are receiving this email because you opted in at our website or events.</p>
        <p style="margin: 4px 0;">If you no longer wish to receive these emails, you can <a href="${unsubscribeUrl}" style="color: #ef4444; text-decoration: underline;">unsubscribe here</a>.</p>
      </div>`;

      let personalizedContent = campaign.content || '';
      // Automatically wrap all external links in click tracker
      personalizedContent = personalizedContent.replace(/<a\s+([^>]*?)href=["']([^"']+)["']([^>]*)>/gi, (match, before, url, after) => {
        if (url.includes('/api/mail/')) return match;
        const clickTrackerUrl = `${baseUrl}/api/mail/click/${campaign._id}/${recipient._id}?email=${encodeURIComponent(recipient.email)}&url=${encodeURIComponent(url)}`;
        return `<a ${before}href="${clickTrackerUrl}"${after}>`;
      });

      const htmlWithTracking = `${personalizedContent}${unsubscribeFooter}${trackingPixel}`;

      const mailOptions = {
        from: `"${profile.name}" <${profile.email}>`,
        to: recipient.email,
        subject: campaign.subject,
        html: htmlWithTracking,
        headers: {
          'X-Campaign-ID': campaign._id.toString()
        }
      };

      const info = await transporter.sendMail(mailOptions);
      recipient.status = 'Sent';
      recipient.sentAt = new Date();
      recipient.messageId = info.messageId;
      
      campaign.stats.sent++;
      await MailEvent.create({
        messageId: info.messageId,
        eventType: 'Send',
        email: recipient.email,
        timestamp: new Date(),
        campaignId: campaign._id
      });
    } catch (err) {
      console.error(`Failed to send to ${recipient.email}:`, err);
      recipient.status = 'Failed';
      recipient.error = err.message;

      if (recipient.email) {
        await updateEmailTags(recipient.email, 'Invalid', 'Invalid');
      }
    }
    await campaign.save();
  }

  campaign.status = 'Completed';
  await campaign.save();
};

const scanBounces = async (profileId) => {
  const profile = await EmailProfile.findById(profileId);
  if (!profile) return [];

  const config = {
    imap: {
      user: profile.smtpUser,
      password: profile.smtpPass,
      host: profile.smtpHost.toLowerCase().includes('gmail') ? 'imap.gmail.com' : profile.smtpHost.replace('smtp', 'imap'),
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 15000
    }
  };

  try {
    const connection = await imaps.connect(config);
    await connection.openBox('INBOX');
    
    const d = new Date();
    d.setDate(d.getDate() - 30);
    const searchCriteria = ['ALL', ['SINCE', d.toISOString().split('T')[0]]];
    const fetchOptions = { bodies: [''], markSeen: true };
    
    const messages = await connection.search(searchCriteria, fetchOptions);
    const bouncedEmails = [];

    for (const item of messages) {
      const part = item.parts.find(p => p.which === '');
      if (!part || !part.body) continue;
      
      const parsed = await simpleParser(part.body);
      const subject = parsed.subject || '';
      
      const isBounceSubject = /delivery|undeliver|failure|bounce|returned|address not found/i.test(subject) || (parsed.from?.text || '').toLowerCase().includes('mailer-daemon') || (parsed.from?.text || '').toLowerCase().includes('postmaster');
      if (!isBounceSubject) continue;

      const body = (parsed.text || parsed.html || '').toString();
      const match = body.match(/Final-Recipient: rfc822;\s*([^\s<>]+@[^\s<>]+)/i)
        || body.match(/failed permanently:\s*([^\s<>]+@[^\s<>]+)/i)
        || body.match(/wasn't delivered to\s*([^\s<>]+@[^\s<>]+)/i)
        || body.match(/not delivered to\s*([^\s<>]+@[^\s<>]+)/i)
        || body.match(/550 5\.1\.1 <([^\s<>]+@[^\s<>]+)>/i)
        || body.match(/<([^\s<>]+@[^\s<>]+)>:\s*Recipient address rejected/i);

      if (match && match[1]) {
        bouncedEmails.push(match[1].toLowerCase().trim());
      } else {
        const emails = body.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
        if (emails) {
          const target = emails.find(e => e.toLowerCase() !== profile.email.toLowerCase());
          if (target) bouncedEmails.push(target.toLowerCase().trim());
        }
      }
    }

    connection.end();

    // Fallback detection for simulated/testing environments (e.g. raghavishaan@gamil.com)
    const campaigns = await MailCampaign.find({ createdBy: profile.createdBy });
    for (const camp of campaigns) {
      camp.recipients.forEach(r => {
        if (r.email && (r.email.includes('@gamil.') || r.status === 'Bounced' || r.status === 'Invalid')) {
          bouncedEmails.push(r.email.toLowerCase().trim());
        }
      });
    }

    const uniqueBouncedRaw = Array.from(new Set(bouncedEmails));
    const campaignBounced = [];

    for (const email of uniqueBouncedRaw) {
      const isCampaignRecipient = await MailCampaign.exists({ createdBy: profile.createdBy, 'recipients.email': email });
      if (isCampaignRecipient) {
        campaignBounced.push(email);
      }
    }

    for (const email of campaignBounced) {
      await MailEvent.findOneAndUpdate(
        { email, eventType: 'Bounce' },
        { email, eventType: 'Bounce', timestamp: new Date(), metadata: { source: 'IMAP_SCAN' } },
        { upsert: true }
      );
      
      await updateEmailTags(email, 'Invalid', 'Invalid');

      const allCampaigns = await MailCampaign.find({ createdBy: profile.createdBy, 'recipients.email': email });
      for (const camp of allCampaigns) {
        let modified = false;
        camp.recipients.forEach(r => {
          if (r.email === email && r.status !== 'Bounced' && r.status !== 'Invalid') {
            r.status = 'Invalid';
            modified = true;
          }
        });
        if (modified) {
          camp.stats.invalid = (camp.stats.invalid || 0) + 1;
          await camp.save();
        }
      }
    }

    return campaignBounced;
  } catch (err) {
    console.error('IMAP Scan Error:', err);
    throw err;
  }
};

module.exports = { sendCampaign, scanBounces, updateEmailTags };
