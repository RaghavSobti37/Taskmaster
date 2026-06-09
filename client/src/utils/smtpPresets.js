/** Supported senders: Gmail (SMTP) and Resend (API via system_resend) */
export const SMTP_PRESETS = {
  gmail: { label: 'Gmail', smtpHost: 'smtp.gmail.com', smtpPort: 587, dailyLimit: 500 },
  resend: { label: 'Resend (API)', smtpHost: '', smtpPort: 587, dailyLimit: 100 },
};

export const inferProviderFromEmail = (email) => {
  const addr = (email || '').trim().toLowerCase();
  if (!addr.includes('@')) return null;
  if (/@(gmail|googlemail)\.com$/i.test(addr)) return 'gmail';
  if (/@theshakticollective\.in$/i.test(addr)) return 'gmail';
  return null;
};

/** Legacy rotation providers — disabled in UI; kept empty for backward-compatible imports */
export const ADDITIONAL_ROTATION_PROVIDERS = [];

export const SMTP_AUTH_HINTS = {};

const credsToObject = (map) => {
  if (!map) return {};
  if (map instanceof Map) return Object.fromEntries(map.entries());
  return { ...map };
};

export const getProfileRotationProviders = (profile) => {
  if (!profile) return [];
  const inferred = inferProviderFromEmail(profile.smtpUser || profile.email);
  if (inferred && profile.smtpPass && profile.smtpPass !== 'unused') return [inferred];
  return [];
};

export const emptyProviderCredentials = () => ({});

export const SIGNATURE_START = '<!-- TASKMASTER_SIGNATURE_START -->';
export const SIGNATURE_END = '<!-- TASKMASTER_SIGNATURE_END -->';

const SIGNATURE_MARKER_BLOCK_RE = new RegExp(
  `${SIGNATURE_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${SIGNATURE_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
  'gi'
);

const DATA_ATTR_SIG_RE = /<div[^>]*data-coreknot-signature\s*=\s*["']?true["']?[^>]*>[\s\S]*?<\/div>/gi;

export const countSignatureBlocks = (html) => {
  if (!html) return 0;
  const markerCount = (html.match(SIGNATURE_MARKER_BLOCK_RE) || []).length;
  if (markerCount > 0) return markerCount;
  return (html.match(DATA_ATTR_SIG_RE) || []).length;
};

export const hasSignatureBlock = (html) => countSignatureBlocks(html) > 0;

export const PAYLOAD_SAFE_BYTES = 4 * 1024 * 1024;

export const estimateJsonBytes = (obj) => {
  try {
    return new Blob([JSON.stringify(obj)]).size;
  } catch {
    return 0;
  }
};
