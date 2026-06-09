/**
 * Resend tag names/values: ASCII letters, numbers, underscores, dashes only.
 * @see https://resend.com/docs/api-reference/emails/send-email
 */
const sanitizeResendTagValue = (value, { maxLen = 256 } = {}) => {
  if (value == null || value === '') return 'unknown';
  const sanitized = String(value)
    .trim()
    .toLowerCase()
    .replace(/@/g, '_at_')
    .replace(/\./g, '_')
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return (sanitized || 'unknown').slice(0, maxLen);
};

/** @param {{ name: string, value: string }[]} tags */
const sanitizeResendTags = (tags = []) => tags.map((tag) => ({
  name: sanitizeResendTagValue(tag.name),
  value: sanitizeResendTagValue(tag.value),
}));

module.exports = {
  sanitizeResendTagValue,
  sanitizeResendTags,
};
