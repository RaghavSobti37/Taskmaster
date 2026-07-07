const {
  originAllowed,
  buildAgentPrompt,
} = require('../../domains/forms/services/websiteFormService');

describe('website forms', () => {
  const form = {
    publishableKey: 'ckf_live_test123',
    allowedOrigins: ['https://example.com', 'http://localhost:3000'],
    honeypotField: '_gotcha',
    defaults: { source: 'Website Form' },
  };

  it('originAllowed matches configured origins', () => {
    expect(originAllowed(form, 'https://example.com')).toBe(true);
    expect(originAllowed(form, 'http://localhost:3000')).toBe(true);
    expect(originAllowed(form, 'https://evil.com')).toBe(false);
    expect(originAllowed(form, null)).toBe(true);
    expect(originAllowed({ allowedOrigins: [] }, 'https://example.com')).toBe(false);
  });

  it('buildAgentPrompt includes key and submit URL', () => {
    const prompt = buildAgentPrompt({ form, apiBase: 'https://api.coreknot.test' });
    expect(prompt).toContain('ckf_live_test123');
    expect(prompt).toContain('/api/public/forms/ckf_live_test123/submit');
    expect(prompt).toContain('Never put in frontend');
  });
});
