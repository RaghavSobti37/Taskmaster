const {
  ENDPOINTS,
  summarizeEndpoint,
} = require('../scripts/auditCrmMailSmokeSupertest');

describe('auditCrmMailSmokeSupertest migration expectations', () => {
  it('treats deprecated CoreKnot mail endpoints as Auto-Mailer moved contracts', () => {
    const movedEndpoint = ENDPOINTS.find((ep) => ep.path === '/api/mail/templates');
    const summary = summarizeEndpoint(movedEndpoint, {
      status: 410,
      body: {
        service: 'auto-mailer',
        url: 'https://auto-mailer.example/templates',
      },
    });

    expect(summary).toEqual(expect.objectContaining({
      group: 'mail-moved',
      path: '/api/mail/templates',
      expected: 410,
      ok: true,
      autoMailerUrl: 'https://auto-mailer.example/templates',
    }));
  });

  it('allows stats proxy unavailability when Auto-Mailer API origin is not configured', () => {
    const statsEndpoint = ENDPOINTS.find((ep) => ep.path === '/api/mail/stats');
    const summary = summarizeEndpoint(statsEndpoint, {
      status: 503,
      body: { error: 'AUTO_MAILER_API_URL is not configured' },
    });

    expect(summary).toEqual(expect.objectContaining({
      group: 'mail',
      path: '/api/mail/stats',
      ok: true,
      note: expect.stringContaining('AUTO_MAILER_API_URL'),
    }));
  });

  it('treats deprecated Data Hub endpoints as Auto-Mailer moved contracts', () => {
    const movedEndpoint = ENDPOINTS.find((ep) => ep.path === '/api/data-hub/folders');
    const summary = summarizeEndpoint(movedEndpoint, {
      status: 410,
      body: {
        service: 'auto-mailer',
        url: 'https://auto-mailer.example/data-hub/folders',
      },
    });

    expect(summary).toEqual(expect.objectContaining({
      group: 'data-hub-moved',
      path: '/api/data-hub/folders',
      expected: 410,
      ok: true,
      autoMailerUrl: 'https://auto-mailer.example/data-hub/folders',
    }));
  });
});
