/**
 * Business integration provider registry — tenant Connected Apps hub.
 * Add providers here; adapters live in domains/integrations-hub/adapters/.
 */

const INTEGRATION_PROVIDERS = [
  {
    id: 'gmail',
    name: 'Gmail',
    category: 'email',
    authType: 'oauth2',
    connectMethod: 'oauth',
    capabilities: ['send_email'],
    featureUnlock: 'google',
    planMin: 'pro',
    icon: 'mail',
    colorClass: 'rose',
    oauthConfig: {
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scopes: ['https://www.googleapis.com/auth/gmail.send', 'openid', 'email', 'profile'],
    },
  },
  {
    id: 'resend',
    name: 'Resend',
    category: 'email',
    authType: 'api_key',
    connectMethod: 'api_key',
    capabilities: ['send_email'],
    featureUnlock: 'resend',
    planMin: 'pro',
    icon: 'send',
    colorClass: 'slate',
  },
  {
    id: 'brevo',
    name: 'Brevo',
    category: 'email',
    authType: 'api_key',
    connectMethod: 'api_key',
    capabilities: ['send_email', 'sync_contacts'],
    featureUnlock: 'resend',
    planMin: 'pro',
    icon: 'mail',
    colorClass: 'blue',
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    category: 'marketing',
    authType: 'oauth2',
    connectMethod: 'oauth',
    capabilities: ['sync_contacts', 'sync_audiences'],
    featureUnlock: 'resend',
    planMin: 'pro',
    icon: 'users',
    colorClass: 'yellow',
    oauthConfig: {
      authUrl: 'https://login.mailchimp.com/oauth2/authorize',
      tokenUrl: 'https://login.mailchimp.com/oauth2/token',
      scopes: [],
    },
    apiKeyFallback: true,
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    category: 'crm',
    authType: 'oauth2',
    connectMethod: 'oauth',
    capabilities: ['sync_contacts', 'sync_deals', 'push_leads'],
    featureUnlock: 'finance',
    planMin: 'pro',
    icon: 'building',
    colorClass: 'orange',
    oauthConfig: {
      authUrl: 'https://app.hubspot.com/oauth/authorize',
      tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
      scopes: ['crm.objects.contacts.read', 'crm.objects.contacts.write', 'crm.objects.deals.read'],
    },
  },
  {
    id: 'google_sheets',
    name: 'Google Sheets',
    category: 'crm',
    authType: 'oauth2',
    connectMethod: 'oauth',
    capabilities: ['import_contacts'],
    featureUnlock: 'google',
    planMin: 'pro',
    icon: 'sheet',
    colorClass: 'green',
    oauthConfig: {
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly', 'email', 'profile'],
    },
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    category: 'crm',
    authType: 'oauth2',
    connectMethod: 'oauth',
    capabilities: ['sync_contacts', 'push_leads'],
    featureUnlock: 'finance',
    planMin: 'enterprise',
    icon: 'cloud',
    colorClass: 'cyan',
    oauthConfig: {
      authUrl: 'https://login.salesforce.com/services/oauth2/authorize',
      tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
      scopes: ['api', 'refresh_token'],
    },
  },
  {
    id: 'webhook_in',
    name: 'Inbound Webhook',
    category: 'custom',
    authType: 'webhook_secret',
    connectMethod: 'auto',
    capabilities: ['receive_webhooks'],
    featureUnlock: 'finance',
    planMin: 'enterprise',
    icon: 'webhook',
    colorClass: 'violet',
  },
  {
    id: 'slack',
    name: 'Slack',
    category: 'custom',
    authType: 'oauth2',
    connectMethod: 'oauth',
    capabilities: ['send_notifications'],
    featureUnlock: 'finance',
    planMin: 'pro',
    icon: 'message-square',
    colorClass: 'purple',
    oauthConfig: {
      authUrl: 'https://slack.com/oauth/v2/authorize',
      tokenUrl: 'https://slack.com/api/oauth.v2.access',
      scopes: ['incoming-webhook', 'chat:write'],
    },
  },
  {
    id: 'zapier',
    name: 'Zapier',
    category: 'custom',
    authType: 'webhook_secret',
    connectMethod: 'outbound_only',
    capabilities: ['outbound_events'],
    featureUnlock: 'finance',
    planMin: 'enterprise',
    icon: 'zap',
    colorClass: 'amber',
  },
];

const TENANT_WEBHOOK_EVENTS = [
  'lead.created',
  'lead.updated',
  'person.merged',
  'campaign.sent',
  'mail.event',
  'integration.sync.completed',
  'integration.error',
];

function byProviderId(id) {
  return INTEGRATION_PROVIDERS.find((p) => p.id === id) || null;
}

function providersByCategory(category) {
  return INTEGRATION_PROVIDERS.filter((p) => p.category === category);
}

module.exports = {
  INTEGRATION_PROVIDERS,
  TENANT_WEBHOOK_EVENTS,
  byProviderId,
  providersByCategory,
};
