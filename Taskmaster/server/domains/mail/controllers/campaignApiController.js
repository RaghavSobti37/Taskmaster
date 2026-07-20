const PRODUCTION_AUTO_MAILER_URL = 'https://auto-mailer-blue.vercel.app';

function autoMailerCampaignUrl(req) {
  const origin = String(process.env.AUTO_MAILER_URL || PRODUCTION_AUTO_MAILER_URL).trim().replace(/\/+$/, '');
  const id = req?.params?.id ? `/${encodeURIComponent(String(req.params.id))}` : '';
  return `${origin}/campaigns${id}`;
}

function moved(req, res) {
  return res.status(410).json({
    error: 'Moved to Auto-Mailer',
    service: 'auto-mailer',
    url: autoMailerCampaignUrl(req),
  });
}

exports.list = moved;
exports.getById = moved;
exports.getRecipients = moved;
exports.exportRecipients = moved;
exports.getAnalytics = moved;
exports.create = moved;
exports.dispatch = moved;
exports.resend = moved;
exports.resendFiltered = moved;
exports.stop = moved;
exports.remove = moved;

exports.uploadAttachment = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  return moved(req, res);
};

exports.__private = { autoMailerCampaignUrl };
