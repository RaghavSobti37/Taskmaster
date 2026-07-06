import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plug, Code2, ArrowRight, Key, Webhook, FileJson, ExternalLink } from 'lucide-react';
import { QueryErrorBanner, getQueryErrorMessage } from '../../../components/ui';
import IntegrationCard from '../../../components/integrations/IntegrationCard';
import IntegrationConnectModal from '../../../components/integrations/IntegrationConnectModal';
import IntegrationDetailDrawer from '../../../components/integrations/IntegrationDetailDrawer';
import {
  useIntegrationProviders,
  useConnectIntegration,
  useDisconnectIntegration,
  useIntegrationHealth,
  useIntegrationSync,
  usePatchIntegrationMetadata,
} from '../../../hooks/queries/integrations';

const CATEGORY_ORDER = ['email', 'marketing', 'crm', 'custom'];

const CATEGORY_LABELS = {
  email: 'Email',
  marketing: 'Marketing',
  crm: 'CRM',
  custom: 'Custom',
};

export default function IntegrationsTab() {
  const [searchParams] = useSearchParams();
  const { data, error, isLoading } = useIntegrationProviders();
  const connect = useConnectIntegration();
  const disconnect = useDisconnectIntegration();
  const health = useIntegrationHealth();
  const sync = useIntegrationSync();
  const patchMeta = usePatchIntegrationMetadata();

  const [modalProvider, setModalProvider] = useState(null);
  const [connectResult, setConnectResult] = useState(null);
  const [detail, setDetail] = useState(null);

  const connectedBanner = searchParams.get('connected');
  const connectError = searchParams.get('connect_error');

  const grouped = useMemo(() => {
    const providers = data?.providers || [];
    return CATEGORY_ORDER.map((cat) => ({
      category: cat,
      label: CATEGORY_LABELS[cat],
      items: providers.filter((p) => p.category === cat && p.connectMethod !== 'outbound_only'),
    })).filter((g) => g.items.length);
  }, [data]);

  const handleConnectSubmit = async (payload) => {
    setConnectResult(null);
    const result = await connect.mutateAsync(payload);
    if (result.authUrl) {
      window.location.href = result.authUrl;
      return;
    }
    if (result.secret) {
      setConnectResult(result);
      return;
    }
    setModalProvider(null);
  };

  if (isLoading) {
    return <div className="p-6 text-sm text-[var(--color-text-muted)]">Loading integrations…</div>;
  }
  if (error) return <QueryErrorBanner message={getQueryErrorMessage(error)} />;

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start gap-3">
        <Plug className="text-[var(--color-action-primary)] shrink-0 mt-0.5" size={20} />
        <div>
          <h1 className="text-lg font-black uppercase tracking-wider text-[var(--color-text-primary)]">Connected Apps</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Connect Gmail, Mailchimp, HubSpot, and more. Data flows into CRM and Data Hub automatically.
          </p>
        </div>
      </div>

      {connectedBanner ? (
        <p className="text-sm p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700">
          Connected: {connectedBanner}
        </p>
      ) : null}
      {connectError ? (
        <p className="text-sm p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-700">
          Connect failed: {connectError}
        </p>
      ) : null}

      {grouped.map((group) => (
        <section key={group.category}>
          <h2 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-3">
            {group.label}
          </h2>
          <div className="grid gap-2">
            {group.items.map((provider) => (
              <IntegrationCard
                key={provider.id}
                provider={provider}
                connection={provider.connection}
                onConnect={setModalProvider}
                onDisconnect={(c) => disconnect.mutate(c._id)}
                onHealth={(c) => health.mutate(c._id)}
                onSync={(c) => sync.mutate(c._id)}
                onConfigure={(c, p) => setDetail({ connection: c, provider: p })}
              />
            ))}
          </div>
        </section>
      ))}

      <Link
        to="/developers"
        className="group flex items-center gap-4 p-4 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/40 hover:border-[var(--color-action-primary)]/40 hover:bg-[var(--color-bg-secondary)] transition-colors"
      >
        <div className="h-11 w-11 shrink-0 rounded-xl flex items-center justify-center bg-[var(--color-action-primary)]/10 text-[var(--color-action-primary)] border border-[var(--color-action-primary)]/20">
          <Code2 size={20} strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-[var(--color-text-primary)]">Developers</p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">
            API keys, outbound webhooks, delivery logs — Zapier and custom automation.
          </p>
        </div>
        <ArrowRight size={18} className="shrink-0 text-[var(--color-text-muted)] group-hover:text-[var(--color-action-primary)] transition-colors" />
      </Link>

      <IntegrationConnectModal
        provider={modalProvider}
        open={!!modalProvider}
        onClose={() => { setModalProvider(null); setConnectResult(null); }}
        onSubmit={handleConnectSubmit}
        loading={connect.isPending}
        result={connectResult}
      />

      <IntegrationDetailDrawer
        open={!!detail}
        connection={detail?.connection}
        provider={detail?.provider}
        onClose={() => setDetail(null)}
        saving={patchMeta.isPending}
        onSave={({ metadata }) => {
          patchMeta.mutate({ id: detail.connection._id, metadata }, { onSuccess: () => setDetail(null) });
        }}
      />
    </div>
  );
}
