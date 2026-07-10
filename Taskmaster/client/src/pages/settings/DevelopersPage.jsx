import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Code2, Key, Webhook, FileJson, ExternalLink, Copy, Trash2, Activity, Globe,
} from 'lucide-react';
import {
  ListPageLayout,
  PageSkeleton,
  QueryErrorBanner,
  Button,
  Input,
  Badge,
} from '../../components/ui';
import axios from 'axios';
import { useWebhookDeliveries } from '../../hooks/queries/integrations';
import WebsiteFormsPanel from '../../components/forms/WebsiteFormsPanel';

const WEBHOOK_EVENTS = [
  'lead.created',
  'lead.updated',
  'person.merged',
  'campaign.sent',
  'mail.event',
  'integration.sync.completed',
  'integration.error',
];

function SecretBanner({ label, value, onDismiss }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10">
      <p className="text-xs font-bold uppercase tracking-wide text-amber-200 mb-2">{label}</p>
      <div className="flex flex-wrap items-start gap-2">
        <code className="flex-1 min-w-0 text-xs break-all text-amber-50 bg-black/20 rounded-lg px-3 py-2 font-mono">
          {value}
        </code>
        <Button type="button" variant="secondary" size="sm" className="gap-1.5 shrink-0" onClick={copy}>
          <Copy size={14} />
          {copied ? 'Copied' : 'Copy'}
        </Button>
        {onDismiss ? (
          <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
            Dismiss
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function SectionCard({ icon: Icon, title, description, children }) {
  return (
    <section className="rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/50">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[var(--color-action-primary)]/10 text-[var(--color-action-primary)]">
            <Icon size={16} strokeWidth={2.25} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[var(--color-text-primary)]">{title}</h2>
            {description ? (
              <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{description}</p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

const DevelopersPage = () => {
  const [keys, setKeys] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [issuedKey, setIssuedKey] = useState(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEvents, setWebhookEvents] = useState(['lead.created']);
  const [issuedWebhookSecret, setIssuedWebhookSecret] = useState(null);
  const [selectedWebhookId, setSelectedWebhookId] = useState(null);

  const { data: deliveries = [] } = useWebhookDeliveries(selectedWebhookId);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [keysRes, hooksRes, usageRes] = await Promise.all([
        axios.get('/api/enterprise/api-keys').catch(() => ({ data: { keys: [] } })),
        axios.get('/api/enterprise/webhooks').catch(() => ({ data: { webhooks: [] } })),
        axios.get('/api/enterprise/usage'),
      ]);
      setKeys(keysRes.data?.keys || []);
      setWebhooks(hooksRes.data?.webhooks || []);
      setUsage(usageRes.data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const createKey = async () => {
    if (!newKeyName.trim()) return;
    const { data } = await axios.post('/api/enterprise/api-keys', {
      name: newKeyName.trim(),
      scopes: ['read', 'write'],
    });
    setIssuedKey(data.key);
    setNewKeyName('');
    await load();
  };

  const createWebhook = async () => {
    if (!webhookUrl.trim()) return;
    const { data } = await axios.post('/api/enterprise/webhooks', {
      url: webhookUrl.trim(),
      events: webhookEvents,
    });
    setIssuedWebhookSecret(data.secret);
    setWebhookUrl('');
    await load();
  };

  const toggleEvent = (event) => {
    setWebhookEvents((prev) => (
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    ));
  };

  const deactivateWebhook = async (id) => {
    await axios.delete(`/api/enterprise/webhooks/${id}`);
    if (selectedWebhookId === id) setSelectedWebhookId(null);
    await load();
  };

  if (loading) return <PageSkeleton />;

  const seatLimit = usage?.limits?.seats;
  const seatsUsed = usage?.seatsUsed;

  return (
    <ListPageLayout
      containerClassName="!py-4 max-w-3xl mx-auto"
      title="Developers"
      icon={Code2}
      backTo="/settings?tab=integrations"
    >
      <div className="space-y-6">
        {error ? <QueryErrorBanner error={error} /> : null}

        {usage ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral" className="uppercase text-[10px] tracking-wider">
              Plan · {usage.plan || 'free'}
            </Badge>
            {seatLimit != null ? (
              <span className="text-xs text-[var(--color-text-muted)]">
                {seatsUsed} seat{seatsUsed === 1 ? '' : 's'} in use
                {seatLimit > 0 ? ` · ${seatLimit} included` : ''}
              </span>
            ) : null}
          </div>
        ) : null}

        {issuedKey ? (
          <SecretBanner
            label="New API key — copy now"
            value={issuedKey}
            onDismiss={() => setIssuedKey(null)}
          />
        ) : null}
        {issuedWebhookSecret ? (
          <SecretBanner
            label="Webhook signing secret — copy now"
            value={issuedWebhookSecret}
            onDismiss={() => setIssuedWebhookSecret(null)}
          />
        ) : null}

        <SectionCard
          icon={Globe}
          title="Website Forms"
          description="Embed contact forms on any site — publishable keys only (safe in the browser)."
        >
          <WebsiteFormsPanel apiOrigin={typeof window !== 'undefined' ? window.location.origin : ''} />
        </SectionCard>

        <SectionCard
          icon={Webhook}
          title="Inbound webhook"
          description="Server-side POST with HMAC secret — Zapier, Make, or your backend."
        >
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            Create an inbound webhook under{' '}
            <Link to="/settings?tab=integrations" className="text-[var(--color-action-primary)] hover:underline">
              Connected Apps → Inbound Webhook
            </Link>
            . Never put the webhook secret in frontend code.
          </p>
        </SectionCard>

        <SectionCard
          icon={Key}
          title="Public API keys"
          description="Server-to-server CRM intake with Bearer ck_live_* tokens."
        >
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <Input
              className="flex-1 min-h-[44px]"
              placeholder="Key name (e.g. Zapier prod)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createKey()}
            />
            <Button type="button" className="min-h-[44px] shrink-0" onClick={createKey}>
              Create key
            </Button>
          </div>
          {keys.length > 0 ? (
            <ul className="space-y-2">
              {keys.map((k) => (
                <li
                  key={k._id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/30 text-sm"
                >
                  <span className="font-medium text-[var(--color-text-primary)] truncate">{k.name}</span>
                  <code className="text-xs text-[var(--color-text-muted)] font-mono shrink-0">{k.keyPrefix}…</code>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[var(--color-text-muted)]">No API keys yet.</p>
          )}
          <p className="text-[11px] text-[var(--color-text-muted)] mt-4 leading-relaxed">
            Public API:{' '}
            <code className="text-[var(--color-text-secondary)]">POST /api/v1/leads</code>
            {' · '}
            <code className="text-[var(--color-text-secondary)]">GET /api/v1/leads/:id</code>
          </p>
        </SectionCard>

        <SectionCard
          icon={Webhook}
          title="Outbound webhooks"
          description="CoreKnot POSTs JSON to your URL when events fire."
        >
          <div className="space-y-4">
            <Input
              className="w-full min-h-[44px] font-mono text-sm"
              placeholder="https://example.com/webhooks/coreknot"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
                Events
              </p>
              <div className="flex flex-wrap gap-2">
                {WEBHOOK_EVENTS.map((ev) => {
                  const on = webhookEvents.includes(ev);
                  return (
                    <button
                      key={ev}
                      type="button"
                      onClick={() => toggleEvent(ev)}
                      className={`text-xs font-mono px-3 py-1.5 rounded-full border min-h-[32px] transition-colors ${
                        on
                          ? 'bg-[var(--color-action-primary)]/15 border-[var(--color-action-primary)]/50 text-[var(--color-action-primary)]'
                          : 'border-[var(--color-bg-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)]'
                      }`}
                    >
                      {ev}
                    </button>
                  );
                })}
              </div>
            </div>
            <Button type="button" className="min-h-[44px]" onClick={createWebhook} disabled={!webhookUrl.trim()}>
              Add webhook
            </Button>
          </div>

          {webhooks.length > 0 ? (
            <ul className="mt-6 space-y-2 border-t border-[var(--color-bg-border)] pt-4">
              {webhooks.map((w) => {
                const selected = selectedWebhookId === w._id;
                return (
                  <li
                    key={w._id}
                    className={`rounded-lg border p-3 transition-colors ${
                      selected
                        ? 'border-[var(--color-action-primary)]/50 bg-[var(--color-action-primary)]/5'
                        : 'border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/20'
                    }`}
                  >
                    <div className="flex flex-wrap items-start gap-2 justify-between">
                      <button
                        type="button"
                        className="text-left flex-1 min-w-0"
                        onClick={() => setSelectedWebhookId(selected ? null : w._id)}
                      >
                        <span className="block text-sm font-mono truncate text-[var(--color-text-primary)]">{w.url}</span>
                        <span className="block text-[11px] text-[var(--color-text-muted)] mt-1">
                          {w.events?.join(', ')}
                          {w.lastStatus != null ? ` · last HTTP ${w.lastStatus}` : ''}
                        </span>
                      </button>
                      <div className="flex items-center gap-2 shrink-0">
                        {selected ? (
                          <Badge variant="success" className="text-[10px]">Log open</Badge>
                        ) : null}
                        <button
                          type="button"
                          className="p-2 rounded-lg text-rose-500 hover:bg-rose-500/10"
                          aria-label="Disable webhook"
                          onClick={() => deactivateWebhook(w._id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </SectionCard>

        {selectedWebhookId ? (
          <SectionCard icon={Activity} title="Delivery log" description="Recent attempts for selected endpoint.">
            <ul className="text-xs space-y-1.5 max-h-64 overflow-y-auto">
              {deliveries.length === 0 ? (
                <li className="text-[var(--color-text-muted)] py-4 text-center">No deliveries yet</li>
              ) : (
                deliveries.map((d) => (
                  <li
                    key={d._id}
                    className={`flex flex-wrap gap-x-2 gap-y-0.5 px-2 py-1.5 rounded-md ${
                      d.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    <span className="text-[var(--color-text-muted)]">{new Date(d.createdAt).toLocaleString()}</span>
                    <span className="font-mono">{d.event}</span>
                    <span>HTTP {d.statusCode}</span>
                    {d.error ? <span className="text-[var(--color-text-muted)]">· {d.error}</span> : null}
                  </li>
                ))
              )}
            </ul>
          </SectionCard>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/30">
          <div className="flex items-center gap-2 min-w-0">
            <FileJson size={18} className="shrink-0 text-[var(--color-action-primary)]" />
            <div>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">OpenAPI spec</p>
              <p className="text-[11px] text-[var(--color-text-muted)]">Machine-readable API reference</p>
            </div>
          </div>
          <a
            href="/api/openapi.json"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--color-action-primary)] hover:opacity-80"
          >
            Open
            <ExternalLink size={14} />
          </a>
        </div>

        <p className="text-center text-[11px] text-[var(--color-text-muted)]">
          <Link to="/settings?tab=integrations" className="text-[var(--color-action-primary)] hover:underline">
            ← Back to Connected Apps
          </Link>
        </p>
      </div>
    </ListPageLayout>
  );
};

export default DevelopersPage;
