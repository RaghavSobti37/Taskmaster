import React from 'react';
import { Disc } from 'lucide-react';
import { Card } from '../../../components/ui';
import ArtistContentTab from '../os/ArtistContentTab';

export default function ArtistReleasesTab({ artistId, isPreview }) {
  return (
    <div className="space-y-4">
      <Card className="p-4 rounded-xl border border-[var(--color-bg-border)] bg-[var(--token-surface-2)]/50">
        <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
          <Disc size={16} />
          <p className="text-xs font-bold">
            Release hub coming soon — track singles, EPs, and album rollouts here.
          </p>
        </div>
      </Card>
      <ArtistContentTab artistId={artistId} isPreview={isPreview} />
    </div>
  );
}
