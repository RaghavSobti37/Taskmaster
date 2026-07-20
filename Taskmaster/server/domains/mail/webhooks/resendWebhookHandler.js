function movedResponse(res) {
  return res.status(410).json({
    error: 'Email provider webhooks moved to Auto-Mailer',
    service: 'auto-mailer',
  });
}

async function handleTrackResendWebhook(_req, res) {
  return movedResponse(res);
}

async function handleApiResendWebhook(_req, res) {
  return movedResponse(res);
}

module.exports = {
  handleTrackResendWebhook,
  handleApiResendWebhook,
};
