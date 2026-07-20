const request = require('supertest');
const express = require('express');
const router = require('../routes/deprecatedAutoMailerRoutes');

describe('deprecatedAutoMailerRoutes', () => {
  const originalUrl = process.env.AUTO_MAILER_URL;

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.AUTO_MAILER_URL;
    else process.env.AUTO_MAILER_URL = originalUrl;
  });

  function app() {
    const testApp = express();
    testApp.use(express.json());
    testApp.use('/api/campaigns', router);
    testApp.use('/api/newsletter', router);
    return testApp;
  }

  test('redirects browser GETs to Auto-Mailer deep links', async () => {
    process.env.AUTO_MAILER_URL = 'https://mailer.example.com';
    const res = await request(app()).get('/api/campaigns/abc123').set('Accept', 'text/html');

    expect(res.statusCode).toBe(308);
    expect(res.headers.location).toBe('https://mailer.example.com/campaigns/abc123');
  });

  test('returns JSON moved contract for API writes', async () => {
    process.env.AUTO_MAILER_URL = 'https://mailer.example.com';
    const res = await request(app()).post('/api/newsletter/issues/issue1/send').send({});

    expect(res.statusCode).toBe(410);
    expect(res.body).toEqual(expect.objectContaining({
      service: 'auto-mailer',
      url: 'https://mailer.example.com/campaigns/new',
    }));
  });
});
