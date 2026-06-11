import React, { useState } from 'react';
import ArtistInquiriesTab from '../os/ArtistInquiriesTab';
import ArtistGigsTab from '../os/ArtistGigsTab';

export default function ArtistBookingsTab({ artistId, isPreview }) {
  const [section, setSection] = useState('inquiries');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 border-b border-[var(--color-bg-border)] pb-2">
        {[
          { id: 'inquiries', label: 'Inquiries' },
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
      {section === 'inquiries' ? (
        <ArtistInquiriesTab artistId={artistId} isPreview={isPreview} />
      ) : (
        <ArtistGigsTab artistId={artistId} isPreview={isPreview} />
      )}
    </div>
  );
}
