import React, { useMemo } from 'react';
import { Megaphone } from 'lucide-react';
import { Card, Button } from '../ui';
import { useAnnouncements } from '../../hooks/useTaskmasterQueries';
import { format } from 'date-fns';

const isActive = (item) => !item.expiresAt || new Date(item.expiresAt) >= new Date();

const AnnouncementsCard = () => {
  const { data = [], isLoading } = useAnnouncements(true);
  const rows = useMemo(
    () => data.filter(isActive).slice(0, 5),
    [data]
  );

  return (
    <Card className="p-5 space-y-4 shadow-md">
      <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-2">
        <Megaphone size={16} className="text-blue-500" /> Announcements
      </h4>
      <div className="space-y-3">
        {isLoading && <p className="text-xs text-[var(--color-text-muted)]">Loading announcements...</p>}
        {!isLoading && rows.length === 0 && (
          <p className="text-xs text-[var(--color-text-muted)]">No announcements yet.</p>
        )}
        {!isLoading && rows.map((item) => (
          <div key={item._id} className="rounded-xl p-3 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)]">
            <div className="flex items-center gap-2 mb-1">
              {item.createdBy?.avatar ? (
                <img src={item.createdBy.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <span className="w-5 h-5 rounded-full bg-[var(--color-bg-border)] text-[10px] font-bold flex items-center justify-center">
                  {item.createdBy?.name?.[0] || '?'}
                </span>
              )}
              <p className="text-[10px] font-semibold text-[var(--color-text-muted)]">
                {item.createdBy?.name || 'Team'}
              </p>
            </div>
            <p className="text-xs font-black">{item.title}</p>
            <p className="text-[11px] text-[var(--color-text-secondary)] line-clamp-2">{item.message}</p>
            {item.ctaText && item.ctaLink && (
              <a href={item.ctaLink} target="_blank" rel="noopener noreferrer" className="inline-block mt-2">
                <Button size="xs" variant="secondary">{item.ctaText}</Button>
              </a>
            )}
            <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
              {item.createdAt ? format(new Date(item.createdAt), 'MMM d, h:mm a') : ''}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default AnnouncementsCard;
