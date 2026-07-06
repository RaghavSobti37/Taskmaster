import React from 'react';
import { Badge } from '../ui';
import IntegrationProviderLogo from './IntegrationProviderLogo';

const STATUS_VARIANT = {
  connected: 'success',
  error: 'destructive',
  reauth_required: 'warning',
  disconnected: 'default',
};

export default function IntegrationCard({
  provider,
  connection,
  onConnect,
  onDisconnect,
  onHealth,
  onSync,
  onConfigure,
}) {
  const status = connection?.status || 'disconnected';
  const isConnected = status === 'connected';

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border border-[var(--color-bg-border)] rounded-xl bg-[var(--color-bg-primary)] hover:border-[var(--color-action-primary)]/25 transition-colors">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <IntegrationProviderLogo providerId={provider.id} name={provider.name} />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm text-[var(--color-text-primary)]">{provider.name}</h3>
            <Badge variant={STATUS_VARIANT[status] || 'default'}>{status.replace('_', ' ')}</Badge>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-1 capitalize">{provider.category}</p>
          {connection?.label ? (
            <p className="text-xs text-[var(--color-text-secondary)] mt-1 truncate">{connection.label}</p>
          ) : null}
          {connection?.lastSyncAt ? (
            <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
              Last sync: {new Date(connection.lastSyncAt).toLocaleString()}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 shrink-0">
        {!isConnected ? (
          <button
            type="button"
            className="px-3 py-2 min-h-[44px] rounded-lg bg-[var(--color-action-primary)] text-white text-xs font-bold uppercase"
            onClick={() => onConnect(provider)}
          >
            Connect
          </button>
        ) : (
          <>
            {provider.capabilities?.includes('sync_contacts') || provider.capabilities?.includes('sync_audiences') ? (
              <button
                type="button"
                className="px-3 py-2 min-h-[44px] rounded-lg border border-[var(--color-bg-border)] text-xs font-bold uppercase"
                onClick={() => onSync(connection)}
              >
                Sync
              </button>
            ) : null}
            <button
              type="button"
              className="px-3 py-2 min-h-[44px] rounded-lg border border-[var(--color-bg-border)] text-xs font-bold uppercase"
              onClick={() => onHealth(connection)}
            >
              Test
            </button>
            {onConfigure ? (
              <button
                type="button"
                className="px-3 py-2 min-h-[44px] rounded-lg border border-[var(--color-bg-border)] text-xs font-bold uppercase"
                onClick={() => onConfigure(connection, provider)}
              >
                Settings
              </button>
            ) : null}
            <button
              type="button"
              className="px-3 py-2 min-h-[44px] rounded-lg border border-rose-500/40 text-rose-600 text-xs font-bold uppercase"
              onClick={() => onDisconnect(connection)}
            >
              Disconnect
            </button>
          </>
        )}
      </div>
    </div>
  );
}
