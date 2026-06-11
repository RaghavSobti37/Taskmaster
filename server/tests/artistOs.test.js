const {
  computeAnalyticsScores,
  sliceHistoryByTimeframe,
  parseBudgetFromText,
} = require('../domains/artists/services/artistOsService');

describe('artistOsService pure helpers', () => {
  test('parseBudgetFromText extracts numeric budget', () => {
    expect(parseBudgetFromText('Budget around 50000 INR')).toBe(50000);
    expect(parseBudgetFromText('')).toBe(0);
  });

  test('computeAnalyticsScores returns bounded scores', () => {
    const scores = computeAnalyticsScores(
      {
        normalized: { unified: { reach: 100000, growth: 12 } },
        analytics: { instagram: { engagementRate: 4 } },
      },
      { revenueMtd: 100000, expensesMtd: 20000, profitMtd: 80000 }
    );
    expect(scores.audienceScore).toBeGreaterThan(0);
    expect(scores.audienceScore).toBeLessThanOrEqual(100);
    expect(scores.monetizationScore).toBe(80);
  });

  test('sliceHistoryByTimeframe filters recent points', () => {
    const now = new Date();
    const old = new Date(now);
    old.setDate(old.getDate() - 60);
    const history = [
      { timestamp: old, metrics: { followers: 100 } },
      { timestamp: now, metrics: { followers: 200 } },
    ];
    const sliced = sliceHistoryByTimeframe(history, '28D');
    expect(sliced.length).toBe(1);
    expect(sliced[0].metrics.followers).toBe(200);
  });
});

describe('artist OS routes registered', () => {
  const fs = require('fs');
  const path = require('path');
  const routesSource = fs.readFileSync(path.join(__dirname, '../domains/artists/routes.js'), 'utf8');

  it('mounts overview endpoint before artist detail', () => {
    expect(routesSource).toMatch(/router\.get\('\/:id\/os\/overview'/);
    const overviewIdx = routesSource.indexOf("/:id/os/overview");
    const detailIdx = routesSource.indexOf("router.get('/:id', artistTeamOrAdmin");
    expect(overviewIdx).toBeGreaterThan(-1);
    expect(detailIdx).toBeGreaterThan(overviewIdx);
  });

  it('allows team members to read and write OS routes', () => {
    expect(routesSource).toMatch(/router\.get\('\/:id\/analytics\/:platform', artistTeamOrAdmin/);
    expect(routesSource).toMatch(/router\.post\('\/:id\/os\/inquiries', artistTeamOrAdmin/);
    expect(routesSource).toMatch(/router\.patch\('\/:id\/os\/gigs\/:gigId', artistTeamOrAdmin/);
    expect(routesSource).toMatch(/router\.post\('\/:id\/os\/calendar', artistTeamOrAdmin/);
  });

  it('gates calendar and analytics OS reads behind artistTeamOrAdmin', () => {
    expect(routesSource).toMatch(/router\.get\('\/:id\/os\/calendar', artistTeamOrAdmin/);
    expect(routesSource).toMatch(/router\.get\('\/:id\/os\/analytics\/scores', artistTeamOrAdmin/);
  });

  it('registers documents and structured 501 stubs', () => {
    expect(routesSource).toMatch(/router\.get\('\/:id\/os\/documents', artistTeamOrAdmin/);
    expect(routesSource).toMatch(/router\.post\('\/:id\/os\/documents', artistTeamOrAdmin/);
    expect(routesSource).toMatch(/router\.post\('\/:id\/os\/finance\/ocr', artistTeamOrAdmin/);
    expect(routesSource).toMatch(/router\.get\('\/:id\/os\/analytics\/demographics', artistTeamOrAdmin/);
  });
});
