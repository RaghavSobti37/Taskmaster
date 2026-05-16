const nodemailer = require('nodemailer');
const imaps = require('imap-simple');
const { simpleParser } = require('mailparser');
const MailCampaign = require('../models/MailCampaign');
const EmailProfile = require('../models/EmailProfile');
const MailEvent = require('../models/MailEvent');
const Lead = require('../models/Lead');

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

  const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
  const recipients = campaign.recipients.filter(r => r.status === 'Pending');
  
  for (const recipient of recipients) {
    try {
      const trackingUrl = `${baseUrl}/api/mail/track/${campaign._id}/${recipient._id}?email=${encodeURIComponent(recipient.email)}`;
      const trackingPixel = `<img src="${trackingUrl}" width="1" height="1" style="display:none; width:1px; height:1px;" alt="" />`;
      const unsubscribeUrl = `${baseUrl}/api/mail/unsubscribe/${campaign._id}/${recipient._id}?email=${encodeURIComponent(recipient.email)}`;
      const htmlWithTracking = `${campaign.content}${trackingPixel}<br><br><p style="font-size: 11px; color: #666;"><a href="${unsubscribeUrl}">Unsubscribe</a></p>`;

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
        const lead = await Lead.findOne({ email: recipient.email.toLowerCase().trim() });
        if (lead) {
          lead.metadata = { ...lead.metadata, emailStatus: 'Inactive', sendError: err.message };
          if (!lead.tags.includes('Invalid')) lead.tags.push('Invalid');
          await lead.save();
        }
      }
    }
    await campaign.save();
  }

  campaign.status = 'Completed';
  await campaign.save();
};

const scanBounces = async (profileId) => {
  const profile = await EmailProfile.findById(profileId);
  if (!profile) return;

  const config = {
    imap: {
      user: profile.smtpUser,
      password: profile.smtpPass,
      host: profile.smtpHost.replace('smtp', 'imap'), // Heuristic
      port: 993,
      tls: true,
      authTimeout: 3000
    }
  };

  try {
    const connection = await imaps.connect(config);
    await connection.openBox('INBOX');
    
    const searchCriteria = ['ALL', ['OR', ['SUBJECT', 'Delivery Status Notification'], ['OR', ['SUBJECT', 'Undeliverable'], ['OR', ['SUBJECT', 'Failure Notice'], ['SUBJECT', 'Delivery Failure']]]]];
    const fetchOptions = { bodies: ['HEADER', 'TEXT'], markSeen: true };
    
    const messages = await connection.search(searchCriteria, fetchOptions);
    const bouncedEmails = [];

    for (const item of messages) {
      const all = item.parts.find(part => part.which === 'TEXT');
      if (!all || !all.body) continue;
      
      const parsed = await simpleParser(all.body);
      const body = parsed.text || '';
      const match = body.match(/Final-Recipient: rfc822;\s*([^\s<>]+@[^\s<>]+)/i)
        || body.match(/failed permanently:\s*([^\s<>]+@[^\s<>]+)/i)
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

    const uniqueBounced = Array.from(new Set(bouncedEmails));

    for (const email of uniqueBounced) {
      await MailEvent.findOneAndUpdate(
        { email, eventType: 'Bounce' },
        { email, eventType: 'Bounce', timestamp: new Date(), metadata: { source: 'IMAP_SCAN' } },
        { upsert: true }
      );
      
      const leads = await Lead.find({ email });
      for (const lead of leads) {
        lead.leadStatus = 'Bounced';
        lead.metadata = { ...lead.metadata, emailStatus: 'Inactive', lastBouncedAt: new Date() };
        if (!lead.tags.includes('Invalid')) lead.tags.push('Invalid');
        await lead.save();
      }

      const campaigns = await MailCampaign.find({ 'recipients.email': email });
      for (const camp of campaigns) {
        let modified = false;
        camp.recipients.forEach(r => {
          if (r.email === email && r.status !== 'Bounced') {
            r.status = 'Bounced';
            modified = true;
          }
        });
        if (modified) {
          camp.stats.bounced = (camp.stats.bounced || 0) + 1;
          await camp.save();
        }
      }
    }

    return uniqueBounced;
  } catch (err) {
    console.error('IMAP Scan Error:', err);
    throw err;
  }
};

module.exports = { sendCampaign, scanBounces };
