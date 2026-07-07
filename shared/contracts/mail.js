const { z } = require('zod');
const { isSafePrimitive, isSafeShallowRecord } = require('./safeValues');

const mailProfileBody = z.record(z.string(), z.unknown()).refine(
  (body) => Object.entries(body).every(([key, value]) => {
    if (key === 'providerCredentials') {
      return isSafeShallowRecord(value)
        && Object.values(/** @type {Record<string, unknown>} */ (value)).every((entry) => isSafeShallowRecord(entry));
    }
    return isSafePrimitive(value);
  }),
  { message: 'Invalid input format' },
);

const updateMailProfileBody = mailProfileBody;

/**
 * @param {unknown} value
 * @returns {boolean}
 */
const isSafeRecipientRow = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(/** @type {Record<string, unknown>} */ (value)).every(([field, entry]) => {
    if (field === 'rowData') return isSafeShallowRecord(entry);
    return isSafePrimitive(entry);
  });
};

const createCampaignBody = z.record(z.string(), z.unknown()).refine(
  (body) => Object.entries(body).every(([key, value]) => {
    if (key === 'leadIds' || key === 'senderProfileIds') {
      return Array.isArray(value) && value.every((id) => typeof id === 'string');
    }
    if (key === 'customRecipients') {
      return Array.isArray(value) && value.every(isSafeRecipientRow);
    }
    if (key === 'attachments') {
      return Array.isArray(value) && value.every((file) => isSafeShallowRecord(file));
    }
    if (key === 'variableMapping' || key === 'variableFallbacks' || key === 'dummyValues') {
      return isSafeShallowRecord(value);
    }
    return isSafePrimitive(value) || isSafeShallowRecord(value);
  }),
  { message: 'Invalid input format' },
);

const mailTemplateDraftBody = z.record(z.string(), z.unknown()).refine(
  (body) => Object.entries(body).every(([key, value]) => {
    if (key === 'dummyValues') return isSafeShallowRecord(value);
    if (key === 'content' || key === 'name' || key === 'subject' || key === 'format' || key === 'id') {
      return value === undefined || typeof value === 'string';
    }
    return isSafePrimitive(value);
  }),
  { message: 'Invalid input format' },
);

const mailTemplateRejectBody = z.object({
  rejectionNote: z.string().optional(),
});

/**
 * @typedef {z.infer<typeof mailProfileBody>} MailProfileBody
 * @typedef {z.infer<typeof updateMailProfileBody>} UpdateMailProfileBody
 * @typedef {z.infer<typeof createCampaignBody>} CreateCampaignBody
 * @typedef {z.infer<typeof mailTemplateDraftBody>} MailTemplateDraftBody
 * @typedef {z.infer<typeof mailTemplateRejectBody>} MailTemplateRejectBody
 */

module.exports = {
  mailProfileBody,
  updateMailProfileBody,
  createCampaignBody,
  mailTemplateDraftBody,
  mailTemplateRejectBody,
};
