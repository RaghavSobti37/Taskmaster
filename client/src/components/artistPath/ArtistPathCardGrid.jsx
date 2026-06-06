import React from 'react';
import { Music, Mail, MapPin, Calendar } from 'lucide-react';
import { Badge, Card } from '../ui/primitives';
import { displayRespondentName, displayStageBadge } from '../../utils/artistPathDisplay';

function formatDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return String(d);
  }
}

export default function ArtistPathCardGrid({ people = [], onSelect, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-36 rounded-xl bg-[var(--color-bg-secondary)] animate-pulse" />
        ))}
      </div>
    );
  }

  if (!people.length) {
    return (
      <div className="text-center py-16 text-[var(--color-text-muted)]">
        <Music size={32} className="mx-auto mb-3 opacity-40" />
        <p className="text-sm font-medium">No Artist Path respondents yet</p>
        <p className="text-xs mt-1">Submissions appear here via website webhook, or use Sync from Sheet to backfill</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {people.map((person) => {
        const id = person.personId || person._id;
        const displayName = displayRespondentName({
          name: person.name,
          email: person.email,
          latestArtistType: person.latestArtistType,
        });
        const stageBadge = displayStageBadge({ latestArtistType: person.latestArtistType });

        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect?.(id)}
            className="text-left group"
          >
            <Card className="p-4 h-full transition-all hover:border-[var(--color-action-primary)] hover:shadow-md">
              <div className="flex items-start justify-between gap-2 mb-2 min-w-0">
                <h3 className="font-bold text-sm truncate group-hover:text-[var(--color-action-primary)]">
                  {displayName}
                </h3>
                {stageBadge && (
                  <Badge variant="mint" className="shrink-0 text-[9px] max-w-[40%] truncate">
                    {stageBadge}
                  </Badge>
                )}
              </div>
              {person.email && (
                <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-1 truncate mb-1">
                  <Mail size={11} className="shrink-0" /> {person.email}
                </p>
              )}
              {person.city && (
                <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-1 mb-2 truncate">
                  <MapPin size={11} className="shrink-0" /> {person.city}
                </p>
              )}
              <div className="flex items-center justify-between text-[10px] text-[var(--color-text-muted)] mt-auto pt-2 border-t border-[var(--color-bg-border)]">
                <span className="flex items-center gap-1">
                  <Calendar size={10} /> {formatDate(person.lastActivityAt)}
                </span>
                {(person.artistPathResponseCount ?? 0) > 1 && (
                  <Badge variant="neutral">{person.artistPathResponseCount} responses</Badge>
                )}
              </div>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
