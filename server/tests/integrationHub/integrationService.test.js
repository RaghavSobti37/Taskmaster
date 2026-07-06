const webhookInAdapter = require('../../domains/integrations-hub/adapters/webhookInAdapter');
const { packCredentials, unpackCredentials } = require('../../domains/integrations-hub/services/integrationCredentialService');

describe('integration hub', () => {
  test('webhook signature round-trip', () => {
    const { secret } = webhookInAdapter.generateWebhookSecret();
    const body = JSON.stringify({ event: 'lead.ingest', person: { email: 'test@example.com' } });
    const crypto = require('crypto');
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
    expect(webhookInAdapter.verifySignature(secret, body, sig)).toBe(true);
    expect(webhookInAdapter.verifySignature(secret, body, 'bad')).toBe(false);
  });

  test('credential pack/unpack', () => {
    const packed = packCredentials({ accessToken: 'tok', refreshToken: 'ref' });
    const unpacked = unpackCredentials(packed);
    expect(unpacked.accessToken).toBe('tok');
    expect(unpacked.refreshToken).toBe('ref');
  });
});
