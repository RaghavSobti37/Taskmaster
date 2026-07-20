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
exports.create = moved;
exports.send = moved;
exports.preview = moved;
exports.testCampaign = moved;
exports.remove = moved;

exports.__private = { autoMailerCampaignUrl };
