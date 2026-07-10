const fs = require('fs');
const path = require('path');
const { requirePageAccess } = require('../middleware/authMiddleware');
const { hasPageAccess } = require('../utils/pagePermissions');

describe('contact route access', () => {
  const routesPath = path.join(__dirname, '../routes/contactRoutes.js');
  const routesSource = fs.readFileSync(routesPath, 'utf8');
  const protectedBlock = routesSource.split('router.use(protect)')[1] || '';

  it('gates list/create/update with contacts page permission', () => {
    expect(protectedBlock).toMatch(/router\.get\('\/',\s*contactsPage,/);
    expect(protectedBlock).toMatch(/router\.post\('\/',\s*contactsPage,/);
    expect(protectedBlock).toMatch(/router\.put\('\/:id',\s*contactsPage,/);
  });

  it('gates delete with contacts page permission', () => {
    expect(protectedBlock).toMatch(/router\.delete\('\/:id',\s*contactsPage,/);
  });
});

describe('requirePageAccess(contacts)', () => {
  const guard = requirePageAccess('contacts');

  const mkRes = () => {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
  };

  it('allows users with contacts page key', () => {
    const next = jest.fn();
    const req = {
      user: { departmentId: { slug: 'sales', pagePermissions: ['contacts'] } },
    };
    guard(req, mkRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('blocks users without contacts page key', () => {
    const next = jest.fn();
    const res = mkRes();
    const req = {
      user: { departmentId: { slug: 'editor', pagePermissions: ['dashboard', 'projects'] } },
    };
    guard(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('hasPageAccess mirrors contacts guard expectation', () => {
    expect(
      hasPageAccess({ departmentId: { slug: 'editor', pagePermissions: ['dashboard'] } }, 'contacts')
    ).toBe(false);
    expect(
      hasPageAccess({ departmentId: { slug: 'sales', pagePermissions: ['contacts'] } }, 'contacts')
    ).toBe(true);
  });
});
