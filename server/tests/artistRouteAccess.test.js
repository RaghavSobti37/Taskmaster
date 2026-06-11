const fs = require('fs');
const path = require('path');
const { isUserOnArtistTeam } = require('../middleware/authMiddleware');

describe('artist route access', () => {
  const routesPath = path.join(__dirname, '../domains/artists/routes.js');
  const routesSource = fs.readFileSync(routesPath, 'utf8');
  const protectedBlock = routesSource.split('router.use(protect)')[1] || '';

  it('gates roster list with artistOrAdmin', () => {
    expect(protectedBlock).toMatch(/router\.get\('\/',\s*artistOrAdmin,\s*artistController\.getArtists/);
  });

  it('gates artist detail and connections with artistTeamOrAdmin', () => {
    expect(protectedBlock).toMatch(/router\.get\('\/:id',\s*artistTeamOrAdmin,\s*artistController\.getArtistById/);
    expect(protectedBlock).toMatch(/router\.get\('\/:id\/connections',\s*artistTeamOrAdmin,\s*artistController\.getArtistConnections/);
  });

  it('requires auth for integrations config', () => {
    expect(routesSource).not.toMatch(/router\.get\('\/config\/integrations'[\s\S]*?\nrouter\.use\(protect\)/);
    expect(protectedBlock).toMatch(/router\.get\('\/config\/integrations',\s*artistOrAdmin,\s*artistController\.getIntegrationsConfig/);
  });

  it('gates portfolio summary with artistOrAdmin', () => {
    expect(protectedBlock).toMatch(/router\.get\('\/portfolio\/summary',\s*artistOrAdmin,\s*artistController\.getPortfolioSummary/);
  });

  it('gates instagram webhooks with socials membership', () => {
    expect(protectedBlock).toMatch(/router\.post\('\/:id\/webhooks\/subscribe',\s*artistMembershipAccess\('socials'\),\s*artistAnalyticsController\.enableInstagramWebhooks/);
  });
});

describe('isUserOnArtistTeam', () => {
  const user = { _id: 'abc123' };

  it('matches string ids and populated members', () => {
    expect(isUserOnArtistTeam(user, ['abc123'])).toBe(true);
    expect(isUserOnArtistTeam(user, [{ _id: 'abc123' }])).toBe(true);
    expect(isUserOnArtistTeam(user, ['other'])).toBe(false);
  });
});
