import React, { useEffect, useState } from 'react';
import { Code2, Key, Webhook } from 'lucide-react';
import { ListPageLayout, PageSkeleton, QueryErrorBanner } from '../../components/ui';
import axios from 'axios';

const DevelopersPage = () => {
  const [keys, setKeys] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [issuedKey, setIssuedKey] = useState(null);

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
    const { data } = await axios.post('/api/enterprise/api-keys', { name: newKeyName.trim(), scopes: ['read'] });
    setIssuedKey(data.key);
    setNewKeyName('');
    await load();
  };

  if (loading) return <PageSkeleton />;

  return (
    <ListPageLayout
      containerClassName="!py-4"
      title="Developers"
      icon={Code2}
      backTo="/settings"
    >
      {error ? <QueryErrorBanner error={error} /> : null}
      {usage ? (
        <p className="text-sm text-slate-600 mb-4">
          Plan: <strong>{usage.plan}</strong> · Seats {usage.seatsUsed}/{usage.limits?.seats}
        </p>
      ) : null}
      {issuedKey ? (
        <div className="mb-4 p-3 rounded bg-amber-50 border border-amber-200 text-sm">
          New API key (copy now): <code className="break-all">{issuedKey}</code>
        </div>
      ) : null}
      <section className="mb-8">
        <h2 className="flex items-center gap-2 font-semibold mb-2"><Key size={16} /> API Keys</h2>
        <div className="flex gap-2 mb-3">
          <input
            className="border rounded px-2 py-1 text-sm flex-1"
            placeholder="Key name"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
          />
          <button type="button" className="px-3 py-1 rounded bg-teal-600 text-white text-sm" onClick={createKey}>
            Create
          </button>
        </div>
        <ul className="text-sm space-y-1">
          {keys.map((k) => (
            <li key={k._id}>{k.name} · {k.keyPrefix}…</li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="flex items-center gap-2 font-semibold mb-2"><Webhook size={16} /> Webhooks</h2>
        <ul className="text-sm space-y-1">
          {webhooks.map((w) => (
            <li key={w._id}>{w.url} · {w.events?.join(', ')}</li>
          ))}
        </ul>
        <p className="text-xs text-slate-500 mt-2">
          OpenAPI: <a className="text-teal-600 underline" href="/api/openapi.json" target="_blank" rel="noreferrer">/api/openapi.json</a>
        </p>
      </section>
    </ListPageLayout>
  );
};

export default DevelopersPage;
