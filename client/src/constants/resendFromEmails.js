import {
  ROOT_DOMAIN,
  RESEND_VERIFIED_DOMAINS,
  DEFAULT_EMAIL_STREAMS,
  normalizeEmailStream,
  isVerifiedResendEmail as isSharedVerifiedResendEmail,
} from '@shared/emailStreams.cjs';

export {
  ROOT_DOMAIN,
  RESEND_VERIFIED_DOMAINS,
  DEFAULT_EMAIL_STREAMS,
  normalizeEmailStream,
};

export const normalizeEmailStreams = (streams) => {
  const normalized = (Array.isArray(streams) ? streams : [])
    .map((s, i) => normalizeEmailStream(s, i))
    .filter(Boolean);
  if (normalized.length) return normalized;
  return DEFAULT_EMAIL_STREAMS.map((s, i) => normalizeEmailStream(s, i));
};

/** Legacy alias — root domain currently verified in Resend. */
export const VERIFIED_RESEND_DOMAIN = ROOT_DOMAIN;

export const DEFAULT_RESEND_FROM_EMAILS = DEFAULT_EMAIL_STREAMS.find((s) => s.slug === 'main')?.fromEmails || [
  'artist@theshakticollective.in',
  'helloworld@theshakticollective.in',
  'team@theshakticollective.in',
];

export const RESEND_FROM_DISPLAY_NAMES = {
  'artist@theshakticollective.in': 'The Shakti Collective',
  'helloworld@theshakticollective.in': 'The Shakti Collective',
  'team@theshakticollective.in': 'The Shakti Collective',
  'hello@theshakticollective.in': 'The Shakti Collective — Events',
};

const STORAGE_KEY = 'tsc_custom_resend_from_emails';

export const isVerifiedResendEmail = (email) => {
  return isSharedVerifiedResendEmail(email);
};

export const getCustomResendEmails = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isVerifiedResendEmail) : [];
  } catch {
    return [];
  }
};

export const addCustomResendEmail = (email) => {
  const normalized = (email || '').trim().toLowerCase();
  if (!isVerifiedResendEmail(normalized)) {
    return { ok: false, error: `Must be a valid @${ROOT_DOMAIN} address` };
  }
  if (DEFAULT_RESEND_FROM_EMAILS.includes(normalized)) return { ok: true, email: normalized };
  const existing = getCustomResendEmails();
  if (existing.includes(normalized)) return { ok: true, email: normalized };
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, normalized]));
  return { ok: true, email: normalized };
};

export const getAllResendFromEmails = () => {
  const custom = getCustomResendEmails().filter((e) => !DEFAULT_RESEND_FROM_EMAILS.includes(e));
  return [...DEFAULT_RESEND_FROM_EMAILS, ...custom];
};

export const displayNameForResendEmail = (email) => {
  const key = (email || '').trim().toLowerCase();
  if (RESEND_FROM_DISPLAY_NAMES[key]) return RESEND_FROM_DISPLAY_NAMES[key];
  const local = key.split('@')[0] || '';
  if (!local) return 'The Shakti Collective';
  return local.charAt(0).toUpperCase() + local.slice(1);
};
