/**
 * Business integration provider registry — tenant Connected Apps hub.
 * Add providers here; adapters live in domains/integrations-hub/adapters/.
 */

const INTEGRATION_PROVIDERS = [
  {
    id: 'gmail',
    name: 'Gmail',
    category: 'email',
    description: 'Send campaign and transactional email from your Gmail workspace account.',
    setupHint: 'Requires Google OAuth on the server (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET). You will sign in with Google and grant send access.',
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
    description: 'Deliver email through Resend using your API key — good for bulk and domain-verified sending.',
    setupHint: 'Create an API key in Resend → API Keys. Paste it here; CoreKnot stores it encrypted per organization.',
    authType: 'api_key',
    connectMethod: 'api_key',
    capabilities: ['send_email'],
    featureUnlock: 'resend',
    planMin: 'pro',
    icon: 'send',
    colorClass: 'slate',
  },
  {
    id: 'google_sheets',
    name: 'Google Sheets',
    category: 'data',
    description: 'Import contacts and audience rows from a Google Sheet into CRM lists.',
    setupHint: 'Uses the same Google OAuth app as Gmail. Pick the spreadsheet after you authorize Google.',
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
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.readonly',
        'email',
        'profile',
      ],
    },
  },
  {
    id: 'webhook_in',
    name: 'Inbound Webhook',
    category: 'intake',
    description: 'Receive leads and events from external systems via a signed POST URL.',
    setupHint: 'CoreKnot generates a secret and URL — copy them into your source system (Zapier, custom app, etc.).',
    authType: 'webhook_secret',
    connectMethod: 'auto',
    capabilities: ['receive_webhooks'],
    featureUnlock: 'finance',
    planMin: 'pro',
    icon: 'webhook',
    colorClass: 'violet',
  },
  {
    id: 'aisensy',
    name: 'AiSensy',
    category: 'messaging',
    description: 'Send WhatsApp campaigns and receive delivery webhooks through AiSensy.',
    setupHint: 'API key from AiSensy → API & Integrations. After connect, paste the webhook URL and verify token back into AiSensy.',
    authType: 'api_key',
    connectMethod: 'api_key',
    capabilities: ['send_whatsapp', 'receive_webhooks'],
    featureUnlock: 'meta',
    planMin: 'pro',
    icon: 'message-circle',
    colorClass: 'green',
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
