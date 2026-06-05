import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { Brackets, Play, Clock3, CheckCircle2, XCircle, Layers } from 'lucide-react';
import { Badge, Button, Input, PageContainer, PageHeader, PageSkeleton } from '../../components/ui';
import RelativeTimestamp from '../../components/ui/RelativeTimestamp';

const formatMs = (ms = 0) => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

const SAFETY_VARIANT = {
  safe: 'success',
  caution: 'warning',
  danger: 'danger',
};

const SAFETY_LABEL = {
  safe: 'Safe',
  caution: 'Caution',
  danger: 'Danger',
};

const CATEGORY_ORDER = [
  'Dev & infra',
  'Backup & cron',
  'QA',
  'Data repair',
  'Database sync',
  'Finance',
  'Audits',
];

const AdminScriptsPage = () => {
  const [search, setSearch] = useState('');
  const [runningId, setRunningId] = useState(null);
  const [results, setResults] = useState({});

  const { data: scripts = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin-scripts'],
    queryFn: async () => (await axios.get('/api/admin/scripts')).data?.data || [],
  });

  const { data: queueStatus, isFetching: queuesFetching, refetch: refetchQueues } = useQuery({
    queryKey: ['admin-queues'],
    queryFn: async () => (await axios.get('/api/admin/queues/status')).data,
    refetchInterval: 30_000,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return scripts;
    return scripts.filter((s) =>
      `${s.title} ${s.description} ${s.category} ${s.command}`.toLowerCase().includes(q)
    );
  }, [scripts, search]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const script of filtered) {
      const cat = script.category || 'Other';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(script);
    }
    const ordered = [];
    for (const cat of CATEGORY_ORDER) {
      if (map.has(cat)) {
        ordered.push({ category: cat, items: map.get(cat) });
        map.delete(cat);
      }
    }
    for (const [category, items] of map) {
      ordered.push({ category, items });
    }
    return ordered;
  }, [filtered]);

  const runScript = async (scriptId) => {
    setRunningId(scriptId);
    try {
      const res = await axios.post(`/api/admin/scripts/${scriptId}/run`, {});
      setResults((prev) => ({ ...prev, [scriptId]: { ok: true, ...res.data.data } }));
    } catch (err) {
      const payload = err.response?.data?.data;
      setResults((prev) => ({
        ...prev,
        [scriptId]: {
          ok: false,
          ...(payload || {}),
          stderr:
            payload?.stderr
            || err.response?.data?.message
            || err.message
            || 'Script failed',
        },
      }));
    } finally {
      setRunningId(null);
    }
  };

  if (isLoading) return <PageSkeleton />;

  return (
    <PageContainer className="space-y-5">
      <PageHeader
        title="Admin Script Runner"
        icon={Brackets}
        actions={
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search scripts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
            />
            <Button size="sm" variant="secondary" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        }
      >
        <p className="text-xs text-[var(--color-text-muted)]">
          {scripts.length} curated scripts (whitelist). Edit{' '}
          <code className="text-[10px] font-mono">server/config/adminScriptsCatalog.js</code> to add or remove.
        </p>
      </PageHeader>

      <section className="rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-[var(--color-brand-teal)]" />
            <h2 className="text-sm font-bold text-[var(--color-text-primary)]">Background queues</h2>
            <Badge variant={queueStatus?.redisAvailable ? 'success' : 'warning'}>
              {queueStatus?.redisAvailable ? 'Redis' : 'Memory fallback'}
            </Badge>
          </div>
          <Button size="sm" variant="secondary" onClick={() => refetchQueues()} disabled={queuesFetching}>
            {queuesFetching ? 'Refreshing...' : 'Refresh queues'}
          </Button>
        </div>
        {!queueStatus?.redisAvailable ? (
          <p className="text-xs text-[var(--color-text-muted)]">
            BullMQ stats need Redis. Jobs still run via in-memory fallback when Redis is down.
          </p>
        ) : (
          <div className="space-y-3">
            {(queueStatus?.queues || []).map((q) => (
              <div key={q.name} className="rounded-lg border border-[var(--color-bg-border)] p-3">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-xs font-bold font-mono text-[var(--color-text-primary)]">{q.name}</span>
                  <Badge variant="info">waiting {q.waiting}</Badge>
                  <Badge variant="info">active {q.active}</Badge>
                  <Badge variant={q.failed > 0 ? 'danger' : 'success'}>failed {q.failed}</Badge>
                </div>
                {q.recentFailed?.length > 0 && (
                  <ul className="text-xs text-[var(--color-text-muted)] space-y-1">
                    {q.recentFailed.map((job) => (
                      <li key={`${q.name}-${job.id}`} className="font-mono truncate" title={job.failedReason || ''}>
                        #{job.id} {job.name} — {job.failedReason || 'failed'}
                        {job.finishedOn ? (
                          <> · <RelativeTimestamp value={job.finishedOn} /></>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] py-8 text-center">
          No scripts match your search.
        </p>
      ) : (
        <div className="space-y-8">
          {grouped.map(({ category, items }) => (
            <section key={category} className="space-y-3">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] border-b border-[var(--color-bg-border)] pb-2">
                {category}
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {items.map((script) => {
                  const result = results[script.id];
                  const isRunning = runningId === script.id;

                  return (
                    <div key={script.id} className="p-4 space-y-3 border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-black uppercase tracking-wider">{script.title}</h3>
                            <Badge variant={SAFETY_VARIANT[script.safety] || 'secondary'}>
                              {SAFETY_LABEL[script.safety] || script.safety}
                            </Badge>
                          </div>
                          <p className="text-xs text-[var(--color-text-muted)] mt-1">{script.description}</p>
                          <p className="text-[10px] font-mono text-[var(--color-text-muted)] mt-2 break-all">
                            {script.command}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => runScript(script.id)}
                          disabled={!!runningId}
                          className="shrink-0"
                          variant={script.safety === 'danger' ? 'danger' : 'primary'}
                        >
                          <Play size={12} />
                          {isRunning ? 'Running...' : 'Run'}
                        </Button>
                      </div>

                      {result && (
                        <div className="border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] p-3 space-y-2 bg-[var(--color-bg-workspace)]">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={result.ok ? 'success' : 'danger'}>
                              {result.ok ? 'Success' : 'Failed'}
                            </Badge>
                            <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
                              exit {result.exitCode ?? '-'}
                            </span>
                            <span className="text-[10px] font-mono text-[var(--color-text-muted)] flex items-center gap-1">
                              <Clock3 size={10} />
                              {formatMs(result.durationMs || 0)}
                            </span>
                            {result.ok ? (
                              <CheckCircle2 size={12} className="text-emerald-500" />
                            ) : (
                              <XCircle size={12} className="text-rose-500" />
                            )}
                          </div>
                          {result.stdout ? (
                            <pre className="text-[10px] whitespace-pre-wrap max-h-40 overflow-auto p-2 rounded bg-black/70 text-slate-100">
                              {result.stdout}
                            </pre>
                          ) : null}
                          {result.stderr ? (
                            <pre className="text-[10px] whitespace-pre-wrap max-h-40 overflow-auto p-2 rounded bg-rose-950/70 text-rose-100">
                              {result.stderr}
                            </pre>
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </PageContainer>
  );
};

export default AdminScriptsPage;
