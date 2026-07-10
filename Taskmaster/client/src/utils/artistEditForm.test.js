import { describe, expect, it } from 'vitest';
import { buildArtistEditForm, hasArtistEditChanges } from './artistEditForm';

describe('artistEditForm', () => {
  const artist = {
    _id: 'a1',
    name: 'YUGM',
    bio: 'YUGM official roster artist.',
    website: '',
    oauthCredentials: {
      meta: { igAccountId: '17841405536118240' },
    },
  };

  it('builds flat form snapshot from artist + connections', () => {
    expect(buildArtistEditForm(artist)).toEqual({
      name: 'YUGM',
      bio: 'YUGM official roster artist.',
      website: '',
      spotifyId: '',
      youtubeId: '',
      instaId: '17841405536118240',
    });
  });

  it('detects no changes when draft matches baseline', () => {
    const baseline = buildArtistEditForm(artist);
    expect(hasArtistEditChanges(baseline, baseline)).toBe(false);
  });

  it('detects changes against baseline, not full artist object', () => {
    const baseline = buildArtistEditForm(artist);
    expect(hasArtistEditChanges(baseline, artist)).toBe(true);
    expect(hasArtistEditChanges({ ...baseline, name: 'Edited' }, baseline)).toBe(true);
  });
});
