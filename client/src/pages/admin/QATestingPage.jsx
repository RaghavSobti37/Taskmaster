import React, { useState, useCallback } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bug, Play, XCircle, RefreshCw, Trash2, CheckCircle, AlertTriangle, ShieldAlert, Monitor, Smartphone, Server, Database, Timer, Layout, Check, Shield, Copy, Lock, Globe, Gauge, FileWarning, ScrollText, RotateCcw, GitBranch } from 'lucide-react';
import { PageContainer, PageHeader, Button, Badge, LoadingState } from '../../components/ui';
import { useSystemToast } from '../../lib/systemLogBridge';
import { MODULE } from '../../lib/systemLogContract';
import { useConfirm } from '../../contexts/confirmContext';
import { useProjects } from '../../hooks/useTaskmasterQueries';
import { useDeferredQueryEnabled } from '../../hooks/useDeferredQuery';
import { AXIOS_SKIP_TOAST } from '../../lib/notifications';
import {
  formatLighthouseReportPlain,
  formatLighthouseReportMarkdown,
  copyTextToClipboard,
} from '../../utils/lighthouseReportCopy';

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

const DYNAMIC_CATEGORY_LABELS = {
  backend: 'Backend / page scan',
  permission: 'Permission matrix (L3)',
  bottleneck: 'Bottleneck / concurrency',
  data: 'Data integrity',
  frontend: 'Frontend',
  mobile: 'Mobile',
  desktop: 'Desktop',
  'ui-discovery': 'UI discovery (L2)',
  workflow: 'Workflow E2E (L4)',
  'visual-regression': 'Visual regression (L5)',
  integration: 'Integration E2E (L4)',
};

const LIGHTHOUSE_CATEGORY = 'lighthouse';
const LIGHTHOUSE_CATEGORY_LABEL = 'Lighthouse (perf & a11y)';

const ALL_QA_CATEGORY_KEYS = [
  ...Object.keys(PRE_DEPLOY_LABELS),
  ...Object.keys(DYNAMIC_CATEGORY_LABELS),
  LIGHTHOUSE_CATEGORY,
];

const LIGHTHOUSE_WEIGHT_STYLES = {
  heavy: {
    card: 'border-red-500/60 bg-red-500/10 dark:bg-red-950/30',
    badge: 'bg-red-600 text-white border-red-700',
    label: 'Heavy',
  },
  medium: {
    card: 'border-amber-500/60 bg-amber-500/10 dark:bg-amber-950/25',
    badge: 'bg-amber-500 text-amber-950 border-amber-600',
    label: 'Medium',
  },
  light: {
    card: 'border-emerald-500/60 bg-emerald-500/10 dark:bg-emerald-950/25',
    badge: 'bg-emerald-600 text-white border-emerald-700',
    label: 'Light',
  },
};

const LIGHTHOUSE_WEIGHT_ORDER = { heavy: 0, medium: 1, light: 2 };

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
  lighthouse: Gauge,
};

const checkStatusStyles = {
  pass: 'badge-pastel badge-mint border border-[var(--color-pastel-mint-text)]/20',
  fail: 'badge-pastel badge-rose border border-[var(--color-pastel-rose-text)]/20',
  warn: 'badge-pastel badge-apricot border border-[var(--color-pastel-apricot-text)]/20',
  skip: 'badge-pastel badge-slate border border-[var(--color-pastel-slate-text)]/20',
};

const severityColors = {
  high: 'badge-pastel badge-rose border border-[var(--color-pastel-rose-text)]/20',
  medium: 'badge-pastel badge-apricot border border-[var(--color-pastel-apricot-text)]/20',
  low: 'badge-pastel badge-slate border border-[var(--color-pastel-blue-text)]/20',
};

const QA_AGENTS = [
  { id: 'admin-qa', name: 'Alpha (Admin Auth)', role: 'admin', desc: 'Tests maximum permission vectors', icon: ShieldAlert },
  { id: 'user-qa', name: 'Beta (Standard Auth)', role: 'user', desc: 'Tests typical user boundaries', icon: Shield },
  { id: 'guest-qa', name: 'Gamma (Unauth / Guest)', role: 'guest', desc: 'Tests public surface area', icon: Monitor },
];

/** Staff who never receive QA probe emails or notifications (see shared/qaExcludedUsers.js). */
const QA_EXCLUDED_STAFF_NOTE = 'Excluded from QA notify/email: Aryaman';

const useQAProgress = (testRunId) => {
  return useQuery({
    queryKey: ['qa-progress', testRunId],
    queryFn: async () => {
      const url = testRunId ? `/api/qa/progress?testRunId=${testRunId}` : '/api/qa/progress';
      const { data } = await axios.get(url);
      return data;
    },
    enabled: !!testRunId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      if (['running', 'pending', 'in-progress'].includes(data.status)) return 800;
      if (data.phase === 'running') return 800;
      return false;
    },
  });
};

const KIND_LABELS = {
  static: 'Static (files/config)',
  http: 'Live HTTP',
  'http-live': 'Live HTTP',
  integration: 'Integration (API + DB)',
  'page-scan': 'Page pentest',
  lighthouse: 'Lighthouse audit',
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
    case 'lighthouse':
      return 'bg-teal-500/15 text-teal-800 dark:text-teal-200 border-teal-500/25';
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

      {live.kind === 'lighthouse' && (
        <p className="text-xs text-teal-800 dark:text-teal-200 bg-teal-500/5 border border-teal-500/25 rounded-lg px-3 py-2">
          Chrome Lighthouse — one route at a time. Use <code className="font-mono">npm run build && npm run preview</code> (port 4173) and restart the API after CORS changes. Grid + copy buttons appear when the batch finishes.
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
  const { confirm } = useConfirm();
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedAgent, setSelectedAgent] = useState(QA_AGENTS[0]);
  const [selectedCategories, setSelectedCategories] = useState(() => new Set(ALL_QA_CATEGORY_KEYS));
  const [selectedLighthousePaths, setSelectedLighthousePaths] = useState(() => new Set());

  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const deferQASecondary = useDeferredQueryEnabled(!projectsLoading);

  const { data: lighthouseRoutesData } = useQuery({
    queryKey: ['qa-lighthouse-routes'],
    queryFn: async () => {
      const { data } = await axios.get('/api/qa/lighthouse-routes');
      return data;
    },
    staleTime: 10 * 60 * 1000,
    enabled: deferQASecondary,
  });

  const allLighthouseRoutes = lighthouseRoutesData?.all || [];
  const publicLighthousePaths = React.useMemo(
    () => new Set((lighthouseRoutesData?.public || []).map((r) => r.path)),
    [lighthouseRoutesData]
  );

  React.useEffect(() => {
    if (!allLighthouseRoutes.length) return;
    setSelectedLighthousePaths((prev) => {
      if (prev.size > 0) return prev;
      return new Set(allLighthouseRoutes.map((r) => r.path));
    });
  }, [allLighthouseRoutes]);

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['qa-history'],
    queryFn: async () => {
      const { data } = await axios.get(`/api/qa/history`);
      return data;
    },
    enabled: deferQASecondary,
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
      queryClient.invalidateQueries({ queryKey: ['gamification'] });
      if (progressData?.testRunId) {
        queryClient.invalidateQueries(['qa-results', progressData.testRunId]);
      }
    }
  }, [activeRun, activeTestRunId, progressData, queryClient, toastSuccess]);

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
      const categories = selectedCategories.size === ALL_QA_CATEGORY_KEYS.length
        ? []
        : [...selectedCategories];
      const runsLighthouse = selectedCategories.has(LIGHTHOUSE_CATEGORY);
      const allLhSelected =
        !allLighthouseRoutes.length ||
        selectedLighthousePaths.size >= allLighthouseRoutes.length;
      const lighthousePaths =
        runsLighthouse && !allLhSelected ? [...selectedLighthousePaths] : [];

      const { data } = await axios.post(`/api/qa/start`, {
        testAgentName: selectedAgent.name,
        testRole: selectedAgent.role,
        permissions: [],
        categories,
        lighthousePaths,
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
    mutationFn: async () => {
      try {
        const { data } = await axios.post('/api/qa/purge-test-data', {}, AXIOS_SKIP_TOAST);
        return data;
      } catch (err) {
        if (err.response?.status !== 404) throw err;
        const { data } = await axios.delete('/api/crm/leads/cleanup-test-data', AXIOS_SKIP_TOAST);
        return data;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['qa-history']);
      queryClient.invalidateQueries(['qa-results']);
      queryClient.invalidateQueries({ queryKey: ['dataHub'] });
      queryClient.invalidateQueries({ queryKey: ['userDirectory'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['gamification'] });
      const xpNote = data.xpRecalc?.updatedUsers
        ? ` XP re-synced for ${data.xpRecalc.updatedUsers} user(s).`
        : '';
      toastSuccess((data.message || 'QA test data purged') + xpNote, { module: MODULE.SYSTEM });
    },
    onError: (err) => {
      toastError(err.response?.data?.error || 'Failed to purge QA test data', { module: MODULE.SYSTEM });
    },
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
    if (selectedCategories.size === 0) {
      toastError('Select at least one category to run', { module: MODULE.SYSTEM });
      return;
    }
    if (selectedCategories.has(LIGHTHOUSE_CATEGORY) && selectedLighthousePaths.size === 0) {
      toastError('Select at least one Lighthouse page to audit', { module: MODULE.SYSTEM });
      return;
    }
    startMutation.mutate();
  }, [startMutation, selectedCategories, selectedLighthousePaths.size, toastError]);

  const toggleLighthousePath = useCallback((routePath) => {
    setSelectedLighthousePaths((prev) => {
      const next = new Set(prev);
      if (next.has(routePath)) next.delete(routePath);
      else next.add(routePath);
      return next;
    });
  }, []);

  const setLighthousePathSelection = useCallback((paths) => {
    setSelectedLighthousePaths(new Set(paths));
  }, []);

  const toggleCategory = useCallback((cat) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const copyToClipboard = useCallback((text, successMsg) => {
    navigator.clipboard.writeText(text).then(() => {
      toastSuccess(successMsg, { module: MODULE.SYSTEM });
    }).catch((err) => {
      toastError('Failed to copy to clipboard', { module: MODULE.SYSTEM });
      console.error(err);
    });
  }, [toastSuccess, toastError]);

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

    copyToClipboard(text, `Copied ${failed.length} failure(s)${includeWarns && warned.length ? ` + ${warned.length} warn` : ''}`);
  }, [latestResults, copyToClipboard, toastError]);

  const handleCopyFullReport = useCallback(() => {
    if (!latestResults?.testCases?.length) {
      toastError('No QA results to copy yet', { module: MODULE.SYSTEM });
      return;
    }

    let text = 'QA Testing — Full Report\n';
    text += `${'='.repeat(48)}\n`;
    text += `Run: ${latestResults.testRunId || 'latest'}\n`;
    if (latestResults.startedAt) text += `Started: ${new Date(latestResults.startedAt).toLocaleString()}\n`;
    if (latestResults.completedAt) text += `Completed: ${new Date(latestResults.completedAt).toLocaleString()}\n`;
    if (latestResults.duration != null) text += `Duration: ${Math.round(latestResults.duration / 1000)}s\n`;
    if (latestResults.testIdentity?.name) {
      text += `Agent: ${latestResults.testIdentity.name} (${latestResults.testIdentity.role})\n`;
    }
    text += latestResults.selectedCategories?.length
      ? `Categories: ${latestResults.selectedCategories.join(', ')}\n`
      : 'Categories: all\n';
    text += `Total: ${latestResults.totalTests} · Pass: ${latestResults.passed} · Fail: ${latestResults.failed}`;
    text += ` · Warn: ${latestResults.warned || 0} · Skip: ${latestResults.skipped || 0}\n`;
    text += `Pass rate: ${latestResults.passRate}%\n\n`;

    const byCategory = {};
    for (const t of latestResults.testCases) {
      const cat = t.category || 'other';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(t);
    }

    Object.entries(byCategory)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([cat, items]) => {
        text += `--- ${PRE_DEPLOY_LABELS[cat] || DYNAMIC_CATEGORY_LABELS[cat] || cat} (${items.length}) ---\n\n`;
        items.forEach((c, i) => { text += formatCheckLine(c, i); });
      });

    copyToClipboard(text, 'Full report copied to clipboard');
  }, [latestResults, copyToClipboard, toastError]);

  const currentRun = activeTestRunId ? (progressData || activeRun) : null;
  const isRunning = currentRun && ['running', 'pending', 'in-progress'].includes(currentRun.status);
  const isFullScan = selectedCategories.size === ALL_QA_CATEGORY_KEYS.length;
  const runButtonLabel = isFullScan
    ? 'Initiate Full Project Scan'
    : `Run ${selectedCategories.size} Categor${selectedCategories.size === 1 ? 'y' : 'ies'}`;

  const renderCategoryPicker = () => (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wide">
          Test categories
        </label>
        <div className="flex gap-2">
          <Button variant="ghost" size="xs" onClick={() => setSelectedCategories(new Set(ALL_QA_CATEGORY_KEYS))} disabled={isRunning}>
            All
          </Button>
          <Button variant="ghost" size="xs" onClick={() => setSelectedCategories(new Set())} disabled={isRunning}>
            Clear
          </Button>
        </div>
      </div>
      <p className="text-xs text-[var(--color-text-muted)]">
        {isFullScan
          ? 'All categories selected — full scan.'
          : `${selectedCategories.size} of ${ALL_QA_CATEGORY_KEYS.length} selected.`}
      </p>
      <div className="space-y-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-2">Pre-deploy</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(PRE_DEPLOY_LABELS).map(([key, label]) => {
              const active = selectedCategories.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  disabled={isRunning}
                  onClick={() => toggleCategory(key)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
                    active
                      ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30'
                      : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] border-[var(--color-bg-border)] opacity-60'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-2">Dynamic scan</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(DYNAMIC_CATEGORY_LABELS).map(([key, label]) => {
              const active = selectedCategories.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  disabled={isRunning}
                  onClick={() => toggleCategory(key)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
                    active
                      ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
                      : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] border-[var(--color-bg-border)] opacity-60'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-2">Lighthouse</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={isRunning}
              onClick={() => toggleCategory(LIGHTHOUSE_CATEGORY)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
                selectedCategories.has(LIGHTHOUSE_CATEGORY)
                  ? 'bg-teal-500/15 text-teal-800 dark:text-teal-200 border-teal-500/35'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] border-[var(--color-bg-border)] opacity-60'
              }`}
            >
              {LIGHTHOUSE_CATEGORY_LABEL}
            </button>
          </div>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-1.5">
            Pick pages below · red = heaviest load · yellow = medium · green = lightest
          </p>
          {selectedCategories.has(LIGHTHOUSE_CATEGORY) && allLighthouseRoutes.length > 0 && (
            <div className="mt-3 p-3 rounded-lg border border-teal-500/25 bg-teal-500/5 space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
              <div className="flex flex-wrap gap-2 sticky top-0 bg-[var(--color-bg-primary)]/95 py-1 z-10">
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={isRunning}
                  onClick={() => setLighthousePathSelection(allLighthouseRoutes.map((r) => r.path))}
                >
                  All pages
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={isRunning}
                  onClick={() =>
                    setLighthousePathSelection(
                      allLighthouseRoutes.filter((r) => publicLighthousePaths.has(r.path)).map((r) => r.path)
                    )
                  }
                >
                  Public only
                </Button>
                <Button variant="ghost" size="xs" disabled={isRunning} onClick={() => setLighthousePathSelection([])}>
                  Clear
                </Button>
                <span className="text-[10px] text-[var(--color-text-muted)] self-center ml-auto">
                  {selectedLighthousePaths.size}/{allLighthouseRoutes.length} selected
                </span>
              </div>
              {allLighthouseRoutes.map((route) => {
                const checked = selectedLighthousePaths.has(route.path);
                return (
                  <label
                    key={route.path}
                    className={`flex items-center gap-2 text-xs cursor-pointer rounded px-2 py-1 ${
                      checked ? 'bg-teal-500/10' : 'hover:bg-[var(--color-bg-secondary)]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="rounded border-[var(--color-bg-border)]"
                      checked={checked}
                      disabled={isRunning}
                      onChange={() => toggleLighthousePath(route.path)}
                    />
                    <span className="font-medium text-[var(--color-text-primary)] truncate">{route.name}</span>
                    <code className="text-[10px] text-[var(--color-text-muted)] truncate">{route.path}</code>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const resolveLighthouseReport = () => {
    if (latestResults?.lighthouseReport?.pages?.length) return latestResults.lighthouseReport;
    if (progressData?.lighthouseReport?.pages?.length) return progressData.lighthouseReport;
    const fromCases = (latestResults?.testCases || progressData?.testCases || [])
      .filter((t) => t.category === LIGHTHOUSE_CATEGORY && t.result?.lighthouse)
      .map((t) => t.result.lighthouse);
    if (!fromCases.length) return null;
    return {
      pages: fromCases,
      summary: {
        heavy: fromCases.filter((p) => p.weight === 'heavy').length,
        medium: fromCases.filter((p) => p.weight === 'medium').length,
        light: fromCases.filter((p) => p.weight === 'light').length,
      },
      baseUrl: latestResults?.lighthouseReport?.baseUrl,
      generatedAt: latestResults?.lighthouseReport?.generatedAt,
    };
  };

  const handleCopyLighthouseReport = useCallback(
    async (format = 'plain') => {
      const report = resolveLighthouseReport();
      if (!report?.pages?.length) {
        toastError('No Lighthouse report to copy yet', { module: MODULE.SYSTEM });
        return;
      }
      try {
        const text =
          format === 'markdown'
            ? formatLighthouseReportMarkdown(report)
            : formatLighthouseReportPlain(report);
        await copyTextToClipboard(text);
        toastSuccess(
          format === 'markdown' ? 'Lighthouse markdown copied' : 'Lighthouse report copied',
          { module: MODULE.SYSTEM }
        );
      } catch (err) {
        toastError(err.message || 'Failed to copy Lighthouse report', { module: MODULE.SYSTEM });
      }
    },
    [latestResults, progressData, toastSuccess, toastError]
  );

  const renderLighthousePanel = () => {
    const report = resolveLighthouseReport();
    if (!report?.pages?.length) return null;

    const pages = [...report.pages].sort(
      (a, b) =>
        (LIGHTHOUSE_WEIGHT_ORDER[a.weight] ?? 9) - (LIGHTHOUSE_WEIGHT_ORDER[b.weight] ?? 9) ||
        (b.performance ?? 0) - (a.performance ?? 0)
    );
    const summary = report.summary || {
      heavy: pages.filter((p) => p.weight === 'heavy').length,
      medium: pages.filter((p) => p.weight === 'medium').length,
      light: pages.filter((p) => p.weight === 'light').length,
    };

    return (
      <div className="mt-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <Gauge className="text-teal-600 dark:text-teal-400" /> Lighthouse — {pages.length} page{pages.length === 1 ? '' : 's'}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handleCopyLighthouseReport('plain')} className="gap-1.5">
              <Copy size={14} /> Copy report
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleCopyLighthouseReport('markdown')} className="gap-1.5">
              <Copy size={14} /> Copy markdown
            </Button>
            <div className="flex flex-wrap gap-2 text-xs font-bold">
            <span className="px-2.5 py-1 rounded-full border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300">
              {summary.heavy} heavy
            </span>
            <span className="px-2.5 py-1 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200">
              {summary.medium} medium
            </span>
            <span className="px-2.5 py-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              {summary.light} light
            </span>
            </div>
          </div>
        </div>

        {report.baseUrl && (
          <p className="text-xs text-[var(--color-text-muted)]">
            Base URL: <code className="font-mono">{report.baseUrl}</code>
            {report.generatedAt ? ` · ${new Date(report.generatedAt).toLocaleString()}` : ''}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {pages.map((page) => {
            const w = LIGHTHOUSE_WEIGHT_STYLES[page.weight] || LIGHTHOUSE_WEIGHT_STYLES.medium;
            return (
              <div
                key={page.path}
                className={`p-4 rounded-xl border-2 ${w.card} transition-shadow hover:shadow-md`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-[var(--color-text-primary)] truncate">{page.name}</div>
                    <code className="text-[10px] text-[var(--color-text-muted)]">{page.path}</code>
                  </div>
                  <span className={`shrink-0 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${w.badge}`}>
                    {w.label}
                  </span>
                </div>
                {page.error ? (
                  <p className="text-xs text-red-600 dark:text-red-400">{page.error}</p>
                ) : (
                  <>
                    <div className="flex gap-3 text-sm font-semibold mb-2">
                      <span title="Performance">Perf {page.performance ?? '—'}</span>
                      <span title="Accessibility">A11y {page.accessibility ?? '—'}</span>
                    </div>
                    {(page.lcpDisplay || page.fcpDisplay) && (
                      <p className="text-[10px] text-[var(--color-text-muted)] mb-1">
                        {page.fcpDisplay ? `FCP ${page.fcpDisplay}` : ''}
                        {page.lcpDisplay ? ` · LCP ${page.lcpDisplay}` : ''}
                        {page.unusedKiB ? ` · ~${page.unusedKiB} KiB unused JS` : ''}
                      </p>
                    )}
                    {page.topIssue?.title && (
                      <p className="text-[10px] text-[var(--color-text-secondary)] line-clamp-2" title={page.topIssue.title}>
                        {page.topIssue.title}
                        {page.topIssue.displayValue ? ` (${page.topIssue.displayValue})` : ''}
                      </p>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

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
            <div key={cat} className="p-5 border border-[var(--color-bg-border)]">
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
            </div>
          );
        })}
      </div>
    );
  };

  const renderExecutiveSummary = () => {
    const exec = latestResults?.executiveSummary;
    const cleanup = latestResults?.cleanupVerification;
    if (!exec && !cleanup) return null;

    const layerSummary = exec?.layerSummary || {};
    return (
      <div className="mb-8 p-5 border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] bg-[var(--color-bg-secondary)]">
        <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">Executive summary</h2>
        {exec && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
            <div><span className="text-[var(--color-text-muted)]">Total</span><div className="font-bold">{exec.totalTests}</div></div>
            <div><span className="text-[var(--color-text-muted)]">Pass</span><div className="font-bold text-emerald-600">{exec.passed}</div></div>
            <div><span className="text-[var(--color-text-muted)]">Fail</span><div className="font-bold text-red-600">{exec.failed}</div></div>
            <div><span className="text-[var(--color-text-muted)]">Coverage</span><div className="font-bold">{exec.passRate}%</div></div>
          </div>
        )}
        {Object.keys(layerSummary).length > 0 && (
          <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase mb-3">
            {Object.entries(layerSummary).map(([layer, s]) => (
              <span key={layer} className="px-2 py-1 rounded border border-[var(--color-bg-border)]">
                {layer}: {s.passed}/{s.total} pass{s.failed ? ` · ${s.failed} fail` : ''}
              </span>
            ))}
          </div>
        )}
        {cleanup && (
          <p className={`text-xs font-mono ${cleanup.passed ? 'text-emerald-600' : 'text-red-600'}`}>
            Cleanup: {cleanup.passed ? 'verified — 0 residuals' : `FAILED — ${cleanup.failReason || 'residual QA data'}`}
            {cleanup.created && cleanup.deleted && (
              <span className="text-[var(--color-text-muted)]">
                {' '}· created tasks {cleanup.created.tasks ?? 0} / deleted {cleanup.deleted.tasks ?? 0}
              </span>
            )}
          </p>
        )}
      </div>
    );
  };

  // Render dynamic-scan bugs (excludes pre-deploy checklist failures shown above)
  const renderBugList = () => {
    if (!latestResults || !latestResults.testCases) return null;

    const bugs = latestResults.testCases.filter(
      (t) =>
        t.status === 'failed' &&
        !PREDEPLOY_CATEGORIES.has(t.category) &&
        t.category !== LIGHTHOUSE_CATEGORY
    );
    const checklistFailCount = latestResults.checklistSummary?.fail || 0;

    if (bugs.length === 0) {
      return (
        <div className={`p-8 text-center mt-6 border ${checklistFailCount > 0 ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200' : 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'}`}>
          <CheckCircle className={`mx-auto mb-3 ${checklistFailCount > 0 ? 'text-amber-500' : 'text-emerald-500'}`} size={40} />
          <h3 className={`text-xl font-bold ${checklistFailCount > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
            {checklistFailCount > 0 ? 'No Dynamic Scan Bugs' : 'Zero Bugs Found'}
          </h3>
          <p className={`mt-1 ${checklistFailCount > 0 ? 'text-amber-600' : 'text-emerald-600 dark:text-emerald-500'}`}>
            {checklistFailCount > 0
              ? `Page pentest clean; ${checklistFailCount} pre-deploy check(s) failed above.`
              : 'The agent completed testing with a 100% pass rate.'}
          </p>
        </div>
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
              <div key={bug._id} className={`p-5 border border-[var(--color-bg-border)] transition-all ${isResolved ? 'opacity-60 grayscale' : 'border-l-4 border-l-rose-500'}`}>
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
              </div>
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
        icon={ShieldAlert}
        actions={
          <div className="flex flex-wrap items-center gap-2 justify-end">
            {latestResults && !isRunning && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleCopyErrors(false)}
                  className="gap-1.5"
                >
                  <Copy size={14} /> Copy errors
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCopyFullReport}
                  className="gap-1.5"
                >
                  <Copy size={14} /> Copy full report
                </Button>
              </>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                const ok = await confirm({
                  title: 'Purge QA test data?',
                  message: 'Removes QA probe tasks (titles starting with QA, [QA BUG], etc.), probe users, CRM/Data Hub rows, QA activity logs, daily log entries from QA task flows, and XP audit entries from tests — then re-syncs affected users’ total XP. Production data outside QA patterns is not affected.',
                  confirmLabel: 'Purge',
                  type: 'danger',
                });
                if (ok) cleanupMutation.mutate();
              }}
              disabled={cleanupMutation.isPending || isRunning}
              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 gap-2"
            >
              {cleanupMutation.isPending ? <RefreshCw className="animate-spin" size={16} /> : <Trash2 size={16} />}
              Purge QA Test Data
            </Button>
          </div>
        }
      />

      <div className="max-w-6xl mx-auto py-6 space-y-8">

        {/* Control Panel / Test Runner */}
        <section className="p-6 overflow-hidden relative min-h-[300px] flex flex-col justify-center border border-[var(--color-bg-border)]">
          {(historyLoading || projectsLoading) && !historyData ? (
            <LoadingState showPhrase />
          ) : isRunning ? (
            <div className="bg-white dark:bg-gray-900 p-8 rounded-[var(--radius-atomic)] border border-blue-200 dark:border-blue-800/50 w-full max-w-4xl mx-auto">
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

                <div className="bg-blue-50 dark:bg-black/40 border border-blue-100 dark:border-blue-800/50 p-4 rounded-[var(--radius-atomic)] space-y-3">
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
                  <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3 rounded-[var(--radius-atomic)] text-sm text-red-700 dark:text-red-300">
                    Run error ({currentRun.errorDetails.phase}): {currentRun.errorDetails.message}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-8 relative z-0">

              {/* Left: Categories & Agent Selection */}
              <div className="space-y-6">
                {renderCategoryPicker()}

                <div>
                  <label className="block text-sm font-bold text-[var(--color-text-primary)] mb-3 uppercase tracking-wide">Select QA Identity</label>
                  <div className="grid gap-3">
                    {QA_AGENTS.map(agent => (
                      <div
                        key={agent.id}
                        onClick={() => !isRunning && setSelectedAgent(agent)}
                        className={`flex items-center gap-4 p-3 rounded-[var(--radius-atomic)] border-2 cursor-pointer transition-all ${selectedAgent.id === agent.id
                            ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10'
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
                  <p className="text-xs text-[var(--color-text-muted)] mt-2">{QA_EXCLUDED_STAFF_NOTE}</p>
                </div>
              </div>

              {/* Right: Actions & Info */}
              <div className="flex flex-col justify-between bg-[var(--color-bg-secondary)] p-6 rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)]">
                <div>
                  <h3 className="font-bold text-lg mb-2 text-[var(--color-text-primary)]">Pre-Flight Checks</h3>
                  <ul className="space-y-3 text-sm text-[var(--color-text-secondary)] mb-6">
                    <li className="flex items-center gap-2"><CheckCircle size={16} className="text-emerald-500" /> Pre-deploy + Suite 5 (task history, mail pipeline, exclusions)</li>
                    <li className="flex items-center gap-2"><CheckCircle size={16} className="text-emerald-500" /> Dynamic page pentest (CRM, Finance, Projects)</li>
                    <li className="flex items-center gap-2"><CheckCircle size={16} className="text-emerald-500" /> Agent {selectedAgent.name} primed with {selectedAgent.role} access</li>
                  </ul>
                </div>

                <Button
                  onClick={handleStart}
                  disabled={isRunning || startMutation.isPending || selectedCategories.size === 0}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-2 py-4 rounded-[var(--radius-atomic)] text-lg font-bold transition-all disabled:opacity-50"
                >
                  {startMutation.isPending ? <RefreshCw className="animate-spin" size={20} /> : <Play size={20} fill="currentColor" />}
                  {runButtonLabel}
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Results Section */}
        {latestResults && !isRunning && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {renderExecutiveSummary()}
            {renderPreDeploymentChecklist()}
            {renderLighthousePanel()}
            {renderBugList()}
          </div>
        )}

      </div>
    </PageContainer>
  );
};

export default QATestingPage;
