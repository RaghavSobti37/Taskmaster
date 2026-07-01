import { formatDisplayDate } from '../../utils/dateDisplay';
import React from 'react';
import { Pin, Trash2 } from 'lucide-react';
import DashboardWidgetShell from '../ui/DashboardWidgetShell';
import DataListRow from '../ui/DataListRow';
import { Skeleton } from '../ui/primitives';
import {
  usePinBoard,
  useDeletePin,
} from '../../hooks/useTaskmasterQueries';
import { usePinBoardDraft } from './PinBoardContext';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/confirmContext';
import { useToast } from '../../contexts/ToastContext';
import { canDeletePin } from '../../utils/pinBoardPermissions';

const PIN_BODY_MIN = 'min-h-[156px]';

const PinBoardMessages = () => {
  const { user } = useAuth();
  const { confirm } = useConfirm();
  const toast = useToast();
  const { data: pins = [], isLoading } = usePinBoard();
  const deletePin = useDeletePin();
  const { draft, loadPin, resetDraft } = usePinBoardDraft();

  const handleDelete = async (pin, event) => {
    event?.stopPropagation?.();
    const ok = await confirm({
      title: 'Delete pin?',
      message: 'This removes the pin for everyone on the team board.',
      confirmLabel: 'Delete',
      type: 'danger',
    });
    if (!ok) return;

    deletePin.mutate(pin._id, {
      onSuccess: () => {
        if (draft.editingId === pin._id) resetDraft();
        toast.success('Pin deleted');
      },
      onError: (err) => {
        toast.error(err.response?.data?.error || 'Failed to delete pin');
      },
    });
  };

  return (
    <DashboardWidgetShell
      bodyClassName={`p-0 min-h-[200px] max-h-[280px] overflow-y-auto ${PIN_BODY_MIN}`}
      title="Pin Board"
      icon={Pin}
    >
      <p className="text-[9px] text-[var(--color-text-muted)] px-4 pt-2 pb-1 shrink-0">
        Team pins — tap to edit; authors and admins can delete
      </p>
      {isLoading && (
        <div className={`divide-y divide-[var(--color-bg-border)] ${PIN_BODY_MIN}`}>
          {[1, 2, 3].map((j) => (
            <div key={j} className="flex gap-3 items-center py-2 px-4">
              <Skeleton variant="circle" width="20px" height="20px" />
              <div className="space-y-1 flex-1">
                <Skeleton width="60%" height="10px" />
                <Skeleton width="90%" height="10px" />
              </div>
            </div>
          ))}
        </div>
      )}
      {!isLoading && pins.length === 0 && (
        <p className={`text-[10px] text-[var(--color-text-muted)] italic text-center ${PIN_BODY_MIN} flex items-center justify-center`}>
          No pins yet
        </p>
      )}
      {!isLoading &&
        pins.map((pin) => {
        const author = pin.updatedBy?.name || pin.createdBy?.name || 'Team';
        const avatar = pin.updatedBy?.avatar || pin.createdBy?.avatar;
        const dateLabel = formatDisplayDate(new Date(pin.updatedAt || pin.createdAt));
        const isActive = draft.editingId === pin._id;
        const showDelete = canDeletePin(user, pin);

        return (
          <div key={pin._id} className="flex items-stretch min-w-0 border-b border-[var(--color-bg-border)] last:border-b-0">
            <DataListRow
              onClick={() => loadPin(pin)}
              accentColor={isActive ? '#fb7185' : undefined}
              className={`flex-1 min-w-0 border-0 ${isActive ? 'bg-[var(--color-bg-secondary)]' : ''}`}
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
            {showDelete && (
              <button
                type="button"
                onClick={(event) => handleDelete(pin, event)}
                disabled={deletePin.isPending}
                className="shrink-0 px-3 text-red-500 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
                aria-label="Delete pin"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        );
      })}
    </DashboardWidgetShell>
  );
};

export default PinBoardMessages;
