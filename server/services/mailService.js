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

  const recipients = campaign.recipients.filter(r => r.status === 'Pending');
  
  for (const recipient of recipients) {
    try {
      const mailOptions = {
        from: `"${profile.name}" <${profile.email}>`,
        to: recipient.email,
        subject: campaign.subject,
        html: campaign.content,
        headers: {
          'X-Campaign-ID': campaign._id.toString()
        }
      };

      const info = await transporter.sendMail(mailOptions);
      recipient.status = 'Sent';
      recipient.sentAt = new Date();
      recipient.messageId = info.messageId;
      
      campaign.stats.sent++;
    } catch (err) {
      console.error(`Failed to send to ${recipient.email}:`, err);
      recipient.status = 'Failed';
      recipient.error = err.message;
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
    
    const searchCriteria = ['UNSEEN', ['OR', ['SUBJECT', 'Delivery Status Notification'], ['SUBJECT', 'Undeliverable']]];
    const fetchOptions = { bodies: ['HEADER', 'TEXT'], markSeen: true };
    
    const messages = await connection.search(searchCriteria, fetchOptions);
    const bouncedEmails = [];

    for (const item of messages) {
      const all = item.parts.find(part => part.which === 'TEXT');
      const id = item.attributes.uid;
      const idHeader = `Imap-Id: ${id}`;
      
      const parsed = await simpleParser(all.body);
      
      // Heuristic for bounce parsing
      const body = parsed.text || '';
      const match = body.match(/Final-Recipient: rfc822;\s*([^\s<>]+@[^\s<>]+)/i);
      if (match) {
        bouncedEmails.push(match[1].toLowerCase().trim());
      } else {
        // Fallback: look for emails in body
        const emails = body.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
        if (emails) {
          const target = emails.find(e => e.toLowerCase() !== profile.email.toLowerCase());
          if (target) bouncedEmails.push(target.toLowerCase().trim());
        }
      }
    }

    connection.end();

    // Mark as bounced in database
    for (const email of bouncedEmails) {
      await MailEvent.create({
        email,
        eventType: 'Bounce',
        timestamp: new Date(),
        metadata: { source: 'IMAP_SCAN' }
      });
      
      // Update leads
      await Lead.updateMany({ email }, { $set: { leadStatus: 'Bounced' } });
    }

    return bouncedEmails;
  } catch (err) {
    console.error('IMAP Scan Error:', err);
    throw err;
  }
};

module.exports = { sendCampaign, scanBounces };
