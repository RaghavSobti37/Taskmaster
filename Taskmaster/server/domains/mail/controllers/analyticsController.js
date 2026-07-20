const PRODUCTION_AUTO_MAILER_URL = 'https://auto-mailer-blue.vercel.app';

function autoMailerUrl(path = '/analytics') {
  const origin = String(process.env.AUTO_MAILER_URL || PRODUCTION_AUTO_MAILER_URL).trim().replace(/\/+$/, '');
  return `${origin}${path}`;
}

function moved(req, res) {
  return res.status(410).json({
    error: 'Moved to Auto-Mailer',
    service: 'auto-mailer',
    url: autoMailerUrl('/analytics'),
  });
}

exports.getStats = moved;
exports.scanBounces = moved;
exports.trackClick = moved;
exports.redirectUnsubscribe = moved;

exports.trackOpen = async (_req, res) => {
  const buf = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.writeHead(410, {
    'Content-Type': 'image/gif',
    'Content-Length': buf.length,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    'X-CoreKnot-Moved-To': autoMailerUrl('/analytics'),
  });
  res.end(buf);
};

exports.__private = { autoMailerUrl };
