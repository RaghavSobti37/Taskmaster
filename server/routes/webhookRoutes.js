const express = require('express');
const router = express.Router();

// GET route to handle Meta Webhook Verification handshake
router.get('/instagram', (req, res) => {
  const mode = req.query['hub.mode'] || req.query.hub?.mode;
  const token = req.query['hub.verify_token'] || req.query.hub?.verify_token;
  const challenge = req.query['hub.challenge'] || req.query.hub?.challenge;

  const expectedToken = (process.env.META_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN || 'verify_tsc').replace(/['"]/g, '').trim();
  const receivedToken = (token || '').replace(/['"]/g, '').trim();
  const receivedMode = (mode || '').trim();

  console.log('⚡ Received webhook verification request token:', receivedToken, 'Expected:', expectedToken, 'Mode:', receivedMode, 'Query:', JSON.stringify(req.query));

  if (receivedMode === 'subscribe' && receivedToken === expectedToken) {
    console.log('✅ Handshake validated successfully. Sending challenge code back.');
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(challenge);
  } else {
    console.error('❌ Meta Webhook Token Validation Failed.', { receivedMode, receivedToken, expectedToken });
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
