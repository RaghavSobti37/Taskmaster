import React, { useState } from 'react';
import { X } from 'lucide-react';

export default function IntegrationDetailDrawer({ open, connection, provider, onClose, onSave, saving }) {
  const [syncOut, setSyncOut] = useState(connection?.metadata?.syncOut === true);

  if (!open || !connection) return null;

  const isCrm = provider?.category === 'crm';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <div className="w-full max-w-md h-full bg-[var(--color-bg-primary)] border-l border-[var(--color-bg-border)] p-5 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-black uppercase tracking-wider">{provider?.name || connection.provider} settings</h2>
          <button type="button" onClick={onClose} className="p-2 min-h-[44px] min-w-[44px]" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {connection.metadata?.inboundPath ? (
          <div className="mb-4 p-3 rounded-lg border text-xs">
            <p className="font-semibold mb-1">Inbound URL</p>
            <code className="break-all">{connection.metadata.inboundPath}</code>
          </div>
        ) : null}

        {isCrm ? (
          <label className="flex items-center gap-2 text-sm mb-4">
            <input
              type="checkbox"
              checked={syncOut}
              onChange={(e) => setSyncOut(e.target.checked)}
            />
            Push new CoreKnot leads to {provider.name}
          </label>
        ) : null}

        <button
          type="button"
          disabled={saving}
          className="w-full py-2 min-h-[44px] rounded-lg bg-[var(--color-action-primary)] text-white text-xs font-bold uppercase"
          onClick={() => onSave({ metadata: { ...connection.metadata, syncOut } })}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
