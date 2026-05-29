import React from 'react';
import { format } from 'date-fns';
import { Pin } from 'lucide-react';
import { Card } from '../ui';
import { usePinBoard } from '../../hooks/useTaskmasterQueries';
import { usePinBoardDraft } from './PinBoardContext';

const PinBoardMessages = () => {
  const { data: pins = [], isLoading } = usePinBoard();
  const { draft, loadPin } = usePinBoardDraft();

  return (
    <Card className="p-0 flex flex-col shadow-md overflow-hidden">
      <div className="p-3 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]">
        <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
          <Pin size={14} className="text-rose-500" /> Pin Board
        </h4>
        <p className="text-[9px] text-[var(--color-text-muted)] mt-0.5">Team pins — click to edit on the right</p>
      </div>

      <div className="p-2 space-y-1.5 max-h-[280px] overflow-y-auto">
        {isLoading && <p className="text-[10px] text-[var(--color-text-muted)] p-2">Loading...</p>}
        {!isLoading && pins.length === 0 && (
          <p className="text-[10px] text-[var(--color-text-muted)] italic text-center py-6">No pins yet</p>
        )}
        {pins.map((pin) => {
          const author = pin.updatedBy?.name || pin.createdBy?.name || 'Team';
          const avatar = pin.updatedBy?.avatar || pin.createdBy?.avatar;
          const dateLabel = format(new Date(pin.updatedAt || pin.createdAt), 'MMM d, yyyy');
          const isActive = draft.editingId === pin._id;

          return (
            <button
              key={pin._id}
              type="button"
              onClick={() => loadPin(pin)}
              className={`w-full text-left p-2.5 rounded-xl border border-[var(--color-bg-border)] hover:bg-[var(--color-bg-secondary)] transition-colors ${isActive ? 'ring-1 ring-rose-400 bg-[var(--color-bg-secondary)]' : ''}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-5 h-5 rounded-full bg-[var(--color-bg-workspace)] overflow-hidden shrink-0 text-[8px] font-bold flex items-center justify-center">
                  {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : author[0]}
                </div>
                <span className="text-[10px] font-bold truncate">{author}</span>
                <span className="text-[9px] text-[var(--color-text-muted)] ml-auto shrink-0">{dateLabel}</span>
              </div>
              {pin.title && <p className="text-[11px] font-bold truncate">{pin.title}</p>}
              <p className="text-[10px] text-[var(--color-text-secondary)] line-clamp-2">{pin.content}</p>
            </button>
          );
        })}
      </div>
    </Card>
  );
};

export default PinBoardMessages;
