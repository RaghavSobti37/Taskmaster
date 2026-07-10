import React from 'react';
import ArtistOverviewPanel from '../../os/ArtistOverviewPanel';

export default function ArtistWorkspaceHome({
  artistId,
  artist,
  normalized,
  connections = [],
  membership,
  isPreview = false,
  onSync,
}) {
  return (
    <ArtistOverviewPanel
      artistId={artistId}
      artist={artist}
      normalized={normalized}
      connections={connections}
      isPreview={isPreview}
      isWorkspace
      membership={membership}
      onSync={onSync}
    />
  );
}
