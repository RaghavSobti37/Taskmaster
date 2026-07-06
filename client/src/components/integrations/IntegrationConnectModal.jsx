import React, { useState } from 'react';
import { X } from 'lucide-react';

export default function IntegrationConnectModal({ provider, open, onClose, onSubmit, loading, result }) {
  const [apiKey, setApiKey] = useState('');
  const [label, setLabel] = useState('');

  if (!open || !provider) return null;

  const usesApiKey = provider.authType === 'api_key';
  const isWebhook = provider.id === 'webhook_in';

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      provider: provider.id,
      apiKey: usesApiKey ? apiKey : undefined,
      label: label || provider.name,
      mode: isWebhook ? 'webhook' : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-md rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-black uppercase tracking-wider">Connect {provider.name}</h2>
          <button type="button" onClick={onClose} className="p-2 min-h-[44px] min-w-[44px]" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {result?.secret ? (
          <div className="space-y-3 text-sm">
            <p className="text-[var(--color-text-secondary)]">Copy webhook secret now — shown once.</p>
            <code className="block p-2 rounded bg-amber-50 border border-amber-200 break-all text-xs">{result.secret}</code>
            {result.inboundPath ? (
              <p className="text-xs text-[var(--color-text-muted)]">
                POST URL: <code>{result.inboundPath}</code>
              </p>
            ) : null}
            <button type="button" className="w-full py-2 rounded-lg bg-[var(--color-action-primary)] text-white text-xs font-bold" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="block text-xs font-semibold">
              Label
              <input
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm min-h-[44px]"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={provider.name}
              />
            </label>
            {usesApiKey ? (
              <label className="block text-xs font-semibold">
                API Key
                <input
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm min-h-[44px]"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  required
                />
              </label>
            ) : (
              <p className="text-xs text-[var(--color-text-secondary)]">
                You will be redirected to {provider.name} to authorize CoreKnot.
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 min-h-[44px] rounded-lg bg-[var(--color-action-primary)] text-white text-xs font-bold uppercase disabled:opacity-60"
            >
              {loading ? 'Connecting…' : isWebhook ? 'Create webhook' : usesApiKey ? 'Save key' : 'Continue to OAuth'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
