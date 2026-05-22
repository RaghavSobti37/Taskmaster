const express = require('express');
const router = express.Router();
const MailEvent = require('../models/MailEvent');
const MailCampaign = require('../models/MailCampaign');
const axios = require('axios');

// AWS SES / SNS Webhook Handler (Inspired by Sessy)
router.post('/webhook', express.json({ type: ['application/json', 'text/plain'] }), async (req, res) => {
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

  // 1. Handle SNS Subscription Confirmation
  if (body.Type === 'SubscriptionConfirmation') {
    console.log('[SNS] Confirming subscription:', body.SubscribeURL);
    await axios.get(body.SubscribeURL);
    return res.send('OK');
  }

  // 2. Handle SES Notifications
  if (body.Type === 'Notification') {
    const message = JSON.parse(body.Message);
    const eventType = message.eventType; // Bounce, Complaint, Delivery, Send, Open, Click, etc.
    const mail = message.mail;
    const messageId = mail.messageId;
    const timestamp = new Date(mail.timestamp);
    const recipients = mail.destination;

    for (const email of recipients) {
      await MailEvent.create({
        messageId,
        eventType,
        email,
        timestamp,
        metadata: message
      });

      // Update campaign stats if campaignId was in headers
      const campaignIdHeader = mail.headers?.find(h => h.name === 'X-Campaign-ID');
      if (campaignIdHeader) {
        const campaignId = campaignIdHeader.value;
        const update = {};
        if (eventType === 'Delivery') update['stats.sent'] = 1;
        if (eventType === 'Open') update['stats.opened'] = 1;
        if (eventType === 'Click') update['stats.clicked'] = 1;
        if (eventType === 'Bounce') update['stats.bounced'] = 1;

        if (Object.keys(update).length > 0) {
          await MailCampaign.findByIdAndUpdate(campaignId, { $inc: update });
          // Array status updates removed for performance. Counter increments handle campaign totals.
        }
      }
    }
  }

  res.send('OK');
});

module.exports = router;
