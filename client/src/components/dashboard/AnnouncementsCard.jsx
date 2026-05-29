import React, { useMemo } from 'react';
import { Megaphone } from 'lucide-react';
import { Card, Button } from '../ui';
import { useAnnouncements } from '../../hooks/useTaskmasterQueries';
import { format } from 'date-fns';

const isActive = (item) => !item.expiresAt || new Date(item.expiresAt) >= new Date();

const AnnouncementsCard = () => {
  const { data = [], isLoading } = useAnnouncements(true);
  const rows = useMemo(
    () => data.filter(isActive).slice(0, 8),
    [data]
  );

  return (
    <Card className="p-0 flex flex-col shadow-md overflow-hidden shrink-0">
      <div className="p-3 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]">
        <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
          <Megaphone size={14} className="text-blue-500" /> Announcements
        </h4>
        <p className="text-[9px] text-[var(--color-text-muted)] mt-0.5">Team updates from management</p>
      </div>

      <div className="p-2 space-y-1.5 max-h-[min(40vh,16rem)] overflow-y-auto">
        {isLoading && <p className="text-[10px] text-[var(--color-text-muted)] p-2">Loading...</p>}
        {!isLoading && rows.length === 0 && (
          <p className="text-[10px] text-[var(--color-text-muted)] italic text-center py-6">No announcements yet</p>
        )}
        {rows.map((item) => {
          const author = item.createdBy?.name || 'Team';
          const avatar = item.createdBy?.avatar;
          const dateLabel = item.createdAt
            ? format(new Date(item.createdAt), 'MMM d, yyyy')
            : '';

          return (
            <div
              key={item._id}
              className="w-full text-left p-2.5 rounded-xl border border-[var(--color-bg-border)] hover:bg-[var(--color-bg-secondary)] transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-5 h-5 rounded-full bg-[var(--color-bg-workspace)] overflow-hidden shrink-0 text-[8px] font-bold flex items-center justify-center">
                  {avatar ? (
                    <img src={avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    author[0]
                  )}
                </div>
                <span className="text-[10px] font-bold truncate">{author}</span>
                <span className="text-[9px] text-[var(--color-text-muted)] ml-auto shrink-0">{dateLabel}</span>
              </div>
              {item.title && <p className="text-[11px] font-bold truncate">{item.title}</p>}
              <p className="text-[10px] text-[var(--color-text-secondary)] line-clamp-2">{item.message}</p>
              {item.ctaText && item.ctaLink && (
                <a href={item.ctaLink} target="_blank" rel="noopener noreferrer" className="inline-block mt-1.5">
                  <Button size="xs" variant="secondary">{item.ctaText}</Button>
                </a>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default AnnouncementsCard;
