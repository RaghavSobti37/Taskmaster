const express = require('express');
const router = express.Router();

// GET route to handle Meta Webhook Verification handshake
router.get('/instagram', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === (process.env.META_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN || 'verify_tsc')) {
    console.log('✅ Meta Webhook Validation Successful!');
    return res.status(200).send(challenge);
  } else {
    console.error('❌ Meta Webhook Token Validation Failed.', { mode, token });
    return res.status(403).send('Validation Failed');
  }
});

// POST route to handle real-time Instagram mentions and events
router.post('/instagram', (req, res) => {
  try {
    const body = req.body;
    if (body && body.object === 'instagram') {
      body.entry?.forEach(entry => {
        entry.changes?.forEach(change => {
          if (change.field === 'mentions') {
            console.log('Webhook mention received for media_id:', change.value?.media_id);
          }
        });
      });
    }
    res.status(200).send('EVENT_RECEIVED');
  } catch (err) {
    console.error('Error in Meta webhook event processing:', err);
    res.status(500).send('SERVER_ERROR');
  }
});

module.exports = router;
