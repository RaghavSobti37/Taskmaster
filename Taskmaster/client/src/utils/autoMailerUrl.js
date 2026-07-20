const PRODUCTION_AUTO_MAILER_URL = 'https://auto-mailer-blue.vercel.app';

const trimSlash = (url) => String(url || '').trim().replace(/\/$/, '');

export function getAutoMailerOrigin() {
  const fromEnv = trimSlash(import.meta.env.VITE_AUTO_MAILER_URL);
  if (fromEnv) return fromEnv;
  if (import.meta.env.DEV) return 'http://localhost:5001';
  return PRODUCTION_AUTO_MAILER_URL;
}

export function autoMailerPathForCoreKnotPath(pathname = '') {
  const path = String(pathname || '').split('?')[0];
  const withoutOrg = path.replace(/^\/[^/]+(?=\/emails(?:\/|$))/, '');

  const withoutOrgCampaign = path.replace(/^\/[^/]+(?=\/campaign\/)/, '');

  if (/^\/campaign\/([^/]+)/.test(withoutOrgCampaign)) {
    const [, id] = withoutOrgCampaign.match(/^\/campaign\/([^/]+)/) || [];
    return id ? `/campaigns/${encodeURIComponent(id)}` : '/campaigns';
  }
  if (/^\/emails\/create\b/.test(withoutOrg)) return '/campaigns/new';
  if (/^\/emails\/campaigns\b/.test(withoutOrg)) return '/campaigns';
  if (/^\/emails\/templates\b/.test(withoutOrg)) return '/templates';
  if (/^\/emails\/profiles\b/.test(withoutOrg)) return '/senders';
  if (/^\/emails\/streams\b/.test(withoutOrg)) return '/settings';
  if (/^\/emails\/newsletter\/send\b/.test(withoutOrg)) return '/campaigns/new';
  if (/^\/emails\/newsletter\b/.test(withoutOrg)) return '/campaigns';
  if (/^\/data-hub\b/.test(path) || /^\/admin\/data-hub\b/.test(path)) return '/audience';
  if (/^\/unsubscribe\b/.test(path)) return '/unsubscribe';
  return '';
}

export function buildAutoMailerUrl(pathname = '') {
  const origin = getAutoMailerOrigin();
  const path = autoMailerPathForCoreKnotPath(pathname);
  const query = String(pathname || '').includes('?') ? `?${String(pathname).split('?').slice(1).join('?')}` : '';
  if (path === '/unsubscribe') return `${origin}${path}${query}`;
  return `${origin}${path}`;
}
