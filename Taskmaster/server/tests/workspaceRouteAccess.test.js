const fs = require('fs');
const path = require('path');
const { requirePageAccess } = require('../middleware/authMiddleware');
const { hasPageAccess } = require('../utils/pagePermissions');

const ROUTE_GATES = [
  { file: 'noteRoutes.js', pageKey: 'notes', constName: 'notesPage' },
  { file: 'scheduleRoutes.js', pageKey: 'schedule', constName: 'schedulePage' },
  { file: 'calendarRoutes.js', pageKey: 'calendar', constName: 'calendarPage' },
  { file: 'assetRoutes.js', pageKey: 'assets', constName: 'assetsPage' },
];

describe('workspace route page gates', () => {
  ROUTE_GATES.forEach(({ file, pageKey, constName }) => {
    describe(file, () => {
      const routesPath = path.join(__dirname, '../routes', file);
      const routesSource = fs.readFileSync(routesPath, 'utf8');

      it(`uses requirePageAccess('${pageKey}')`, () => {
        expect(routesSource).toMatch(new RegExp(`requirePageAccess\\('${pageKey}'\\)`));
        expect(routesSource).toMatch(new RegExp(`const ${constName} = requirePageAccess\\('${pageKey}'\\)`));
      });

      it('applies protect then page gate on router', () => {
        expect(routesSource).toMatch(/router\.use\(protect\)/);
        expect(routesSource).toMatch(new RegExp(`router\\.use\\(${constName}\\)`));
      });
    });
  });

  describe('logRoutes.js', () => {
    const routesPath = path.join(__dirname, '../routes/logRoutes.js');
    const routesSource = fs.readFileSync(routesPath, 'utf8');

    it('gates workspace log routes with logs page permission', () => {
      expect(routesSource).toMatch(/const logsPage = requirePageAccess\('logs'\)/);
      expect(routesSource).toMatch(/router\.use\(protect\)/);
      expect(routesSource).toMatch(/router\.use\(logsPage\)/);
    });

    it('keeps admin QA routes outside logs page gate', () => {
      const beforeLogsGate = routesSource.split('router.use(logsPage)')[0] || '';
      expect(beforeLogsGate).toMatch(/router\.get\('\/bug-report',\s*protect,\s*admin,/);
      expect(beforeLogsGate).toMatch(/router\.post\('\/run-qa',\s*protect,\s*admin,/);
      expect(beforeLogsGate).not.toMatch(/router\.get\('\/bug-report',\s*protect,\s*admin,\s*logsPage,/);
    });
  });
});

describe.each(['notes', 'schedule', 'calendar', 'logs', 'assets'])(
  'requirePageAccess(%s)',
  (pageKey) => {
    const guard = requirePageAccess(pageKey);

    const mkRes = () => {
      const res = {};
      res.status = jest.fn(() => res);
      res.json = jest.fn(() => res);
      return res;
    };

    it(`allows users with ${pageKey} page key`, () => {
      const next = jest.fn();
      const req = {
        user: { departmentId: { slug: 'standard', pagePermissions: [pageKey] } },
      };
      guard(req, mkRes(), next);
      expect(next).toHaveBeenCalled();
    });

    it(`blocks users without ${pageKey} page key`, () => {
      const next = jest.fn();
      const res = mkRes();
      const req = {
        user: { departmentId: { slug: 'editor', pagePermissions: ['dashboard', 'projects'] } },
      };
      guard(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it(`hasPageAccess mirrors ${pageKey} guard expectation`, () => {
      expect(hasPageAccess({ departmentId: { slug: 'editor', pagePermissions: ['dashboard'] } }, pageKey)).toBe(false);
      expect(hasPageAccess({ departmentId: { slug: 'standard', pagePermissions: [pageKey] } }, pageKey)).toBe(true);
    });
  }
);
