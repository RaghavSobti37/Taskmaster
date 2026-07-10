import { stableJsonEqual } from '../hooks/useUnsavedChanges';

export function buildArtistEditForm(artist, connections = []) {
  if (!artist) return null;
  return {
    name: artist.name || '',
    bio: artist.bio || '',
    website: artist.website || '',
    spotifyId:
      artist.oauthCredentials?.spotify?.artistId
      || connections.find((c) => c.provider === 'spotify')?.accountHandle
      || '',
    youtubeId:
      artist.oauthCredentials?.youtube?.channelId
      || connections.find((c) => c.provider === 'youtube')?.accountHandle
      || '',
    instaId:
      artist.oauthCredentials?.meta?.igAccountId
      || connections.find((c) => c.provider === 'instagram')?.accountHandle
      || '',
  };
}

export function hasArtistEditChanges(draft, baseline) {
  if (!draft || !baseline) return false;
  return !stableJsonEqual(draft, baseline);
}
