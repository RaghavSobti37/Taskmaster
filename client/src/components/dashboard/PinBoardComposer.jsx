import React from 'react';
import { Pin, Save, Trash2 } from 'lucide-react';
import { Card, Button } from '../ui';
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
    <Card className="p-0 flex flex-col shadow-md overflow-hidden shrink-0">
      <div className="p-3 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]">
        <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
          <Pin size={14} className="text-rose-500" /> New Pin
        </h4>
        <p className="text-[9px] text-[var(--color-text-muted)] mt-0.5">Shared notes — visible to everyone</p>
      </div>

      <div className="p-3 space-y-2 bg-[var(--color-bg-workspace)]/40">
        <input
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          placeholder="Title (optional)"
          className="w-full text-xs font-bold bg-transparent border-b border-[var(--color-bg-border)] py-1 outline-none"
        />
        <textarea
          value={draft.content}
          onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
          className="w-full text-[11px] min-h-[72px] bg-[var(--color-bg-workspace)] rounded-lg p-2 border border-[var(--color-bg-border)] outline-none resize-y"
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
      </div>
    </Card>
  );
};

export default PinBoardComposer;
