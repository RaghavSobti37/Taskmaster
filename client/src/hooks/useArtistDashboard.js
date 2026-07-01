import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useArtist,
  useArtistPreview,
  useSyncArtistStats,
  useUpdateArtist,
  useDeleteArtist,
  useAddTrackedVideo,
  useCreateShareLink,
  useSetPrimaryConnection,
} from './useTaskmasterQueries';

export function useArtistDashboard(id, { isPreview = false } = {}) {
  const [searchParams] = useSearchParams();
  const shareToken = searchParams.get('token');

  const hasValidPreviewToken = isPreview && !!shareToken;
  const previewQuery = useArtistPreview(id, shareToken, hasValidPreviewToken);
  const artistQuery = useArtist(id, !isPreview);

  const artist = isPreview ? previewQuery.data : artistQuery.data;
  const isArtistLoading = isPreview
    ? (shareToken ? previewQuery.isLoading : false)
    : artistQuery.isLoading;
  const previewInvalid = isPreview && !shareToken;

  const connections = artist?.connections || [];
  const normalized = artist?.normalized;

  const connectedProviders = useMemo(() => {
    const mapProvider = (p) => (p === 'meta' ? 'instagram' : p);
    const active = connections
      .filter((c) => c.status === 'active' || c.accountHandle || c.metadata?.igAccountId)
      .map((c) => mapProvider(c.provider));
    if (active.length) return [...new Set(active)];
    const creds = artist?.oauthCredentials || {};
    const fallback = [];
    if (creds.spotify?.artistId) fallback.push('spotify');
    if (creds.youtube?.channelId) fallback.push('youtube');
    if (creds.meta?.igAccountId) fallback.push('instagram');
    return fallback;
  }, [connections, artist]);

  return {
    artist,
    isArtistLoading,
    previewInvalid,
    shareToken,
    connections,
    normalized,
    connectedProviders,
    syncMutation: useSyncArtistStats(),
    updateMutation: useUpdateArtist(),
    deleteMutation: useDeleteArtist(),
    addVideoMutation: useAddTrackedVideo(),
    shareLinkMutation: useCreateShareLink(),
    setPrimaryMutation: useSetPrimaryConnection(),
  };
}
