import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plug, Code2, ArrowRight, Globe } from 'lucide-react';
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

const CATEGORY_ORDER = ['email', 'messaging', 'data', 'intake'];

const CATEGORY_LABELS = {
  email: 'Email',
  messaging: 'WhatsApp',
  data: 'Data',
  intake: 'Intake',
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
  const [connectFailure, setConnectFailure] = useState(null);
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
    setConnectFailure(null);
    try {
      const result = await connect.mutateAsync(payload);
      if (result.authUrl) {
        window.location.href = result.authUrl;
        return;
      }
      if (result.secret || result.webhookSecret) {
        setConnectResult(result);
        return;
      }
      setModalProvider(null);
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Connect failed';
      setConnectFailure(message);
    }
  };

  const openConnectModal = (provider) => {
    setConnectFailure(null);
    if (provider.canConnect === false) return;
    setModalProvider(provider);
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
          <p className="text-sm text-[var(--color-text-secondary)] mt-1 leading-relaxed">
            Connect email, WhatsApp, spreadsheets, and intake webhooks for this organization. Each card explains what it does and what you need before you connect.
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-2">
            OAuth apps (Gmail, Google Sheets) need server-side Google credentials. API-key apps need your vendor key. Inbound webhooks show a URL and secret after you create them.
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
      {connectFailure ? (
        <p className="text-sm p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-700">
          {connectFailure}
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
                onConnect={openConnectModal}
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
          <Globe size={20} strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-[var(--color-text-primary)]">Website Forms</p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">
            Embed a contact form on any site — publishable keys, agent setup prompt, CRM intake.
          </p>
        </div>
        <ArrowRight size={18} className="shrink-0 text-[var(--color-text-muted)] group-hover:text-[var(--color-action-primary)] transition-colors" />
      </Link>

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
            API keys, inbound webhooks, outbound event hooks.
          </p>
        </div>
        <ArrowRight size={18} className="shrink-0 text-[var(--color-text-muted)] group-hover:text-[var(--color-action-primary)] transition-colors" />
      </Link>

      <IntegrationConnectModal
        provider={modalProvider}
        open={!!modalProvider}
        onClose={() => { setModalProvider(null); setConnectResult(null); setConnectFailure(null); }}
        onSubmit={handleConnectSubmit}
        loading={connect.isPending}
        result={connectResult}
        error={connectFailure}
      />

      <IntegrationDetailDrawer
        open={!!detail}
        connection={detail?.connection}
        provider={detail?.provider}
        onClose={() => setDetail(null)}
        saving={patchMeta.isPending}
        syncing={sync.isPending}
        onSync={() => detail?.connection && sync.mutate(detail.connection._id)}
        onSave={({ metadata }) => {
          patchMeta.mutate({ id: detail.connection._id, metadata }, { onSuccess: () => setDetail(null) });
        }}
      />
    </div>
  );
}
