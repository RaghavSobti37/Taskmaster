import React from 'react';
import { format } from 'date-fns';
import { Pin } from 'lucide-react';
import { DashboardWidgetShell, DataListRow } from '../ui';
import { usePinBoard } from '../../hooks/useTaskmasterQueries';
import { usePinBoardDraft } from './PinBoardContext';

const PinBoardMessages = () => {
  const { data: pins = [], isLoading } = usePinBoard();
  const { draft, loadPin } = usePinBoardDraft();

  return (
    <DashboardWidgetShell
      bodyClassName="p-0 max-h-[280px] overflow-y-auto"
      title="Pin Board"
      icon={Pin}
    >
      <p className="text-[9px] text-[var(--color-text-muted)] px-4 pt-2 pb-1">Team pins — click to edit on the right</p>
      {isLoading && <p className="text-[10px] text-[var(--color-text-muted)] px-4 py-2">Loading...</p>}
      {!isLoading && pins.length === 0 && (
        <p className="text-[10px] text-[var(--color-text-muted)] italic text-center py-6">No pins yet</p>
      )}
      {pins.map((pin) => {
        const author = pin.updatedBy?.name || pin.createdBy?.name || 'Team';
        const avatar = pin.updatedBy?.avatar || pin.createdBy?.avatar;
        const dateLabel = format(new Date(pin.updatedAt || pin.createdAt), 'MMM d, yyyy');
        const isActive = draft.editingId === pin._id;

        return (
          <DataListRow
            key={pin._id}
            onClick={() => loadPin(pin)}
            accentColor={isActive ? '#fb7185' : undefined}
            className={isActive ? 'bg-[var(--color-bg-secondary)]' : ''}
            leading={
              <div className="w-5 h-5 rounded-full bg-[var(--color-bg-workspace)] overflow-hidden shrink-0 text-[8px] font-bold flex items-center justify-center">
                {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : author[0]}
              </div>
            }
            primary={
              <>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-bold truncate">{author}</span>
                  <span className="text-[9px] text-[var(--color-text-muted)] ml-auto shrink-0">{dateLabel}</span>
                </div>
                {pin.title && <p className="text-[11px] font-bold truncate mt-0.5">{pin.title}</p>}
              </>
            }
            secondary={
              <p className="text-[10px] text-[var(--color-text-secondary)] line-clamp-2">{pin.content}</p>
            }
          />
        );
      })}
    </DashboardWidgetShell>
  );
};

export default PinBoardMessages;
