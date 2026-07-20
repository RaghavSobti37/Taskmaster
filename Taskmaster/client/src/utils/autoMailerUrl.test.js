import { describe, it, expect, afterEach } from 'vitest';

describe('autoMailerUrl', () => {
  const envBackup = { ...import.meta.env };

  afterEach(() => {
    Object.assign(import.meta.env, envBackup);
  });

  it('maps CoreKnot email authoring paths to Auto-Mailer routes', async () => {
    import.meta.env.VITE_AUTO_MAILER_URL = 'https://mailer.example.com/';
    const { buildAutoMailerUrl } = await import('./autoMailerUrl.js');

    expect(buildAutoMailerUrl('/emails/create')).toBe('https://mailer.example.com/campaigns/new');
    expect(buildAutoMailerUrl('/tsc/emails/templates')).toBe('https://mailer.example.com/templates');
    expect(buildAutoMailerUrl('/tsc/emails/profiles')).toBe('https://mailer.example.com/senders');
    expect(buildAutoMailerUrl('/tsc/emails/streams')).toBe('https://mailer.example.com/settings');
    expect(buildAutoMailerUrl('/tsc/emails/newsletter/send/123')).toBe('https://mailer.example.com/campaigns/new');
    expect(buildAutoMailerUrl('/data-hub')).toBe('https://mailer.example.com/audience');
    expect(buildAutoMailerUrl('/admin/data-hub')).toBe('https://mailer.example.com/audience');
    expect(buildAutoMailerUrl('/unsubscribe?email=a@example.com')).toBe('https://mailer.example.com/unsubscribe?email=a@example.com');
  });

  it('preserves campaign ids when redirecting campaign details', async () => {
    import.meta.env.VITE_AUTO_MAILER_URL = 'https://mailer.example.com';
    const { buildAutoMailerUrl } = await import('./autoMailerUrl.js');

    expect(buildAutoMailerUrl('/campaign/abc123')).toBe('https://mailer.example.com/campaigns/abc123');
    expect(buildAutoMailerUrl('/tsc/campaign/abc123')).toBe('https://mailer.example.com/campaigns/abc123');
  });

  it('falls back to production Auto-Mailer UI in production builds', async () => {
    import.meta.env.VITE_AUTO_MAILER_URL = '';
    import.meta.env.DEV = false;
    const { buildAutoMailerUrl } = await import('./autoMailerUrl.js');

    expect(buildAutoMailerUrl('/emails')).toBe('https://auto-mailer-blue.vercel.app');
  });
});
