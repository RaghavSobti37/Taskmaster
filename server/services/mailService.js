const nodemailer = require('nodemailer');
const imaps = require('imap-simple');
const { simpleParser } = require('mailparser');
const { Resend } = require('resend');
const juice = require('juice');
const MailCampaign = require('../models/MailCampaign');
const EmailProfile = require('../models/EmailProfile');
const MailEvent = require('../models/MailEvent');
const Lead = require('../models/Lead');
const TscData = require('../models/TscData');
const logger = require('../utils/logger');

const resendApiKey = process.env.RESEND_API_KEY;
const globalResend = resendApiKey && resendApiKey !== 'mock_resend_api_key' ? new Resend(resendApiKey) : null;

const Redis = require('ioredis');
const redisOptions = {
  maxRetriesPerRequest: 1,
  retryStrategy(times) {
    if (times > 3) return null; // Stop retrying after 3 attempts
    return Math.min(times * 100, 2000);
  }
};
const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL, redisOptions) : new Redis(redisOptions);
redis.on('error', (err) => {
  // Suppress connection errors to prevent log flooding
});

const updateEmailTags = async (email, tag, status) => {
  if (!email) return;
  const cleanEmail = email.toLowerCase().trim();
  let foundInLead = false;

  // 0. Update Unified Contacts
  const Contact = require('../models/Contact');
  const contacts = await Contact.find({ email: cleanEmail });
  for (const contact of contacts) {
    contact.emailStatus = status;
    if (status === 'Unsubscribed') contact.unsubscribed = true;
    if (status === 'Active') contact.inMailer = true;
    if (status === 'Invalid' || status === 'Bounced') contact.bounceCount = (contact.bounceCount || 0) + 1;
    await contact.save();
  }

  // 0.5. Update Exly Bookings
  const ExlyBooking = require('../models/ExlyBooking');
  const exlyBookings = await ExlyBooking.find({ email: cleanEmail });
  for (const booking of exlyBookings) {
    booking.emailStatus = status;
    if (status === 'Unsubscribed') booking.unsubscribed = true;
    if (status === 'Invalid' || status === 'Bounced') booking.bounceCount = (booking.bounceCount || 0) + 1;
    await booking.save();
  }

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
      // DISABLED: User requested to stop adding auto mailer entries into leads directly
      /*
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
        logger.error('Mail Service', 'Error auto-creating lead from TSC sheet', { error: err.message });
      }
      */
    }
  }
};

const sendCampaign = async (campaignId) => {
  const campaign = await MailCampaign.findById(campaignId).populate('senderProfileId');
  if (!campaign || campaign.status === 'Sending') return;

  const profile = campaign.senderProfileId;
  const useResend = globalResend || (profile && profile.resendApiKey && profile.resendApiKey !== 'mock_resend_api_key');
  const campaignResend = profile && profile.resendApiKey ? new Resend(profile.resendApiKey) : globalResend;

  let transporter = null;
  if (!useResend && profile) {
    transporter = nodemailer.createTransport({
      host: profile.smtpHost,
      port: profile.smtpPort,
      secure: profile.smtpPort === 465,
      auth: {
        user: profile.smtpUser,
        pass: profile.smtpPass
      },
      tls: { rejectUnauthorized: false }
    });
  }

  campaign.status = 'Sending';
  await campaign.save();

  let baseUrl = process.env.APP_BASE_URL || 'https://tsccoreknot.com';
  if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
    baseUrl = 'https://tsccoreknot.com';
  }
  let recipients = campaign.recipients.filter(r => r.status === 'Pending');
  
  // Split any compound emails and deduplicate explicit target list before loop
  const seenEmails = new Set();
  const splitRecipients = [];
  
  recipients.forEach(r => {
    if (!r.email) return;
    const splitEmailsArr = r.email.split(/[,;]/).map(e => e.trim()).filter(Boolean);
    splitEmailsArr.forEach(email => {
      const cleanEmail = email.toLowerCase();
      if (!seenEmails.has(cleanEmail)) {
        seenEmails.add(cleanEmail);
        // Create a new recipient object for each split email, retaining original properties
        splitRecipients.push({ ...r.toObject ? r.toObject() : r, email: cleanEmail, _id: r._id });
      }
    });
  });
  recipients = splitRecipients;

  for (const recipient of recipients) {
    try {
      // Check if lead is unsubscribed
      const leadDoc = await Lead.findOne({ email: recipient.email.toLowerCase().trim() });
      if (leadDoc && (leadDoc.unsubscribed === true || leadDoc.emailStatus === 'Unsubscribed')) {
        logger.info('Campaign Dispatch', `Skipping unsubscribed recipient: ${recipient.email}`);
        recipient.status = 'Unsubscribed';
        recipient.error = 'User Unsubscribed';
        campaign.stats.unsubscribed = (campaign.stats.unsubscribed || 0) + 1;
        await campaign.save();
        continue;
      }

      // Atomic Redis Idempotency Lock
      try {
        if (redis.status === 'ready' || redis.status === 'connecting') {
          const lockKey = `lock:campaign:${campaign._id}:${recipient.email.toLowerCase().trim()}`;
          const acquired = await redis.set(lockKey, 'locked', 'NX', 'EX', 10);
          if (!acquired) {
            logger.info('Idempotency', `Duplicate request blocked for ${recipient.email}. Skipping double-send.`);
            continue;
          }
        }
      } catch (redisErr) {
        // Fallback or ignore if Redis is completely down
      }


      const trackingUrl = `${baseUrl}/api/mail/track/${campaign._id}/${recipient._id}?email=${encodeURIComponent(recipient.email)}`;
      const trackingPixel = `<img src="${trackingUrl}" width="1" height="1" style="display:none; width:1px; height:1px;" alt="" />`;
      
      const crypto = require('crypto');
      const token = crypto.createHmac('sha256', process.env.JWT_SECRET || 'fallback_secret')
        .update(recipient.email.toLowerCase().trim())
        .digest('hex');
      const unsubscribeUrl = `${baseUrl}/api/mail/unsubscribe/${campaign._id}/${recipient._id}?email=${encodeURIComponent(recipient.email)}&token=${token}`;
      const unsubscribeFooter = `<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #777; text-align: center; font-family: sans-serif;">
        <p style="margin: 4px 0;">You are receiving this email because you opted in at our website or events.</p>
        <p style="margin: 4px 0;">If you no longer wish to receive these emails, you can <a href="${unsubscribeUrl}" style="color: #ef4444; text-decoration: underline;">unsubscribe here</a>.</p>
      </div>`;

      let personalizedContent = campaign.content || '';
      
      // Preserve line breaks for plain text input
      if (!/<(br|p|div|h[1-6])[^>]*>/i.test(personalizedContent)) {
        personalizedContent = personalizedContent.replace(/\n/g, '<br />');
      }

      // Inline CSS styles for email client compatibility
      try {
        personalizedContent = juice(personalizedContent);
      } catch (inlineErr) {
        logger.warn('CSS Inlining', 'Failed to inline CSS, continuing without inlining', { error: inlineErr.message });
      }

      // Automatically wrap all external links in click tracker
      personalizedContent = personalizedContent.replace(/<a\s+([^>]*?)href=["']([^"']+)["']([^>]*)>/gi, (match, before, url, after) => {
        if (url.includes('/api/mail/')) return match;
        const clickTrackerUrl = `${baseUrl}/api/mail/click/${campaign._id}/${recipient._id}?email=${encodeURIComponent(recipient.email)}&url=${encodeURIComponent(url)}`;
        return `<a ${before}href="${clickTrackerUrl}"${after}>`;
      });

      const finalUnsubscribeFooter = campaign.removeUnsubscribe ? '' : unsubscribeFooter;
      const htmlWithTracking = `${personalizedContent}${finalUnsubscribeFooter}${trackingPixel}`;
      const senderFrom = profile ? `"${profile.name}" <${profile.email}>` : 'onboarding@resend.dev';

      let messageIdStr = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      const formattedAttachments = (campaign.attachments || []).map(att => {
        const base64Data = att.content.split(',')[1] || att.content;
        return {
          filename: att.filename,
          content: useResend ? base64Data : att.content,
          contentType: att.contentType
        };
      });

      if (useResend && campaignResend) {
        const payload = {
          from: senderFrom,
          to: [recipient.email],
          subject: campaign.subject,
          html: htmlWithTracking,
          headers: {
            'X-Campaign-ID': campaign._id.toString()
          },
          tags: [
            { name: 'campaign_id', value: campaign._id.toString() },
            { name: 'recipient_id', value: recipient._id.toString() }
          ]
        };
        if (formattedAttachments.length > 0) {
          payload.attachments = formattedAttachments;
        }

        const response = await campaignResend.emails.send(payload);
        messageIdStr = response?.id || response?.data?.id || messageIdStr;
      } else if (transporter) {
        const mailOptions = {
          from: senderFrom,
          to: recipient.email,
          subject: campaign.subject,
          html: htmlWithTracking,
          headers: {
            'X-Campaign-ID': campaign._id.toString()
          }
        };
        
        if (formattedAttachments.length > 0) {
          mailOptions.attachments = formattedAttachments.map(a => ({
            filename: a.filename,
            content: Buffer.from(a.content.split(',')[1] || a.content, 'base64'),
            contentType: a.contentType
          }));
        }

        const info = await transporter.sendMail(mailOptions);
        messageIdStr = info.messageId;
      } else {
        logger.info('Campaign Simulation', `Email simulated to ${recipient.email} - Subject: ${campaign.subject}`);
      }

      recipient.status = 'Sent';
      recipient.sentAt = new Date();
      recipient.messageId = messageIdStr;
      
      campaign.stats.sent++;
      await MailEvent.create({
        messageId: messageIdStr,
        eventType: 'Send',
        email: recipient.email,
        timestamp: new Date(),
        campaignId: campaign._id
      });
    } catch (err) {
      logger.error('Mail Service', `Failed to send to ${recipient.email}`, { error: err.message });
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
  if (transporter) {
    transporter.close();
  }
};

const scanBounces = async (profileId) => {
  const profile = await EmailProfile.findById(profileId);
  if (!profile) return [];

  // Ensure IMAP/SMTP credentials are present before connecting
  if (!profile.smtpHost || !profile.smtpUser || !profile.smtpPass) {
    logger.info('IMAP Scan', 'Missing SMTP/IMAP credentials. Skipping IMAP polling.');
    return [];
  }


  const getImapHost = (smtpHost) => {
    if (!smtpHost) return '';
    const lower = smtpHost.toLowerCase().trim();
    if (lower.includes('gmail')) return 'imap.gmail.com';
    if (lower.includes('zoho')) return 'imap.zoho.com';
    if (lower.includes('hostinger')) return 'imap.hostinger.com';
    if (lower.includes('outlook') || lower.includes('office365')) return 'outlook.office365.com';
    if (lower.includes('yahoo')) return 'imap.mail.yahoo.com';
    if (lower.includes('secureserver')) return 'imap.secureserver.net';
    
    let host = lower;
    if (host.startsWith('smtp.')) {
      host = host.replace('smtp.', 'imap.');
    } else if (host.startsWith('mail.')) {
      host = host.replace('mail.', 'imap.');
    } else if (host.startsWith('relay.')) {
      host = host.replace('relay.', 'imap.');
    } else if (!host.includes('imap')) {
      host = 'imap.' + host;
    }
    return host;
  };

  const config = {
    imap: {
      user: profile.smtpUser,
      password: profile.smtpPass,
      host: getImapHost(profile.smtpHost),
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 15000
    }
  };

  try {
    const connection = await imaps.connect(config);
    await connection.openBox('INBOX');
    
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const d = new Date();
    d.setDate(d.getDate() - 30);
    const imapDateStr = `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
    const searchCriteria = ['ALL', ['SINCE', imapDateStr]];
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
      
      // Clean HTML tags to make text matches reliable
      const cleanBodyText = body.replace(/<[^>]*>/g, ' ');

      const match = cleanBodyText.match(/Final-Recipient: rfc822;\s*([^\s<>]+@[^\s<>]+)/i)
        || cleanBodyText.match(/failed permanently:\s*([^\s<>]+@[^\s<>]+)/i)
        || cleanBodyText.match(/wasn't delivered to\s*([^\s<>]+@[^\s<>]+)/i)
        || cleanBodyText.match(/not delivered to\s*([^\s<>]+@[^\s<>]+)/i)
        || cleanBodyText.match(/550 5\.1\.1 <([^\s<>]+@[^\s<>]+)>/i)
        || cleanBodyText.match(/<([^\s<>]+@[^\s<>]+)>:\s*Recipient address rejected/i);

      if (match && match[1]) {
        bouncedEmails.push(match[1].toLowerCase().trim());
      } else {
        const emails = cleanBodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
        if (emails) {
          const systemPattern = /mailer-daemon|postmaster|googlemail|smtp|noreply|no-reply/i;
          for (const email of emails) {
            const clean = email.toLowerCase().trim();
            if (clean !== profile.email.toLowerCase() && !systemPattern.test(clean)) {
              bouncedEmails.push(clean);
            }
          }
        }
      }
    }

    connection.end();

    const uniqueBouncedRaw = Array.from(new Set(bouncedEmails));
    const campaignBounced = [];

    for (const email of uniqueBouncedRaw) {
      const existsInMailCamp = await MailCampaign.exists({ 'recipients.email': email });
      const existsInCoreCamp = await MailCampaign.db.model('Campaign').exists({ 'recipients.email': email });
      
      if (existsInMailCamp || existsInCoreCamp) {
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

      const allCampaigns = await MailCampaign.find({ 'recipients.email': email });
      for (const camp of allCampaigns) {
        let modified = false;
        camp.recipients.forEach(r => {
          if (r.email === email && r.status !== 'Bounced' && r.status !== 'Invalid') {
            r.status = 'Bounced';
            modified = true;
          }
        });
        if (modified) {
          camp.stats.invalid = (camp.stats.invalid || 0) + 1;
          camp.stats.bounced = (camp.stats.bounced || 0) + 1;
          await camp.save();
        }
      }

      const allCoreCampaigns = await MailCampaign.db.model('Campaign').find({ 'recipients.email': email });
      for (const camp of allCoreCampaigns) {
        let modified = false;
        camp.recipients.forEach(r => {
          if (r.email === email && r.status !== 'Bounced' && r.status !== 'Invalid') {
            r.status = 'Bounced';
            modified = true;
          }
        });
        if (modified) {
          if (!camp.metrics) camp.metrics = { totalSent: 0, opened: 0, clicked: 0, bounced: 0 };
          camp.metrics.bounced = (camp.metrics.bounced || 0) + 1;
          await camp.save();
        }
      }
    }

    return campaignBounced;
  } catch (err) {
    logger.error('IMAP Scan', 'IMAP Scan Error', { error: err.message });
    throw err;
  }
};

module.exports = { sendCampaign, scanBounces, updateEmailTags, sendTestEmail: async (opts) => {
  const { to, subject, html, profile } = opts;
  
  // Inline CSS styles for email client compatibility
  let inlinedHtml = html;
  try {
    inlinedHtml = juice(html);
  } catch (inlineErr) {
    logger.warn('CSS Inlining', 'Test email CSS inlining failed, sending without inlining', { error: inlineErr.message });
  }
  
  const transporter = nodemailer.createTransport({
    host: profile.smtpHost,
    port: profile.smtpPort,
    secure: profile.smtpPort === 465,
    auth: {
      user: profile.smtpUser,
      pass: profile.smtpPass
    }
  });
  return transporter.sendMail({
    from: profile.email,
    to,
    subject,
    html: inlinedHtml
  });
} };
