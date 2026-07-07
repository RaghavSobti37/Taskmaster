import React, { useState } from 'react';
import { X } from 'lucide-react';

export default function IntegrationConnectModal({ provider, open, onClose, onSubmit, loading, result, error }) {
  const [apiKey, setApiKey] = useState('');
  const [label, setLabel] = useState('');

  if (!open || !provider) return null;

  const usesApiKey = provider.authType === 'api_key';
  const isWebhook = provider.id === 'webhook_in';
  const isAisensy = provider.id === 'aisensy';
  const showSecrets = result?.secret || result?.webhookSecret;

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
      <div className="w-full max-w-md rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] p-5 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-black uppercase tracking-wider">Connect {provider.name}</h2>
          <button type="button" onClick={onClose} className="p-2 min-h-[44px] min-w-[44px]" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {error ? (
          <p className="text-xs text-rose-600 mb-3 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">{error}</p>
        ) : null}

        {provider.description ? (
          <p className="text-xs text-[var(--color-text-secondary)] mb-3 leading-relaxed">{provider.description}</p>
        ) : null}
        {provider.setupHint ? (
          <p className="text-[11px] text-[var(--color-text-muted)] mb-3 leading-relaxed">{provider.setupHint}</p>
        ) : null}

        {showSecrets ? (
          <div className="space-y-3 text-sm">
            <p className="text-[var(--color-text-secondary)]">
              Copy these into AiSensy dashboard now — shown once.
            </p>
            {result.webhookUrl ? (
              <div>
                <p className="text-[10px] font-bold uppercase text-[var(--color-text-muted)] mb-1">Webhook URL</p>
                <code className="block p-2 rounded bg-amber-50 border border-amber-200 break-all text-xs">{result.webhookUrl}</code>
              </div>
            ) : null}
            {result.webhookVerifyToken ? (
              <div>
                <p className="text-[10px] font-bold uppercase text-[var(--color-text-muted)] mb-1">Verify token</p>
                <code className="block p-2 rounded bg-amber-50 border border-amber-200 break-all text-xs">{result.webhookVerifyToken}</code>
              </div>
            ) : null}
            {(result.webhookSecret || result.secret) ? (
              <div>
                <p className="text-[10px] font-bold uppercase text-[var(--color-text-muted)] mb-1">Webhook secret</p>
                <code className="block p-2 rounded bg-amber-50 border border-amber-200 break-all text-xs">{result.webhookSecret || result.secret}</code>
              </div>
            ) : null}
            {result.inboundPath ? (
              <p className="text-xs text-[var(--color-text-muted)]">
                POST URL: <code>{result.inboundPath}</code>
              </p>
            ) : null}
            {isAisensy ? (
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                In AiSensy: Settings → Webhooks → paste URL, verify token, and secret header.
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
                  placeholder={isAisensy ? 'From AiSensy → API & Integrations' : undefined}
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
