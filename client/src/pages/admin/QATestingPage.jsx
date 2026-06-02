import React, { useState, useCallback } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bug, Play, XCircle, RefreshCw, Trash2, CheckCircle, AlertTriangle, ShieldAlert, Monitor, Smartphone, Server, Database, Timer, Layout, Check, Shield, Copy, Lock, Globe, Gauge, FileWarning, ScrollText, RotateCcw, GitBranch } from 'lucide-react';
import { PageContainer, PageHeader, Card, Button, Badge } from '../../components/ui';
import { useSystemToast } from '../../lib/systemLogBridge';
import { MODULE } from '../../lib/systemLogContract';
import { useProjects } from '../../hooks/useTaskmasterQueries';

const PREDEPLOY_CATEGORIES = new Set([
  'authorization', 'password-reset', 'input-validation', 'cors', 'rate-limiting',
  'error-handling', 'database-indexes', 'logging-monitoring', 'rollback', 'business-logic',
  'security-hardening',
]);

const PRE_DEPLOY_LABELS = {
  authorization: 'Authorization',
  'password-reset': 'Password reset',
  'input-validation': 'Input validation',
  cors: 'CORS',
  'rate-limiting': 'Rate limiting',
  'error-handling': 'Error handling',
  'database-indexes': 'Database indexes',
  'logging-monitoring': 'Logging & monitoring',
  rollback: 'Rollback / deploy',
  'business-logic': 'Business logic interconnect',
  'security-hardening': 'Security hardening (Jun 2026)',
};

// Icons mapped to test categories
const categoryIcons = {
  frontend: Layout,
  desktop: Monitor,
  mobile: Smartphone,
  backend: Server,
  permission: ShieldAlert,
  data: Database,
  bottleneck: Timer,
  authorization: Shield,
  'password-reset': Lock,
  'input-validation': FileWarning,
  cors: Globe,
  'rate-limiting': Gauge,
  'error-handling': AlertTriangle,
  'database-indexes': Database,
  'logging-monitoring': ScrollText,
  rollback: RotateCcw,
  'business-logic': GitBranch,
  'security-hardening': ShieldAlert,
};

const checkStatusStyles = {
  pass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  fail: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
  warn: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  skip: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20',
};

// Colors mapped to severity
const severityColors = {
  high: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
  medium: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
  low: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20'
};

const QA_AGENTS = [
  { id: 'admin-qa', name: 'Alpha (Admin Auth)', role: 'admin', desc: 'Tests maximum permission vectors', icon: ShieldAlert },
  { id: 'user-qa', name: 'Beta (Standard Auth)', role: 'user', desc: 'Tests typical user boundaries', icon: Shield },
  { id: 'guest-qa', name: 'Gamma (Unauth / Guest)', role: 'guest', desc: 'Tests public surface area', icon: Monitor },
];

const useQAProgress = (testRunId) => {
  return useQuery({
    queryKey: ['qa-progress', testRunId],
    queryFn: async () => {
      const url = testRunId ? `/api/qa/progress?testRunId=${testRunId}` : '/api/qa/progress';
      const { data } = await axios.get(url);
      return data;
    },
    enabled: !!testRunId,
    refetchInterval: 800,
  });
};

const KIND_LABELS = {
  static: 'Static (files/config)',
  http: 'Live HTTP',
  'http-live': 'Live HTTP',
  integration: 'Integration (API + DB)',
  'page-scan': 'Page pentest',
  discovery: 'Discovery',
  unknown: 'Test',
};

const kindBadgeClass = (kind) => {
  switch (kind) {
    case 'static':
      return 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/25';
    case 'http':
    case 'http-live':
      return 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/25';
    case 'integration':
      return 'bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/25';
    case 'page-scan':
      return 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/25';
    default:
      return 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20';
  }
};

function LiveProbePanel({ currentRun }) {
  const live = currentRun?.progress?.liveActivity || {};
  const log = [...(currentRun?.activityLog || [])].reverse().slice(0, 12);
  const elapsed =
    live.startedAt && live.phase === 'running'
      ? Math.max(0, Math.floor((Date.now() - new Date(live.startedAt).getTime()) / 1000))
      : live.elapsedMs != null
        ? Math.floor(live.elapsedMs / 1000)
        : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {live.kind && (
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${kindBadgeClass(live.kind)}`}>
            {KIND_LABELS[live.kind] || live.kind}
          </span>
        )}
        {live.phase && (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20">
            {live.phase}
          </span>
        )}
        {elapsed != null && live.phase === 'running' && (
          <span className="text-xs text-amber-600 dark:text-amber-400 font-mono">
            running {elapsed}s{elapsed > 15 ? ' — slow static group or HTTP timeout (12s max)' : ''}
          </span>
        )}
      </div>

      {live.kind === 'static' && (
        <p className="text-xs text-violet-700 dark:text-violet-300 bg-violet-500/5 border border-violet-500/20 rounded-lg px-3 py-2">
          No API call for this step — agent reads repo files (e.g. <code className="font-mono">render.yaml</code>, middleware). Safe to sit here a few seconds.
        </p>
      )}

      {live.method && live.url && (
        <div className="font-mono text-xs bg-black/5 dark:bg-black/40 rounded-lg p-3 border border-blue-100 dark:border-blue-800/40 space-y-1">
          <div>
            <span className="text-blue-500 font-bold">{live.method}</span>{' '}
            <span className="text-blue-900 dark:text-blue-100 break-all">{live.url}</span>
          </div>
          {live.requestBody && (
            <div className="text-[var(--color-text-muted)] break-all">
              <span className="text-blue-500">body</span> {live.requestBody}
            </div>
          )}
          {live.httpStatus != null && (
            <div className={live.httpStatus >= 400 ? 'text-amber-600' : 'text-emerald-600'}>
              → HTTP {live.httpStatus}
            </div>
          )}
        </div>
      )}

      {live.target && !live.url && (
        <div className="font-mono text-xs text-[var(--color-text-secondary)]">
          Target: <span className="text-blue-900 dark:text-blue-100">{live.target}</span>
        </div>
      )}

      {live.action && (
        <p className="text-sm text-[var(--color-text-secondary)]">{live.action}</p>
      )}

      {live.message && live.phase !== 'queued' && (
        <p className="text-xs font-mono text-[var(--color-text-muted)]">{live.message}</p>
      )}

      {log.length > 0 && (
        <div className="border-t border-blue-100 dark:border-blue-800/40 pt-3">
          <div className="text-[10px] uppercase font-bold text-blue-500 tracking-wider mb-2">Recent steps</div>
          <ul className="max-h-36 overflow-y-auto space-y-1.5 text-xs font-mono">
            {log.map((entry, idx) => (
              <li key={`${entry.at}-${idx}`} className="flex gap-2 text-[var(--color-text-muted)]">
                <span
                  className={
                    entry.outcome === 'failed'
                      ? 'text-red-500 shrink-0'
                      : entry.outcome === 'passed'
                        ? 'text-emerald-500 shrink-0'
                        : 'text-gray-400 shrink-0'
                  }
                >
                  {entry.outcome === 'failed' ? '✗' : entry.outcome === 'passed' ? '✓' : '○'}
                </span>
                <span className="truncate">
                  {entry.method && entry.url ? `${entry.method} ${entry.url}` : entry.summary || entry.testName}
                  {entry.httpStatus != null ? ` → ${entry.httpStatus}` : ''}
                  {entry.durationMs != null ? ` (${entry.durationMs}ms)` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const QATestingPage = () => {
  const { success: toastSuccess, error: toastError } = useSystemToast();
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedAgent, setSelectedAgent] = useState(QA_AGENTS[0]);

  const { data: projects = [], isLoading: projectsLoading } = useProjects();

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['qa-history'],
    queryFn: async () => {
      const { data } = await axios.get(`/api/qa/history`);
      return data;
    }
  });

  const activeRun = historyData?.testRuns?.find(r => ['running', 'pending', 'in-progress'].includes(r.status));
  const [activeTestRunId, setActiveTestRunId] = useState(activeRun?._id || null);

  const { data: progressData } = useQAProgress(activeTestRunId);

  // Sync activeRun to state
  React.useEffect(() => {
    if (activeRun && !activeTestRunId) {
      setActiveTestRunId(activeRun._id);
    } else if (!activeRun && (progressData?.status === 'completed' || progressData?.status === 'error')) {
      if (progressData?.status === 'completed') {
        toastSuccess('Omni-Security test completed', { module: MODULE.SYSTEM });
      }
      setActiveTestRunId(null);
      queryClient.invalidateQueries(['qa-history']);
      if (progressData?.testRunId) {
        queryClient.invalidateQueries(['qa-results', progressData.testRunId]);
      }
    }
  }, [activeRun, activeTestRunId, progressData, queryClient]);

  const { data: latestResults } = useQuery({
    queryKey: ['qa-results', historyData?.testRuns?.[0]?._id],
    queryFn: async () => {
      const latestRunId = historyData?.testRuns?.[0]?._id;
      if (!latestRunId) return null;
      const { data } = await axios.get(`/api/qa/results/${latestRunId}`);
      return data;
    },
    enabled: !!historyData?.testRuns?.[0]?._id && historyData?.testRuns?.[0]?.status === 'completed',
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      const { data } = await axios.post(`/api/qa/start`, {
        testAgentName: selectedAgent.name,
        testRole: selectedAgent.role,
        permissions: []
      });
      return data;
    },
    onSuccess: (data) => {
      setActiveTestRunId(data.testRunId);
      queryClient.invalidateQueries(['qa-history']);
    },
    onError: (err) => {
      toastError(err.response?.data?.error || 'Failed to start QA test', { module: MODULE.SYSTEM });
    }
  });

  const cancelMutation = useMutation({
    mutationFn: async (testRunId) => {
      await axios.post(`/api/qa/cancel/${testRunId}`);
    },
    onSuccess: () => {
      setActiveTestRunId(null);
      queryClient.invalidateQueries(['qa-history']);
    }
  });

  const cleanupMutation = useMutation({
    mutationFn: async (testRunId) => {
      await axios.post(`/api/qa/cleanup/${testRunId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['qa-history']);
      queryClient.invalidateQueries(['qa-results']);
    }
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ testRunId, testCaseId }) => {
      await axios.post(`/api/qa/resolve/${testRunId}/${testCaseId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['qa-results']);
    }
  });

  const handleStart = useCallback(() => {
    startMutation.mutate();
  }, [startMutation]);

  const formatCheckLine = (c, index) => {
    const st = c.checkStatus || (c.status === 'failed' ? 'fail' : c.status === 'warn' ? 'warn' : c.status === 'skip' ? 'skip' : 'pass');
    let block = `${index + 1}. [${st}] ${c.name}\n`;
    block += `   Category: ${c.category || 'n/a'}\n`;
    if (c.description) block += `   ${c.description}\n`;
    if (c.error) block += `   Error: ${c.error}\n`;
    if (c.evidence) block += `   Evidence: ${c.evidence}\n`;
    if (c.checklistId) block += `   Id: ${c.checklistId}\n`;
    return `${block}\n`;
  };

  const handleCopyErrors = useCallback((includeWarns = false) => {
    if (!latestResults?.testCases?.length) {
      toastError('No QA results to copy yet', { module: MODULE.SYSTEM });
      return;
    }

    const isFail = (t) => t.checkStatus === 'fail' || t.status === 'failed';
    const isWarn = (t) => t.checkStatus === 'warn' || t.status === 'warn';
    const failed = latestResults.testCases.filter(isFail);
    const warned = latestResults.testCases.filter(isWarn);
    const summary = latestResults.checklistSummary;

    if (failed.length === 0 && (!includeWarns || warned.length === 0)) {
      toastError('No failures to copy', { module: MODULE.SYSTEM });
      return;
    }

    let text = 'QA Testing Report\n';
    text += `${'='.repeat(40)}\n`;
    text += `Run: ${latestResults.testRunId || 'latest'}\n`;
    if (summary?.total) {
      text += `Checklist: ${summary.pass} pass · ${summary.fail} fail · ${summary.warn} warn · ${summary.skip} skip\n`;
    }
    text += `Failures: ${failed.length}\n\n`;

    const byCategory = {};
    for (const t of failed) {
      const cat = t.category || 'other';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(t);
    }

    Object.entries(byCategory).forEach(([cat, items]) => {
      text += `--- ${PRE_DEPLOY_LABELS[cat] || cat} (${items.length}) ---\n\n`;
      items.forEach((c, i) => { text += formatCheckLine(c, i); });
    });

    if (includeWarns && warned.length > 0) {
      text += `--- Warnings (${warned.length}) ---\n\n`;
      warned.forEach((c, i) => { text += formatCheckLine(c, i); });
    }

    navigator.clipboard.writeText(text).then(() => {
      toastSuccess(`Copied ${failed.length} failure(s)${includeWarns && warned.length ? ` + ${warned.length} warn` : ''}`, { module: MODULE.SYSTEM });
    }).catch((err) => {
      toastError('Failed to copy to clipboard', { module: MODULE.SYSTEM });
      console.error(err);
    });
  }, [latestResults, toastSuccess, toastError]);

  const currentRun = activeTestRunId ? (progressData || activeRun) : null;
  const isRunning = currentRun && ['running', 'pending', 'in-progress'].includes(currentRun.status);

  const renderPreDeploymentChecklist = () => {
    const summary = latestResults?.checklistSummary;
    if (!summary?.total) return null;

    const categoryOrder = Object.keys(PRE_DEPLOY_LABELS);
    const entries = categoryOrder
      .filter((cat) => summary.byCategory?.[cat])
      .map((cat) => [cat, summary.byCategory[cat]]);

    return (
      <div className="mt-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <Shield className="text-indigo-500" /> Pre-Deployment Checklist
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {summary.fail > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyErrors(false)}
                  className="text-gray-600 dark:text-gray-300"
                >
                  <Copy size={14} className="mr-1.5" /> Copy failures
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyErrors(true)}
                  className="text-gray-600 dark:text-gray-300"
                >
                  <Copy size={14} className="mr-1.5" /> Copy failures + warns
                </Button>
              </>
            )}
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="px-2 py-1 rounded-full border border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
              {summary.pass} pass
            </span>
            <span className="px-2 py-1 rounded-full border border-red-500/30 text-red-700 dark:text-red-400">
              {summary.fail} fail
            </span>
            <span className="px-2 py-1 rounded-full border border-amber-500/30 text-amber-700 dark:text-amber-400">
              {summary.warn} warn
            </span>
            <span className="px-2 py-1 rounded-full border border-gray-500/30 text-gray-600 dark:text-gray-400">
              {summary.skip} skip
            </span>
          </div>
          </div>
        </div>

        {entries.map(([cat, bucket]) => {
          const Icon = categoryIcons[cat] || Shield;
          const total = bucket.pass + bucket.fail + bucket.warn + bucket.skip;
          return (
            <Card key={cat} className="p-5 border border-[var(--color-bg-border)]">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20">
                  <Icon size={20} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-[var(--color-text-primary)]">{PRE_DEPLOY_LABELS[cat]}</h3>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {bucket.pass} pass · {bucket.fail} fail · {bucket.warn} warn · {bucket.skip} skip ({total} checks)
                  </p>
                </div>
              </div>
              <ul className="space-y-2">
                {bucket.checks.map((check) => {
                  const st = check.checkStatus || (check.status === 'failed' ? 'fail' : check.status === 'warn' ? 'warn' : check.status === 'skip' ? 'skip' : 'pass');
                  return (
                    <li
                      key={check._id || check.checklistId || check.name}
                      className="flex flex-col sm:flex-row sm:items-start gap-2 p-3 rounded-lg bg-[var(--color-bg-secondary)]"
                    >
                      <span className={`shrink-0 px-2 py-0.5 text-xs font-bold uppercase rounded-full border ${checkStatusStyles[st]}`}>
                        {st}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-[var(--color-text-primary)]">{check.name}</div>
                        {check.description && (
                          <p className="text-xs text-[var(--color-text-muted)] mt-1">{check.description}</p>
                        )}
                        {check.evidence && (
                          <p className="text-xs font-mono text-[var(--color-text-muted)] mt-1 truncate" title={check.evidence}>
                            {check.evidence}
                          </p>
                        )}
                        {check.error && st === 'fail' && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{check.error}</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })}
      </div>
    );
  };

  // Render dynamic-scan bugs (excludes pre-deploy checklist failures shown above)
  const renderBugList = () => {
    if (!latestResults || !latestResults.testCases) return null;

    const bugs = latestResults.testCases.filter(
      t => t.status === 'failed' && !PREDEPLOY_CATEGORIES.has(t.category)
    );
    const checklistFailCount = latestResults.checklistSummary?.fail || 0;

    if (bugs.length === 0) {
      return (
        <Card className={`p-8 text-center mt-6 ${checklistFailCount > 0 ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200' : 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'}`}>
          <CheckCircle className={`mx-auto mb-3 ${checklistFailCount > 0 ? 'text-amber-500' : 'text-emerald-500'}`} size={40} />
          <h3 className={`text-xl font-bold ${checklistFailCount > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
            {checklistFailCount > 0 ? 'No Dynamic Scan Bugs' : 'Zero Bugs Found'}
          </h3>
          <p className={`mt-1 ${checklistFailCount > 0 ? 'text-amber-600' : 'text-emerald-600 dark:text-emerald-500'}`}>
            {checklistFailCount > 0
              ? `Page pentest clean; ${checklistFailCount} pre-deploy check(s) failed above.`
              : 'The agent completed testing with a 100% pass rate.'}
          </p>
        </Card>
      );
    }

    const severityRank = { high: 0, medium: 1, low: 2 };
    bugs.sort((a, b) => severityRank[a.severity || 'medium'] - severityRank[b.severity || 'medium']);

    return (
      <div className="mt-8 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <Bug className="text-rose-500" /> Discovered Bugs ({bugs.length})
          </h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopyErrors(false)}
              className="text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <Copy size={16} className="mr-2" /> Copy failures
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopyErrors(true)}
              className="text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <Copy size={16} className="mr-2" /> + warns
            </Button>
          </div>
        </div>

        <div className="grid gap-4">
          {bugs.map((bug) => {
            const Icon = categoryIcons[bug.category] || Bug;
            const isResolved = bug.resolved;
            return (
              <Card key={bug._id} className={`p-5 transition-all ${isResolved ? 'opacity-60 grayscale' : 'border-l-4 border-l-rose-500'}`}>
                <div className="flex flex-col md:flex-row gap-5 items-start">
                  <div className={`p-3 rounded-lg ${isResolved ? 'bg-gray-100 dark:bg-gray-800' : 'bg-rose-50 dark:bg-rose-900/20'}`}>
                    <Icon size={24} className={isResolved ? 'text-gray-500' : 'text-rose-500'} />
                  </div>

                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h4 className={`text-lg font-bold ${isResolved ? 'text-gray-500 line-through' : 'text-[var(--color-text-primary)]'}`}>
                        {bug.name}
                      </h4>
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border uppercase tracking-wide ${severityColors[bug.severity || 'medium']}`}>
                        {bug.severity || 'Medium'} Severity
                      </span>
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 uppercase tracking-wide">
                        {bug.category}
                      </span>
                      {isResolved && (
                        <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <Check size={12} /> Solved
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-[var(--color-text-primary)] font-medium mb-1">
                      <span className="text-rose-600 dark:text-rose-400 font-bold">Error:</span> {bug.error}
                    </p>

                    {bug.description && (
                      <p className="text-sm text-[var(--color-text-muted)] mt-2 bg-[var(--color-bg-secondary)] p-3 rounded-lg">
                        {bug.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 md:mt-0 flex shrink-0">
                    {!isResolved ? (
                      <Button
                        onClick={() => resolveMutation.mutate({ testRunId: historyData.testRuns[0]._id, testCaseId: bug._id })}
                        disabled={resolveMutation.isPending}
                        className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 border border-emerald-200"
                      >
                        <Check size={16} className="mr-2" /> Mark Solved
                      </Button>
                    ) : (
                      <Button disabled variant="outline" className="opacity-50">
                        Resolved
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <PageContainer>
      <PageHeader
        title="Omni-Security & React Doctor Engine"
        subtitle="Global App Scanning • SAST/SCA Analysis • Pentest Swarm • Automated PoC"
        icon={ShieldAlert}
      />

      <div className="max-w-6xl mx-auto py-6 space-y-8">

        {/* Control Panel / Test Runner */}
        <Card className="p-6 overflow-hidden relative min-h-[300px] flex flex-col justify-center">
          {isRunning ? (
            <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-xl border border-blue-200 dark:border-blue-800/50 w-full max-w-4xl mx-auto">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="font-bold text-xl text-blue-900 dark:text-blue-100 flex items-center gap-2 mb-1">
                    <RefreshCw className="animate-spin text-blue-500" size={24} />
                    Agent {selectedAgent.name} is Testing...
                  </h3>
                  <p className="text-sm text-blue-600 dark:text-blue-400">
                    Live probe feed below — method, URL, body, and file targets update every ~0.8s.
                  </p>
                </div>
                <Button variant="outline" onClick={() => cancelMutation.mutate(currentRun.testRunId || currentRun._id)} className="text-rose-500 border-rose-200 hover:bg-rose-50">
                  <XCircle size={16} className="mr-2" /> Cancel Test
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex flex-col sm:flex-row sm:justify-between text-sm font-bold mb-2 text-blue-800 dark:text-blue-200 gap-2 sm:gap-0">
                    <span>Overall Progress: {currentRun.progress?.current || 0}%</span>
                    <span>{currentRun.pagesTestedCount || 0} completed · {currentRun.progress?.totalPages || 0} total</span>
                  </div>
                  <div className="w-full bg-blue-100 dark:bg-blue-900/50 rounded-full h-4 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all duration-500 ease-out"
                      style={{ width: `${currentRun.progress?.current || 0}%` }}
                    />
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-black/40 border border-blue-100 dark:border-blue-800/50 p-4 rounded-xl space-y-3">
                  <div>
                    <div className="text-xs uppercase font-bold text-blue-500 tracking-wider mb-1">Currently Testing</div>
                    <div className="text-blue-900 dark:text-blue-100 font-mono text-sm font-semibold">
                      {currentRun.progress?.currentPage || 'Initializing framework...'}
                    </div>
                    {currentRun.progress?.liveActivity?.checklistId && (
                      <div className="text-[10px] font-mono text-[var(--color-text-muted)] mt-1">
                        id: {currentRun.progress.liveActivity.checklistId}
                      </div>
                    )}
                  </div>
                  <LiveProbePanel currentRun={currentRun} />
                </div>

                {currentRun.errorDetails?.message && (
                  <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3 rounded-xl text-sm text-red-700 dark:text-red-300">
                    Run error ({currentRun.errorDetails.phase}): {currentRun.errorDetails.message}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-8 relative z-0">

              {/* Left: Project & Agent Selection */}
              <div className="space-y-6">
                {/* Removed Project Selector as testing is Global */}

                <div>
                  <label className="block text-sm font-bold text-[var(--color-text-primary)] mb-3 uppercase tracking-wide">Select QA Identity</label>
                  <div className="grid gap-3">
                    {QA_AGENTS.map(agent => (
                      <div
                        key={agent.id}
                        onClick={() => !isRunning && setSelectedAgent(agent)}
                        className={`flex items-center gap-4 p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedAgent.id === agent.id
                            ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10 shadow-sm'
                            : 'border-transparent bg-[var(--color-bg-secondary)] hover:border-[var(--color-bg-border)]'
                          } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className={`p-2 rounded-lg ${selectedAgent.id === agent.id ? 'bg-indigo-500 text-white' : 'bg-[var(--color-bg-primary)] text-[var(--color-text-muted)]'}`}>
                          <agent.icon size={20} />
                        </div>
                        <div>
                          <div className={`font-bold ${selectedAgent.id === agent.id ? 'text-indigo-900 dark:text-indigo-100' : 'text-[var(--color-text-primary)]'}`}>
                            {agent.name}
                          </div>
                          <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{agent.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: Actions & Info */}
              <div className="flex flex-col justify-between bg-[var(--color-bg-secondary)] p-6 rounded-xl border border-[var(--color-bg-border)]/50">
                <div>
                  <h3 className="font-bold text-lg mb-2 text-[var(--color-text-primary)]">Pre-Flight Checks</h3>
                  <ul className="space-y-3 text-sm text-[var(--color-text-secondary)] mb-6">
                    <li className="flex items-center gap-2"><CheckCircle size={16} className="text-emerald-500" /> Pre-deployment checklist (9 categories + business logic)</li>
                    <li className="flex items-center gap-2"><CheckCircle size={16} className="text-emerald-500" /> Dynamic page pentest (CRM, Finance, Projects)</li>
                    <li className="flex items-center gap-2"><CheckCircle size={16} className="text-emerald-500" /> Agent {selectedAgent.name} primed with {selectedAgent.role} access</li>
                  </ul>
                </div>

                <Button
                  onClick={handleStart}
                  disabled={isRunning || startMutation.isPending}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-2 py-4 rounded-xl text-lg font-bold shadow-lg shadow-indigo-500/30 transition-all hover:-translate-y-0.5"
                >
                  {startMutation.isPending ? <RefreshCw className="animate-spin" size={20} /> : <Play size={20} fill="currentColor" />}
                  Initiate Full Project Scan
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Results Section */}
        {latestResults && !isRunning && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {renderPreDeploymentChecklist()}
            {renderBugList()}

            {/* Actions / Cleanup */}
            <div className="mt-12 flex justify-center">
              <Button
                onClick={() => cleanupMutation.mutate(historyData.testRuns[0]._id)}
                disabled={cleanupMutation.isPending}
                className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 gap-2 py-3 px-6 rounded-xl"
              >
                {cleanupMutation.isPending ? <RefreshCw className="animate-spin" size={18} /> : <Trash2 size={18} />}
                Purge All QA Test Data
              </Button>
            </div>
          </div>
        )}

      </div>
    </PageContainer>
  );
};

export default QATestingPage;
