const { redactValue, summarizeBody } = require('../utils/securityAuditRedact');
const { writeSecurityAudit } = require('../services/securityAuditService');
const SecurityAudit = require('../models/SecurityAudit');

describe('securityAudit', () => {
  beforeEach(async () => {
    await SecurityAudit.deleteMany();
  });

  it('redacts sensitive keys in payloads', () => {
    const out = redactValue({ email: 'a@b.com', password: 'secret', nested: { token: 'x' } });
    expect(out.password).toBe('[REDACTED]');
    expect(out.nested.token).toBe('[REDACTED]');
    expect(out.email).toBe('a@b.com');
  });

  it('summarizeBody redacts request bodies', () => {
    const body = summarizeBody({ newPassword: 'abc', departmentId: '507f1f77bcf86cd799439011' });
    expect(body.newPassword).toBe('[REDACTED]');
    expect(body.departmentId).toBe('507f1f77bcf86cd799439011');
  });

  it('writeSecurityAudit persists entries', async () => {
    await writeSecurityAudit({
      action: 'APPROVE',
      resourceType: 'Finance',
      resourceId: 'doc1',
      actorEmail: 'admin@example.com',
      method: 'PATCH',
      path: '/api/finance/doc1/approve',
    });
    const rows = await SecurityAudit.find().lean();
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe('APPROVE');
  });
});
