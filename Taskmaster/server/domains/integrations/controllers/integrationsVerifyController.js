const { resolveApiBaseUrl, resolveClientUrl, isLocalhostUrl } = require('../../../utils/oauthEnv');
const { resolveGoogleRedirectUri } = require('../../../utils/googleAuth');

function envStatus(name, value, { required = true, secret = false } = {}) {
  const raw = (value || '').replace(/['"]/g, '').trim();
  const placeholder = !raw || raw.includes('ROTATED_PLEASE') || raw === 'change-me-to-a-long-random-string';
  const localhost = isLocalhostUrl(raw);

  let status = 'ok';
  if (required && placeholder) status = 'missing';
  else if (process.env.NODE_ENV === 'production' && localhost && !secret) status = 'warn_localhost';

  return {
    name,
    configured: Boolean(raw) && !placeholder,
    status,
    preview: secret ? (raw ? `${raw.slice(0, 4)}…` : null) : raw || null,
  };
}

/** GET /api/integrations/oauth-readiness — admin-only pre-flight for Google/Meta verification */
exports.getOAuthReadiness = async (req, res) => {
  const apiBase = resolveApiBaseUrl(req);
  const clientUrl = resolveClientUrl();
  const googleRedirect = resolveGoogleRedirectUri(req);

  const checks = [
    envStatus('GOOGLE_CLIENT_ID', process.env.GOOGLE_CLIENT_ID),
    envStatus('GOOGLE_CLIENT_SECRET', process.env.GOOGLE_CLIENT_SECRET, { secret: true }),
    envStatus('YOUTUBE_CLIENT_ID', process.env.YOUTUBE_CLIENT_ID),
    envStatus('YOUTUBE_CLIENT_SECRET', process.env.YOUTUBE_CLIENT_SECRET, { secret: true }),
    envStatus('YOUTUBE_API_KEY', process.env.YOUTUBE_API_KEY, { secret: true }),
    envStatus('META_APP_ID', process.env.META_APP_ID),
    envStatus('META_APP_SECRET', process.env.META_APP_SECRET, { secret: true }),
    envStatus('META_VERIFY_TOKEN', process.env.META_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN),
    envStatus('ALLOWED_DOMAIN', process.env.ALLOWED_DOMAIN),
    envStatus('ADMIN_EMAIL', process.env.ADMIN_EMAIL),
    envStatus('FRONTEND_URL', process.env.FRONTEND_URL, { required: false }),
    envStatus('CLIENT_URL', process.env.CLIENT_URL, { required: false }),
  ];

  const issues = checks.filter((c) => c.status !== 'ok').map((c) => `${c.name}: ${c.status}`);

  const resolvedUris = {
    apiBase,
    clientUrl,
    googleStaffLoginCallback: googleRedirect,
    youtubeArtistCallback: `${apiBase}/api/artists/auth/callback/youtube`,
    metaOAuthCallback: `${clientUrl}/oauth/meta/callback`,
    metaWebhook: `${apiBase}/api/webhooks/instagram`,
    metaDataDeletionCallback: `${apiBase}/api/webhooks/meta-data-deletion`,
    privacyPolicy: `${clientUrl}/privacy`,
    dataDeletionPortal: `${clientUrl}/userdata`,
  };

  const youtubeProdRedirect = (process.env.YOUTUBE_REDIRECT_URI_PROD || '').trim();
  if (youtubeProdRedirect.includes('/login')) {
    issues.push('YOUTUBE_REDIRECT_URI_PROD points to /login — must be API callback URL');
  }

  if ((process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').trim().endsWith(' ')) {
    issues.push('GOOGLE_SERVICE_ACCOUNT_EMAIL has trailing whitespace');
  }

  res.json({
    nodeEnv: process.env.NODE_ENV,
    ready: issues.length === 0,
    issueCount: issues.length,
    issues,
    checks,
    resolvedUris,
    registerTheseInConsoles: {
      googleCloud: [
        googleRedirect,
        `${apiBase}/api/google/accounts/callback`,
        `${apiBase}/api/artists/auth/callback/youtube`,
      ],
      metaDeveloper: [
        `${clientUrl}/oauth/meta/callback`,
        `${apiBase}/api/webhooks/instagram`,
        `${apiBase}/api/webhooks/meta-data-deletion`,
      ],
    },
  });
};
