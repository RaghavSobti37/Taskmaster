const request = require('supertest');
const app = require('../server');
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '../..');

describe('CI production readiness smoke', () => {
  it('health endpoint responds', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBeLessThan(600);
    expect(res.body).toHaveProperty('ok');
  });

  it('openapi spec is served', async () => {
    const res = await request(app).get('/api/openapi.json');
    expect(res.statusCode).toBe(200);
    expect(res.body.paths).toHaveProperty('/health');
    expect(res.body.paths).toHaveProperty('/auth/login');
  });

  it('system-logs route removed', async () => {
    const res = await request(app).get('/api/system-logs');
    expect(res.statusCode).toBe(404);
  });

  it('Pino structured logger is configured', () => {
    const logger = require('../utils/logger');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.info).toBe('function');
  });

  it('PostHog server module exports captureEvent', () => {
    const posthog = require('../utils/posthog');
    expect(typeof posthog.captureEvent).toBe('function');
    expect(typeof posthog.initPostHog).toBe('function');
  });

  it('render.yaml defines health check', () => {
    const yaml = fs.readFileSync(path.join(repoRoot, 'render.yaml'), 'utf8');
    expect(yaml).toContain('healthCheckPath: /api/health');
    expect(yaml).toContain('CoreKnot-api');
    expect(yaml).not.toContain('coreknot-api-staging');
  });

  it('rollback runbook exists', () => {
    expect(fs.existsSync(path.join(repoRoot, 'docs/operations/DEPLOY_ROLLBACK.md'))).toBe(true);
  });

  it('Render logging doc exists', () => {
    expect(fs.existsSync(path.join(repoRoot, 'docs/operations/RENDER_LOGGING.md'))).toBe(true);
  });

  it('monitoring docs exist', () => {
    expect(fs.existsSync(path.join(repoRoot, 'docs/operations/MONITORING_ALERTS.md'))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, 'docs/operations/observability.md'))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, 'docs/operations/incident-response.md'))).toBe(true);
  });
});
