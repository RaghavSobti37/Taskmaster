const { rejectClientTenantSpoof } = require('../middleware/rejectClientTenantSpoof');

function mockRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
}

describe('rejectClientTenantSpoof', () => {
  const next = jest.fn();

  beforeEach(() => {
    next.mockClear();
  });

  it('allows POST /api/tenants/select when body tenant differs from session', () => {
    const req = {
      method: 'POST',
      originalUrl: '/api/tenants/select',
      body: { tenantId: 'tenant-b' },
      tenantId: 'tenant-a',
    };
    const res = mockRes();
    rejectClientTenantSpoof(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBeNull();
  });

  it('rejects cross-tenant tenantId on mutating routes', () => {
    const req = {
      method: 'PATCH',
      originalUrl: '/api/finance/doc-id/approve',
      body: { tenantId: 'tenant-b' },
      tenantId: 'tenant-a',
    };
    const res = mockRes();
    rejectClientTenantSpoof(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('TENANT_SPOOF_REJECTED');
  });

  it('rejects nested tenant identifiers in request bodies', () => {
    const req = {
      method: 'POST',
      originalUrl: '/api/crm/leads',
      body: { lead: { metadata: { organizationId: 'tenant-b' } } },
      tenantId: 'tenant-a',
    };
    const res = mockRes();
    rejectClientTenantSpoof(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('TENANT_SPOOF_REJECTED');
  });
});
