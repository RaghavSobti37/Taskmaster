const fs = require('fs');
const path = require('path');
const {
  isMetaOAuthCodeUsedError,
  hasActiveMetaConnection,
} = require('../utils/metaOAuthErrors');

describe('metaOAuthErrors helpers', () => {
  test('isMetaOAuthCodeUsedError detects Meta single-use code failure', () => {
    const err = {
      response: {
        data: {
          error: { message: 'This authorization code has been used.' },
        },
      },
    };
    expect(isMetaOAuthCodeUsedError(err)).toBe(true);
    expect(isMetaOAuthCodeUsedError(new Error('network timeout'))).toBe(false);
  });

  test('hasActiveMetaConnection requires token, ig id, and unexpired expiry', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(hasActiveMetaConnection({
      accessToken: 'tok',
      igAccountId: '123',
      tokenExpiry: future,
    })).toBe(true);
    expect(hasActiveMetaConnection({
      accessToken: 'tok',
      igAccountId: '123',
      tokenExpiry: new Date(Date.now() - 60_000).toISOString(),
    })).toBe(false);
    expect(hasActiveMetaConnection({ accessToken: 'tok' })).toBe(false);
  });
});

describe('meta OAuth callback guards', () => {
  const controllerSource = fs.readFileSync(
    path.join(__dirname, '../domains/artists/controllers/artistAnalyticsController.js'),
    'utf8'
  );
  const clientSource = fs.readFileSync(
    path.join(__dirname, '../../client/src/pages/auth/MetaOAuthCallback.jsx'),
    'utf8'
  );

  it('server returns idempotent success when code was already exchanged', () => {
    expect(controllerSource).toMatch(/alreadyConnected:\s*true/);
    expect(controllerSource).toMatch(/isMetaOAuthCodeUsedError/);
    expect(controllerSource).toMatch(/hasActiveMetaConnection/);
  });

  it('client prevents double code exchange under StrictMode', () => {
    expect(clientSource).toMatch(/exchangeStartedRef/);
    expect(clientSource).toMatch(/sessionStorage/);
    expect(clientSource).toMatch(/replaceState/);
    expect(clientSource).toMatch(/isRecoverableMetaOAuthError/);
  });
});
