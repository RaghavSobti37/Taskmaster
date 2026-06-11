import React, { useMemo, useState } from 'react';
import { Card, Badge } from '../../../components/ui';
import ArtistInquiriesTab from '../os/ArtistInquiriesTab';
import ArtistGigsTab from '../os/ArtistGigsTab';
import { BOOKING_PIPELINE_STAGES } from '../os/artistOsConstants';
import { useArtistOsInquiries } from '../../../hooks/queries/artistOs';

export default function ArtistBookingsTab({ artistId, isPreview }) {
  const [section, setSection] = useState('pipeline');
  const { data: inquiries = [] } = useArtistOsInquiries(artistId, !!artistId && !isPreview);

  const stageCounts = useMemo(() => {
    const counts = Object.fromEntries(BOOKING_PIPELINE_STAGES.map((s) => [s.id, 0]));
    inquiries.forEach((inq) => {
      if (counts[inq.status] != null) counts[inq.status] += 1;
    });
    return counts;
  }, [inquiries]);

  return (
    <div className="space-y-4">
      <Card className="p-4 rounded-xl border border-[var(--color-bg-border)]">
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-3">Booking Pipeline</p>
        <div className="flex flex-wrap gap-2">
          {BOOKING_PIPELINE_STAGES.map((stage) => (
            <div key={stage.id} className="flex items-center gap-1.5">
              <Badge variant={stage.variant}>{stage.label}</Badge>
              <span className="text-xs font-bold tabular-nums text-[var(--color-text-muted)]">{stageCounts[stage.id]}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap gap-1 border-b border-[var(--color-bg-border)] pb-2">
        {[
          { id: 'pipeline', label: 'Inquiries' },
          { id: 'gigs', label: 'Gigs' },
        ].map((tab) => {
          const active = section === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSection(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors ${
                active
                  ? 'bg-[var(--token-surface-2)] text-[var(--color-text-primary)] border border-[var(--color-action-primary)]/30'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--token-surface-2)]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {section === 'pipeline' ? (
        <ArtistInquiriesTab artistId={artistId} isPreview={isPreview} />
      ) : (
        <ArtistGigsTab artistId={artistId} isPreview={isPreview} />
      )}
    </div>
  );
}
