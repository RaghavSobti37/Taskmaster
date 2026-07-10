const {
  resolveTenantByWebhookSecret,
  resolveTenantByVerifyToken,
  webhookUrl,
} = require('../../domains/integrations-hub/services/aisensyIntegrationService');

describe('aisensy integration service', () => {
  it('webhookUrl uses public base when set', () => {
    const prev = process.env.API_PUBLIC_URL;
    process.env.API_PUBLIC_URL = 'https://api.example.com';
    expect(webhookUrl()).toBe('https://api.example.com/api/webhooks/aisensy');
    process.env.API_PUBLIC_URL = prev;
  });

  it('resolveTenantByWebhookSecret returns null without header', async () => {
    await expect(resolveTenantByWebhookSecret('')).resolves.toBeNull();
  });

  it('resolveTenantByVerifyToken returns null for unknown token', async () => {
    await expect(resolveTenantByVerifyToken('not-a-real-token')).resolves.toBeNull();
  });
});
