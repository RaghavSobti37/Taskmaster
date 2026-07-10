const {
  normalizeDspLinks,
  attachReleaseCorrelations,
} = require('../domains/artists/services/artistWorkspaceService');

describe('artistWorkspaceService helpers', () => {
  test('normalizeDspLinks accepts array and object formats', () => {
    expect(normalizeDspLinks([{ platform: 'spotify', url: 'https://open.spotify.com/track/1' }])).toEqual([
      { platform: 'spotify', url: 'https://open.spotify.com/track/1' },
    ]);
    expect(normalizeDspLinks({ spotify: 'https://open.spotify.com/track/1', apple: '' })).toEqual([
      { platform: 'spotify', url: 'https://open.spotify.com/track/1' },
    ]);
    expect(normalizeDspLinks(null)).toEqual([]);
  });

  test('attachReleaseCorrelations adds analytics when history exists', async () => {
    const ArtistMetrics = require('../models/ArtistMetrics');
    const ArtistContentRelease = require('../models/ArtistContentRelease');

    const releaseDate = new Date('2025-06-01');
    const before = new Date('2025-05-25');
    const after = new Date('2025-06-10');

    jest.spyOn(ArtistMetrics, 'findOne').mockReturnValue({
      select: () => ({
        lean: async () => ({
          analyticsHistory: [
            { timestamp: before, metrics: { spotify: { followers: 1000 } } },
            { timestamp: after, metrics: { spotify: { followers: 1200 } } },
          ],
        }),
      }),
    });
    jest.spyOn(ArtistContentRelease, 'find').mockReturnValue({
      select: () => ({
        lean: async () => [{ title: 'Single A', releaseDate, spotifyStreams: 5000, youtubeViews: 1000 }],
      }),
    });

    const enriched = await attachReleaseCorrelations('artist1', [
      { _id: 'rel1', title: 'Single A', releaseDate },
    ]);

    expect(enriched[0].analytics.hasCorrelation).toBe(true);
    expect(enriched[0].analytics.spotifyDelta).toBe(200);
    expect(enriched[0].analytics.spotifyStreams).toBe(5000);

    ArtistMetrics.findOne.mockRestore();
    ArtistContentRelease.find.mockRestore();
  });
});

describe('artist workspace routes registered', () => {
  const fs = require('fs');
  const path = require('path');
  const routesSource = fs.readFileSync(path.join(__dirname, '../domains/artists/routes.js'), 'utf8');

  it('gates assets and releases behind content permission', () => {
    expect(routesSource).toMatch(/router\.get\('\/:id\/os\/assets', artistMembershipAccess\('content'\)/);
    expect(routesSource).toMatch(/router\.post\('\/:id\/os\/releases', artistMembershipAccess\('content'\)/);
    expect(routesSource).toMatch(/router\.patch\('\/:id\/os\/assets\/:assetId', artistMembershipAccess\('content'\)/);
    expect(routesSource).toMatch(/router\.delete\('\/:id\/os\/releases\/:releaseId', artistMembershipAccess\('content'\)/);
  });

  it('gates booking OS routes behind booking permission', () => {
    expect(routesSource).toMatch(/router\.get\('\/:id\/os\/inquiries', artistMembershipAccess\('booking'\)/);
    expect(routesSource).toMatch(/router\.patch\('\/:id\/os\/inquiries\/:inquiryId', artistMembershipAccess\('booking'\)/);
  });
});
