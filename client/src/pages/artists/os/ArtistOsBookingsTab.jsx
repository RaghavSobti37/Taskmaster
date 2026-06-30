import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Badge } from '../../../components/ui';
import ArtistCalendarTab from './ArtistCalendarTab';
import ArtistInquiriesTab from './ArtistInquiriesTab';
import ArtistGigsTab from './ArtistGigsTab';
import ArtistOsSubTabs from './ArtistOsSubTabs';
import { BOOKING_PIPELINE_STAGES } from './artistOsConstants';
import { useArtistOsInquiries } from '../../../hooks/queries/artistOs';

const SECTIONS = [
  { id: 'calendar', label: 'Calendar' },
  { id: 'inquiries', label: 'Inquiries' },
  { id: 'gigs', label: 'Gigs' },
];

const DEFAULT_SECTION = 'inquiries';

export default function ArtistOsBookingsTab({ artistId, isPreview }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionParam = searchParams.get('section') || DEFAULT_SECTION;
  const section = SECTIONS.some((s) => s.id === sectionParam) ? sectionParam : DEFAULT_SECTION;

  const { data: inquiries = [] } = useArtistOsInquiries(artistId, !!artistId && !isPreview);

  const stageCounts = useMemo(() => {
    const counts = Object.fromEntries(BOOKING_PIPELINE_STAGES.map((s) => [s.id, 0]));
    inquiries.forEach((inq) => {
      if (counts[inq.status] != null) counts[inq.status] += 1;
    });
    return counts;
  }, [inquiries]);

  const setSection = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'bookings');
    next.set('section', id);
    setSearchParams(next, { replace: true });
  };

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

      <ArtistOsSubTabs tabs={SECTIONS} activeId={section} onChange={setSection} />

      {section === 'calendar' && <ArtistCalendarTab artistId={artistId} isPreview={isPreview} />}
      {section === 'inquiries' && <ArtistInquiriesTab artistId={artistId} isPreview={isPreview} />}
      {section === 'gigs' && <ArtistGigsTab artistId={artistId} isPreview={isPreview} />}
    </div>
  );
}
