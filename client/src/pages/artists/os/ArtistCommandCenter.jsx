import React from 'react';
import ArtistOverviewPanel from './ArtistOverviewPanel';

export default function ArtistCommandCenter({
  artist,
  normalized,
  connections = [],
  isPreview,
  isWorkspace = false,
  shareToken,
  artistId,
  onSync,
}) {
  return (
    <ArtistOverviewPanel
      artistId={artistId}
      artist={artist}
      normalized={normalized}
      connections={connections}
      isPreview={isPreview}
      isWorkspace={isWorkspace}
      shareToken={shareToken}
      onSync={onSync}
    />
  );
}
