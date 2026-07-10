const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { handleBookedCall, handleArtistEnquiry, handleArtistPath, handleNewsletter, handleMasterclassReview } = require('../controllers/webhookController');
const metaDataDeletion = require('../controllers/metaDataDeletionController');
const { webhookIdempotency } = require('../middleware/webhookIdempotency');
const { webhookRateLimit } = require('../middleware/rateLimits');
const { rejectUnlessBookCallAuthorized } = require('../utils/webhookAuth');

const requireBookCallAuth = (req, res, next) => {
  if (!rejectUnlessBookCallAuthorized(req, res)) return;
  next();
};

router.use(webhookRateLimit);

const { handleClerkWebhook } = require('../domains/auth/webhooks/clerkWebhookHandler');
const {
  handleAisensyWebhookVerify,
  handleAisensyWebhook,
} = require('../domains/whatsapp/webhooks/aisensyWebhookHandler');

router.post('/book-call', requireBookCallAuth, webhookIdempotency, handleBookedCall);
// ponytail: Clerk uses ClerkSyncEvent idempotency — skip generic svix-id middleware
router.post('/clerk', handleClerkWebhook);
router.get('/aisensy', handleAisensyWebhookVerify);
router.post('/aisensy', handleAisensyWebhook);

router.use(webhookIdempotency);
router.post('/artist-path', handleArtistPath);
router.post('/artist-enquiry', handleArtistEnquiry);
router.post('/newsletter', handleNewsletter);
router.post('/masterclass-review', handleMasterclassReview);

// Meta Platform — data deletion callback (App Dashboard → Data Deletion Request URL)
router.post('/meta-data-deletion', metaDataDeletion.handleDataDeletionCallback);
router.get('/meta-data-deletion/:code', metaDataDeletion.getDeletionStatus);

// GET route to handle Meta Webhook Verification handshake
router.get('/instagram', (req, res) => {
  const mode = req.query['hub.mode'] || req.query.hub?.mode;
  const token = req.query['hub.verify_token'] || req.query.hub?.verify_token;
  const challenge = req.query['hub.challenge'] || req.query.hub?.challenge;

  const expectedToken = (process.env.META_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN || '').replace(/['"]/g, '').trim();
  const receivedToken = (token || '').replace(/['"]/g, '').trim();
  const receivedMode = (mode || '').trim();

  logger.debug('metaWebhook', 'Verification request', { mode: receivedMode });

  if (receivedMode === 'subscribe' && expectedToken && receivedToken === expectedToken) {
    logger.info('metaWebhook', 'Handshake validated; sending challenge');
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(challenge);
  } else {
    console.error('❌ Meta Webhook Token Validation Failed.', { receivedMode });
    return res.status(403).send('Validation Failed');
  }
});

const crypto = require('crypto');

// POST route to handle real-time Instagram mentions and events
router.post('/instagram', (req, res) => {
  try {
    const signatureHeader = req.headers['x-hub-signature-256'];
    if (process.env.META_APP_SECRET) {
      if (!signatureHeader || !req.rawBody) {
        return res.status(401).send('MISSING_SIGNATURE');
      }
      const hmac = crypto.createHmac('sha256', process.env.META_APP_SECRET);
      const digest = `sha256=${hmac.update(req.rawBody).digest('hex')}`;
      if (digest !== signatureHeader) {
        console.warn('❌ [Meta Webhook] Signature mismatch');
        return res.status(401).send('INVALID_SIGNATURE');
      }
      logger.debug('metaWebhook', 'Payload signature verified');
    } else if (process.env.NODE_ENV === 'production') {
      return res.status(503).send('META_APP_SECRET_NOT_CONFIGURED');
    }

    const body = req.body;
    if (body && body.object === 'instagram') {
      body.entry?.forEach(entry => {
        entry.changes?.forEach(change => {
          if (change.field === 'mentions') {
            logger.debug('metaWebhook', 'Mention received', {
              mediaId: change.value?.media_id,
              commentId: change.value?.comment_id,
            });
          } else if (change.field === 'comments') {
            logger.debug('metaWebhook', 'Comment received', {
              mediaId: change.value?.media_id,
              text: change.value?.text,
            });
          } else if (change.field === 'messages') {
            logger.debug('metaWebhook', 'Message received', { senderId: change.value?.sender?.id });
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

router.post('/resend', (_req, res) => {
  res.status(410).json({
    error: 'Resend campaign webhooks moved to Auto Mailer',
    service: 'auto-mailer',
  });
});

module.exports = router;
