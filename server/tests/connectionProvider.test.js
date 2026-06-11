const mongoose = require('mongoose');
const Artist = require('../models/Artist');
const ArtistConnection = require('../models/ArtistConnection');
const { getProvider, isLiveProvider, LIVE_PROVIDERS } = require('../domains/artists/providers');
const { buildConnectionHub } = require('../domains/artists/services/connectionHubService');
const { INTEGRATIONS } = require('../config/integrations.config');

describe('connection provider registry', () => {
  it('resolves live providers for spotify, youtube, instagram', () => {
    expect(LIVE_PROVIDERS).toEqual(expect.arrayContaining(['spotify', 'youtube', 'instagram']));
    expect(isLiveProvider('spotify')).toBe(true);
    expect(isLiveProvider('tiktok')).toBe(false);

    const spotify = getProvider('spotify');
    const youtube = getProvider('youtube');
    const instagram = getProvider('instagram');
    const tiktok = getProvider('tiktok');

    expect(spotify.platformId).toBe('spotify');
    expect(youtube.platformId).toBe('youtube');
    expect(instagram.platformId).toBe('instagram');
    expect(tiktok.getHealth()).toEqual(expect.objectContaining({ status: 'manual' }));
  });

  it('stub providers return coming_soon', async () => {
    const apple = getProvider('apple-music');
    expect(await apple.connect('artist')).toEqual({ status: 'coming_soon' });
    expect(await apple.syncAnalytics('artist', null)).toEqual({ status: 'coming_soon' });
    expect(apple.getHealth()).toEqual(expect.objectContaining({ status: 'coming_soon' }));
  });
});

describe('SpotifyProvider syncAnalytics', () => {
  it('returns error when no artist id on connection', async () => {
    const provider = getProvider('spotify');
    const result = await provider.syncAnalytics('artist-id', { accountHandle: '', metadata: {} });
    expect(result).toEqual(expect.objectContaining({ status: 'error', lastError: expect.stringContaining('Spotify') }));
  });

  it('syncs follower metrics with mocked Spotify API', async () => {
    const axios = require('axios');
    const spotifyTokenManager = require('../domains/artists/services/spotifyTokenManager');

    const tokenSpy = jest.spyOn(spotifyTokenManager, 'getSpotifyAccessToken').mockResolvedValue('test-token');
    const axiosSpy = jest.spyOn(axios, 'get').mockResolvedValue({
      data: {
        name: 'Test Artist',
        followers: { total: 42000 },
        popularity: 72,
        genres: ['pop'],
        images: [{ url: 'https://example.com/img.jpg' }],
      },
    });

    const provider = getProvider('spotify');
    const result = await provider.syncAnalytics('artist-id', {
      accountHandle: 'sp-artist-1',
      accountLabel: 'Test Artist',
      metadata: { artistId: 'sp-artist-1' },
    });

    expect(result.accountName).toBe('Test Artist');
    expect(result.accountId).toBe('sp-artist-1');
    expect(result.followers).toBe(42000);
    expect(result.metrics.popularity).toBe(72);

    tokenSpy.mockRestore();
    axiosSpy.mockRestore();
  });
});

describe('GET /connections/hub data shape', () => {
  it('returns full integrations catalog merged with connection state', async () => {
    const artist = await Artist.create({ name: 'Hub Test Artist' });
    await ArtistConnection.create({
      artistId: artist._id,
      provider: 'spotify',
      accountHandle: 'sp-123',
      accountLabel: 'Hub Test Artist',
      status: 'active',
    });

    const hub = await buildConnectionHub(artist._id);
    expect(hub).not.toBeNull();
    expect(hub.platforms).toHaveLength(INTEGRATIONS.length);
    expect(hub.categories.length).toBeGreaterThan(0);

    const spotify = hub.platforms.find((p) => p.id === 'spotify');
    expect(spotify.hubStatus).toBe('connected');
    expect(spotify.connection.accountHandle).toBe('sp-123');
    expect(spotify.health.status).toBe('active');

    const apple = hub.platforms.find((p) => p.id === 'apple-music');
    expect(apple.hubStatus).toBe('coming_soon');
  });
});

describe('connection hub routes registered', () => {
  const fs = require('fs');
  const path = require('path');
  const routesSource = fs.readFileSync(path.join(__dirname, '../domains/artists/routes.js'), 'utf8');

  it('mounts hub, health, sync, primary, and tracked-video behind socials permission', () => {
    expect(routesSource).toMatch(/router\.get\('\/:id\/connections\/hub',\s*artistMembershipAccess\('socials'\)/);
    expect(routesSource).toMatch(/router\.get\('\/:id\/connections\/health',\s*artistMembershipAccess\('socials'\)/);
    expect(routesSource).toMatch(/router\.post\('\/:id\/connections\/:platform\/sync',\s*artistMembershipAccess\('socials'\)/);
    expect(routesSource).toContain("artistMembershipAccess('socials'), connectionHubController.saveManualConnection");
    expect(routesSource).toMatch(/artistMembershipAccess\('socials'\),\s*validateParams\(artistConnectionParams\),\s*artistController\.setPrimaryConnection/);
    expect(routesSource).toMatch(/router\.post\('\/:id\/tracked-video',\s*artistMembershipAccess\('socials'\)/);
  });
});
