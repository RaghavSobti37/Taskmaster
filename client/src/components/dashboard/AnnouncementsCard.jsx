import React, { useMemo } from 'react';
import { Megaphone } from 'lucide-react';
import { DashboardWidgetShell, DataListRow, Button } from '../ui';
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
    <DashboardWidgetShell
      className="shrink-0"
      bodyClassName="p-0 max-h-[min(40vh,16rem)] overflow-y-auto"
      title="Announcements"
      icon={Megaphone}
    >
      <p className="text-[9px] text-[var(--color-text-muted)] px-4 pt-2 pb-1">Team updates from management</p>
      {isLoading && <p className="text-[10px] text-[var(--color-text-muted)] px-4 py-2">Loading...</p>}
      {!isLoading && rows.length === 0 && (
        <p className="text-[10px] text-[var(--color-text-muted)] italic text-center py-6">No announcements yet</p>
      )}
      {!isLoading && rows.map((item) => {
        const author = item.createdBy?.name || 'Team';
        const avatar = item.createdBy?.avatar;
        const dateLabel = item.createdAt
          ? format(new Date(item.createdAt), 'MMM d, yyyy')
          : '';

        return (
          <DataListRow
            key={item._id}
            leading={
              <div className="w-5 h-5 rounded-full bg-[var(--color-bg-workspace)] overflow-hidden shrink-0 text-[8px] font-bold flex items-center justify-center">
                {avatar ? (
                  <img src={avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  author[0]
                )}
              </div>
            }
            primary={
              <>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-bold truncate">{author}</span>
                  <span className="text-[9px] text-[var(--color-text-muted)] ml-auto shrink-0">{dateLabel}</span>
                </div>
                {item.title && <p className="text-[11px] font-bold truncate mt-0.5">{item.title}</p>}
              </>
            }
            secondary={
              <>
                <p className="text-[10px] text-[var(--color-text-secondary)] whitespace-pre-wrap break-words">{item.message}</p>
                {item.ctaText && item.ctaLink && (
                  <a href={item.ctaLink} target="_blank" rel="noopener noreferrer" className="inline-block mt-1.5">
                    <Button size="xs" variant="secondary">{item.ctaText}</Button>
                  </a>
                )}
              </>
            }
          />
        );
      })}
    </DashboardWidgetShell>
  );
};

export default AnnouncementsCard;
