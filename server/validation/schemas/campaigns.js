const { z } = require('zod');
const { isSafePrimitive } = require('./safeValues');
const { createCampaignBody } = require('./mail');

const resendCampaignBody = z.record(z.unknown()).refine(
  (body) => Object.entries(body).every(([key, value]) => {
    if (key === 'senderProfileIds' || key === 'targetStatuses') {
      return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
    }
    if (key === 'includeSignature') {
      return typeof value === 'boolean' || value === undefined;
    }
    if (key === 'senderMode' || key === 'systemProvider' || key === 'senderProfileId' || key === 'resendFromEmail') {
      return value === undefined || typeof value === 'string';
    }
    return isSafePrimitive(value);
  }),
  { message: 'Invalid input format' },
);

const resendFilteredCampaignBody = z.record(z.unknown()).refine(
  (body) => Object.entries(body).every(([key, value]) => {
    if (key === 'recipientEmails' || key === 'senderProfileIds') {
      return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
    }
    if (key === 'hideInvalid' || key === 'includeSignature') {
      return typeof value === 'boolean' || value === undefined;
    }
    if (
      key === 'statusFilter'
      || key === 'filterLabel'
      || key === 'titleOverride'
      || key === 'senderMode'
      || key === 'senderProfileId'
      || key === 'resendFromEmail'
      || key === 'systemProvider'
    ) {
      return value === undefined || typeof value === 'string';
    }
    return isSafePrimitive(value);
  }),
  { message: 'Invalid input format' },
);

module.exports = {
  createCampaignBody,
  resendCampaignBody,
  resendFilteredCampaignBody,
};
