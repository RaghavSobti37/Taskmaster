jest.mock('../middleware/authMiddleware', () => ({
  resolveRequestUser: jest.fn(),
}));

const { resolveRequestUser } = require('../middleware/authMiddleware');
const { requireAuthenticatedUpload } = require('../utils/uploadAuth');
const { buildProxyRequestHeaders } = require('../utils/proxyHeaders');
const { spawnEnvForAdminScript } = require('../utils/adminScriptEnv');
const { qaProbeGate } = require('../middleware/qaProbeGate');
const { qaProbeStorage } = require('../utils/qaProbeContext');
const { buildVercelHeaders } = require('../../client/scripts/vercelSecurityHeaders.cjs');

describe('security hardening', () => {
  beforeEach(() => {
    resolveRequestUser.mockReset();
  });

  describe('requireAuthenticatedUpload', () => {
    it('rejects garbage tokens when session cannot be resolved', async () => {
      resolveRequestUser.mockResolvedValue({ user: null });
      const req = { headers: { authorization: 'Bearer not-a-real-session' } };
      await expect(requireAuthenticatedUpload(req)).rejects.toThrow(/Unauthorized/);
    });

    it('allows verified users', async () => {
      resolveRequestUser.mockResolvedValue({ user: { _id: 'abc123' } });
      const req = { headers: { authorization: 'Bearer valid' } };
      const meta = await requireAuthenticatedUpload(req);
      expect(meta.userId).toBe('abc123');
    });

    it('skips auth for UploadThing callbacks', async () => {
      const req = { headers: { 'uploadthing-hook': 'callback' } };
      const meta = await requireAuthenticatedUpload(req);
      expect(meta.userId).toBe('uploadthing-callback');
      expect(resolveRequestUser).not.toHaveBeenCalled();
    });
  });

  describe('buildProxyRequestHeaders', () => {
    it('does not forward cookie or authorization', () => {
      const headers = buildProxyRequestHeaders({
        accept: 'application/json',
        cookie: 'coreknot_token_v3=secret',
        authorization: 'Bearer secret',
        'x-trace-id': 'trace-1',
        host: 'evil.example',
      });
      expect(headers.cookie).toBeUndefined();
      expect(headers.authorization).toBeUndefined();
      expect(headers.host).toBeUndefined();
      expect(headers['x-trace-id']).toBe('trace-1');
    });
  });

  describe('spawnEnvForAdminScript', () => {
    it('omits JWT and API secrets', () => {
      const prev = { ...process.env };
      process.env.JWT_SECRET = 'super-secret';
      process.env.CLERK_SECRET_KEY = 'sk_live_x';
      process.env.MONGODB_URI = 'mongodb://localhost/test';
      const env = spawnEnvForAdminScript();
      expect(env.JWT_SECRET).toBeUndefined();
      expect(env.CLERK_SECRET_KEY).toBeUndefined();
      expect(env.MONGODB_URI).toBe('mongodb://localhost/test');
      process.env = prev;
    });
  });

  describe('qaProbeGate', () => {
    it('ignores probe header on strict production by default', (done) => {
      const prevTier = process.env.COREKNOT_DEPLOY_TIER;
      const prevFlag = process.env.QA_INTEGRATION_PROBE_ENABLED;
      process.env.COREKNOT_DEPLOY_TIER = 'production';
      delete process.env.QA_INTEGRATION_PROBE_ENABLED;

      const runSpy = jest.spyOn(qaProbeStorage, 'run').mockImplementation((_ctx, cb) => cb());

      const req = { headers: { 'x-qa-integration-probe': 'true' } };
      qaProbeGate(req, {}, () => {
        expect(runSpy).not.toHaveBeenCalled();
        runSpy.mockRestore();
        if (prevTier === undefined) delete process.env.COREKNOT_DEPLOY_TIER;
        else process.env.COREKNOT_DEPLOY_TIER = prevTier;
        if (prevFlag === undefined) delete process.env.QA_INTEGRATION_PROBE_ENABLED;
        else process.env.QA_INTEGRATION_PROBE_ENABLED = prevFlag;
        done();
      });
    });

    it('allows probe header on staging without extra env', (done) => {
      const prevTier = process.env.COREKNOT_DEPLOY_TIER;
      process.env.COREKNOT_DEPLOY_TIER = 'staging';

      const runSpy = jest.spyOn(qaProbeStorage, 'run').mockImplementation((_ctx, cb) => cb());

      const req = { headers: { 'x-qa-integration-probe': 'true' } };
      qaProbeGate(req, {}, () => {
        expect(runSpy).toHaveBeenCalled();
        runSpy.mockRestore();
        if (prevTier === undefined) delete process.env.COREKNOT_DEPLOY_TIER;
        else process.env.COREKNOT_DEPLOY_TIER = prevTier;
        done();
      });
    });
  });

  describe('buildVercelHeaders', () => {
    it('injects catch-all security headers', () => {
      const headers = buildVercelHeaders([]);
      expect(headers[0].source).toBe('/(.*)');
      expect(headers[0].headers.some((h) => h.key === 'Strict-Transport-Security')).toBe(true);
    });

    it('allows Google Identity Services in script-src and frame-src', () => {
      const headers = buildVercelHeaders([]);
      const csp = headers[0].headers.find((h) => h.key === 'Content-Security-Policy')?.value || '';
      expect(csp).toContain('https://accounts.google.com');
      expect(csp).toContain('https://*.google.com');
    });
  });
});
