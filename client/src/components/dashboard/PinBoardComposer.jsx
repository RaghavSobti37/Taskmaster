import React from 'react';
import { Pin, Save, Trash2 } from 'lucide-react';
import { DashboardWidgetShell, Button } from '../ui';
import {
  usePinBoard,
  useCreatePin,
  useUpdatePin,
  useDeletePin,
} from '../../hooks/useTaskmasterQueries';
import { useAuth } from '../../contexts/AuthContext';
import { usePinBoardDraft } from './PinBoardContext';

const PinBoardComposer = () => {
  const { user } = useAuth();
  const { data: pins = [] } = usePinBoard();
  const createPin = useCreatePin();
  const updatePin = useUpdatePin();
  const deletePin = useDeletePin();
  const { draft, setDraft, resetDraft } = usePinBoardDraft();

  const handleSave = () => {
    const payload = { title: draft.title.trim(), content: draft.content.trim() };
    if (!payload.content) return;
    if (draft.editingId) {
      updatePin.mutate({ id: draft.editingId, data: payload }, { onSuccess: resetDraft });
    } else {
      createPin.mutate(payload, { onSuccess: resetDraft });
    }
  };

  const saving = createPin.isPending || updatePin.isPending;
  const canDelete = draft.editingId && pins.find((p) => p._id === draft.editingId)?.createdBy?._id === user?._id;

  return (
    <DashboardWidgetShell
      className="shrink-0"
      bodyClassName="p-3 space-y-2"
      title="New Pin"
      icon={Pin}
    >
      <p className="text-[9px] text-[var(--color-text-muted)] -mt-1">Shared notes — visible to everyone</p>
      <input
        value={draft.title}
        onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
        placeholder="Title (optional)"
        className="w-full text-xs font-bold bg-transparent border-b border-[var(--color-bg-border)] py-1 outline-none"
      />
      <textarea
        value={draft.content}
        onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
        className="w-full text-[11px] min-h-[72px] bg-transparent border-0 border-b border-[var(--color-bg-border)] py-2 outline-none resize-y placeholder:text-[var(--color-text-muted)]"
        placeholder="Pin something for the team..."
      />
      <div className="flex items-center gap-2">
        <Button size="xs" onClick={handleSave} disabled={saving || !draft.content.trim()}>
          <Save size={12} className="mr-1" /> {draft.editingId ? 'Update' : 'Pin'}
        </Button>
        {draft.editingId && (
          <>
            <Button size="xs" variant="ghost" onClick={resetDraft}>Cancel</Button>
            {canDelete && (
              <button
                type="button"
                onClick={() => deletePin.mutate(draft.editingId, { onSuccess: resetDraft })}
                className="text-[10px] text-red-500 flex items-center gap-1 font-bold ml-auto"
              >
                <Trash2 size={12} /> Delete
              </button>
            )}
          </>
        )}
      </div>
    </DashboardWidgetShell>
  );
};

export default PinBoardComposer;
