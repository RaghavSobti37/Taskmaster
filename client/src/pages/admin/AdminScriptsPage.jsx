import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { Brackets, Play, Clock3, CheckCircle2, XCircle } from 'lucide-react';
import { Badge, Button, Card, Input, PageContainer, PageHeader, PageSkeleton } from '../../components/ui';

const formatMs = (ms = 0) => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

const AdminScriptsPage = () => {
  const [search, setSearch] = useState('');
  const [runningId, setRunningId] = useState(null);
  const [results, setResults] = useState({});

  const { data: scripts = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-scripts'],
    queryFn: async () => (await axios.get('/api/admin/scripts')).data?.data || [],
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return scripts;
    return scripts.filter((s) =>
      `${s.title} ${s.description} ${s.fileName}`.toLowerCase().includes(q)
    );
  }, [scripts, search]);

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
            <Button size="sm" variant="secondary" onClick={() => refetch()}>
              Refresh
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map((script) => {
          const result = results[script.id];
          const isRunning = runningId === script.id;

          return (
            <Card key={script.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider">{script.title}</h3>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">{script.description}</p>
                  <p className="text-[10px] font-mono text-[var(--color-text-muted)] mt-2">{script.command}</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => runScript(script.id)}
                  disabled={!!runningId}
                  className="shrink-0"
                >
                  <Play size={12} />
                  {isRunning ? 'Running...' : 'Run'}
                </Button>
              </div>

              {result && (
                <div className="border border-[var(--color-bg-border)] rounded-xl p-3 space-y-2 bg-[var(--color-bg-workspace)]">
                  <div className="flex items-center gap-2">
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
                    {result.ok ? <CheckCircle2 size={12} className="text-emerald-500" /> : <XCircle size={12} className="text-rose-500" />}
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
            </Card>
          );
        })}
      </div>
    </PageContainer>
  );
};

export default AdminScriptsPage;
