const {
  parseUploadthingToken,
  resolveUploadthingApiKey,
  validateUploadthingCredentials,
} = require('../utils/uploadthingCredentials');

describe('uploadthingCredentials', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.UPLOADTHING_TOKEN;
    delete process.env.UPLOADTHING_SECRET;
    delete process.env.UPLOADTHING_APP_ID;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('resolveUploadthingApiKey prefers TOKEN apiKey', () => {
    const token = Buffer.from(JSON.stringify({ apiKey: 'sk_token_key', appId: 'app1' })).toString('base64');
    process.env.UPLOADTHING_TOKEN = token;
    process.env.UPLOADTHING_SECRET = 'sk_secret_key';
    expect(resolveUploadthingApiKey()).toBe('sk_token_key');
  });

  test('resolveUploadthingApiKey falls back to SECRET', () => {
    process.env.UPLOADTHING_SECRET = 'sk_secret_only';
    expect(resolveUploadthingApiKey()).toBe('sk_secret_only');
  });

  test('validateUploadthingCredentials flags mismatched keys', () => {
    const token = Buffer.from(JSON.stringify({ apiKey: 'sk_a', appId: 'app1' })).toString('base64');
    process.env.UPLOADTHING_TOKEN = token;
    process.env.UPLOADTHING_SECRET = 'sk_b';
    const result = validateUploadthingCredentials();
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/does not match/);
  });

  test('validateUploadthingCredentials passes when aligned', () => {
    const apiKey = 'sk_live_abcdefghijklmnop';
    const token = Buffer.from(JSON.stringify({ apiKey, appId: 'app1' })).toString('base64');
    process.env.UPLOADTHING_TOKEN = token;
    process.env.UPLOADTHING_SECRET = apiKey;
    const result = validateUploadthingCredentials();
    expect(result.ok).toBe(true);
    expect(result.appId).toBe('app1');
    expect(result.keyFingerprint).toBe('sk_live_…klmnop');
  });

  test('parseUploadthingToken strips quotes', () => {
    const payload = { apiKey: 'sk_x', appId: 'app1' };
    const encoded = `"${Buffer.from(JSON.stringify(payload)).toString('base64')}"`;
    expect(parseUploadthingToken(encoded)).toEqual(payload);
  });
});
