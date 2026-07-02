const fs = require('fs');
const path = require('path');

describe('locked zones regression', () => {
  it('EMAIL_ENGINE_LOCKED doc exists', () => {
    const root = path.join(__dirname, '..', '..', 'docs', 'EMAIL_ENGINE_LOCKED.md');
    const ref = path.join(__dirname, '..', '..', 'docs', 'reference', 'EMAIL_ENGINE_LOCKED.md');
    const target = fs.existsSync(ref) ? ref : root;
    expect(fs.existsSync(target)).toBe(true);
    const content = fs.readFileSync(target, 'utf8');
    expect(content.length).toBeGreaterThan(50);
  });

  it('resend webhook handler exports remain stable', () => {
    const handler = require('../domains/mail/webhooks/resendWebhookHandler');
    expect(typeof handler.handleApiResendWebhook).toBe('function');
    expect(typeof handler.handleTrackResendWebhook).toBe('function');
  });

  it('brand logo asset path unchanged', () => {
    const candidates = [
      path.join(__dirname, '..', '..', 'client', 'public', 'logo.png'),
      path.join(__dirname, '..', '..', 'client', 'public', 'coreknot-logo.png'),
      path.join(__dirname, '..', '..', 'client', 'public', 'brand-mark.svg'),
      path.join(__dirname, '..', '..', 'client', 'public', 'favicon.svg'),
    ];
    expect(candidates.some((p) => fs.existsSync(p))).toBe(true);
  });

  it('CRM audit plugin still attached to Lead model', () => {
    const Lead = require('../domains/crm/models/Lead');
    const plugins = Lead.schema.plugins.map((p) => p.fn?.name || p.opts?.name || '');
    const hasAudit = Lead.schema.plugins.some((p) => {
      const src = p.fn?.toString() || '';
      return src.includes('CRMAudit') || src.includes('auditPlugin');
    });
    expect(hasAudit).toBe(true);
  });
});
