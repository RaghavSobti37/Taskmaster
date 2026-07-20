const gmailAdapter = require('./gmailAdapter');
const mailchimpAdapter = require('./mailchimpAdapter');
const hubspotAdapter = require('./hubspotAdapter');
const webhookInAdapter = require('./webhookInAdapter');
const googleSheetsAdapter = require('./googleSheetsAdapter');
const salesforceAdapter = require('./salesforceAdapter');
const brevoAdapter = require('./brevoAdapter');
const slackAdapter = require('./slackAdapter');
const aisensyAdapter = require('./aisensyAdapter');

const ADAPTERS = {
  mailchimp: mailchimpAdapter,
  hubspot: hubspotAdapter,
  webhook_in: webhookInAdapter,
  google_sheets: googleSheetsAdapter,
  salesforce: salesforceAdapter,
  brevo: brevoAdapter,
  slack: slackAdapter,
  aisensy: aisensyAdapter,
};

function getAdapter(providerId) {
  return ADAPTERS[providerId] || null;
}

module.exports = {
  ADAPTERS,
  getAdapter,
};
