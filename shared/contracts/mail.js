const { z } = require('zod');
const { isSafePrimitive, isSafeShallowRecord } = require('./safeValues');

const mailProfileBody = z.record(z.string(), z.unknown()).refine(
  (body) => Object.entries(body).every(([key, value]) => {
    if (key === 'providerCredentials') {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
      return isSafeShallowRecord(value)
        && Object.values(/** @type {Record<string, unknown>} */ (value)).every((entry) => isSafeShallowRecord(entry));
    }
    return isSafePrimitive(value);
  }),
  { message: 'Invalid input format' },
);

const updateMailProfileBody = mailProfileBody;

/** @param {unknown} value @returns {boolean} */
const isSafeRecipientRow = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([field, entry]) => {
    if (field === 'rowData') return isSafeShallowRecord(entry);
    return isSafePrimitive(entry);
  });
};

const createCampaignBody = z.record(z.string(), z.unknown()).refine(
  (body) => Object.entries(body).every(([key, value]) => {
    if (key === 'leadIds' || key === 'senderProfileIds') {
      return Array.isArray(value) && /** @type {unknown[]} */ (value).every((id) => typeof id === 'string');
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

module.exports = {
  mailProfileBody,
  updateMailProfileBody,
  createCampaignBody,
  mailTemplateDraftBody,
  mailTemplateRejectBody,
};
