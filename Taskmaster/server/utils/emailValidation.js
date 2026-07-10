/**
 * Email format validation for campaign recipients.
 * Rejects phone numbers, missing @, and malformed TLDs.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const PHONE_PATTERN = /^\+?\d{7,15}$/;
const TLD_PATTERN = /^[a-z]{2,63}$/i;

const normalizeEmail = (email) => {
  if (!email) return '';
  return String(email)
    .trim()
    .toLowerCase()
    .replace(/[\x00-\x1F\x7F]/g, '');
};

const looksLikePhone = (value) => {
  if (!value) return false;
  const compact = String(value).replace(/[\s().-]/g, '');
  if (!compact) return false;
  if (!/^\+?\d+$/.test(compact)) return false;
  return PHONE_PATTERN.test(compact);
};

const isValidEmail = (email) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  if (!normalized.includes('@')) return false;
  if (looksLikePhone(normalized)) return false;
  if (!EMAIL_PATTERN.test(normalized)) return false;

  const domain = normalized.split('@')[1];
  if (!domain || domain.startsWith('.') || domain.endsWith('.')) return false;

  const tld = domain.split('.').pop();
  if (!tld || !TLD_PATTERN.test(tld)) return false;

  return true;
};

const RECIPIENT_STATUS_GROUPS = {
  all: null,
  pending: ['Pending', 'Queued'],
  sent: ['Sent'],
  opened: ['Opened'],
  clicked: ['Clicked'],
  bounced: ['Bounced', 'Failed', 'Invalid'],
  unsubscribed: ['Unsubscribed'],
  cancelled: ['Cancelled'],
};

const filterRecipientsByStatus = (recipients, statusKey) => {
  const match = RECIPIENT_STATUS_GROUPS[statusKey];
  if (!match) return recipients;
  return recipients.filter((r) => match.includes(r.status || 'Pending'));
};

const annotateRecipient = (recipient) => {
  const email = normalizeEmail(recipient?.email);
  const invalidEmail = !isValidEmail(email);
  return {
    ...recipient,
    email,
    invalidEmail,
    displayStatus: invalidEmail && (recipient.status === 'Pending' || recipient.status === 'Queued')
      ? 'Invalid'
      : (recipient.status || 'Pending'),
  };
};

module.exports = {
  normalizeEmail,
  isValidEmail,
  looksLikePhone,
  RECIPIENT_STATUS_GROUPS,
  filterRecipientsByStatus,
  annotateRecipient,
};
