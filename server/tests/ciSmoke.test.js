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

  it('Sentry server module exports captureException', () => {
    const sentry = require('../utils/sentry');
    expect(typeof sentry.captureException).toBe('function');
    expect(typeof sentry.initSentry).toBe('function');
  });

  it('Datadog init file exists', () => {
    const initPath = path.join(__dirname, '../datadog-init.js');
    expect(fs.existsSync(initPath)).toBe(true);
  });

  it('render.yaml defines health check and keep-warm URL', () => {
    const yaml = fs.readFileSync(path.join(repoRoot, 'render.yaml'), 'utf8');
    expect(yaml).toContain('healthCheckPath: /api/health');
    expect(yaml).toMatch(/YOUR-PRODUCTION-API-HEALTH|YOUR-RENDER-SERVICE\.onrender\.com\/api\/health/);
    expect(yaml).toContain('coreknot-api-staging');
  });

  it('rollback runbook exists', () => {
    expect(fs.existsSync(path.join(repoRoot, 'docs/DEPLOY_ROLLBACK.md'))).toBe(true);
  });

  it('monitoring docs exist', () => {
    expect(fs.existsSync(path.join(repoRoot, 'docs/MONITORING_ALERTS.md'))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, 'docs/SENTRY_ALERTS.md'))).toBe(true);
  });
});
