import React, { useState, useCallback } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bug, Play, XCircle, RefreshCw, Trash2, CheckCircle, Clock, AlertTriangle, ShieldAlert, Monitor, Smartphone, Server, Database, Timer, Layout, Check, Shield, Copy } from 'lucide-react';
import { PageContainer, PageHeader, Card, Button, Badge } from '../../components/ui';
import { toast } from 'react-hot-toast';
import { useProjects } from '../../hooks/useTaskmasterQueries';

// Icons mapped to test categories
const categoryIcons = {
  frontend: Layout,
  desktop: Monitor,
  mobile: Smartphone,
  backend: Server,
  permission: ShieldAlert,
  data: Database,
  bottleneck: Timer
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
    refetchInterval: 1000,
  });
};

const QATestingPage = () => {
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
        toast.success('Omni-Security Test Completed!');
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
      toast.success('Omni-Security Engine Initiated.');
      setActiveTestRunId(data.testRunId);
      queryClient.invalidateQueries(['qa-history']);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to start QA test');
    }
  });

  const cancelMutation = useMutation({
    mutationFn: async (testRunId) => {
      await axios.post(`/api/qa/cancel/${testRunId}`);
    },
    onSuccess: () => {
      toast.success('Test cancelled');
      setActiveTestRunId(null);
      queryClient.invalidateQueries(['qa-history']);
    }
  });

  const cleanupMutation = useMutation({
    mutationFn: async (testRunId) => {
      await axios.post(`/api/qa/cleanup/${testRunId}`);
    },
    onSuccess: () => {
      toast.success('All test data purged successfully');
      queryClient.invalidateQueries(['qa-history']);
      queryClient.invalidateQueries(['qa-results']);
    }
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ testRunId, testCaseId }) => {
      await axios.post(`/api/qa/resolve/${testRunId}/${testCaseId}`);
    },
    onSuccess: () => {
      toast.success('Bug marked as resolved');
      queryClient.invalidateQueries(['qa-results']);
    }
  });

  const handleStart = useCallback(() => {
    startMutation.mutate();
  }, [startMutation]);

  const handleCopyErrors = useCallback(() => {
    if (!latestResults || !latestResults.testCases) return;
    const failedBugs = latestResults.testCases.filter(t => t.status === 'failed');
    if (failedBugs.length === 0) return;

    let textToCopy = 'QA Testing Error Report\n' + '='.repeat(30) + '\n\n';

    failedBugs.forEach((bug, index) => {
      textToCopy += `${index + 1}. [${(bug.severity || 'Medium').toUpperCase()}] ${bug.name}\n`;
      textToCopy += `   Category: ${bug.category}\n`;
      textToCopy += `   Error: ${bug.error}\n`;
      if (bug.description) {
        textToCopy += `   Details: ${bug.description}\n`;
      }
      textToCopy += `   Status: ${bug.resolved ? 'Resolved' : 'Open'}\n\n`;
    });

    navigator.clipboard.writeText(textToCopy).then(() => {
      toast.success('Error report copied to clipboard');
    }).catch(err => {
      toast.error('Failed to copy to clipboard');
      console.error(err);
    });
  }, [latestResults]);

  const currentRun = activeTestRunId ? (progressData || activeRun) : null;
  const isRunning = currentRun && ['running', 'pending', 'in-progress'].includes(currentRun.status);

  // Render bugs if there are results
  const renderBugList = () => {
    if (!latestResults || !latestResults.testCases) return null;

    const bugs = latestResults.testCases.filter(t => t.status === 'failed');
    if (bugs.length === 0) {
      return (
        <Card className="p-8 text-center mt-6 bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800">
          <CheckCircle className="mx-auto text-emerald-500 mb-3" size={40} />
          <h3 className="text-xl font-bold text-emerald-700 dark:text-emerald-400">Zero Bugs Found</h3>
          <p className="text-emerald-600 dark:text-emerald-500 mt-1">The agent completed testing with a 100% pass rate.</p>
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyErrors}
            className="text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Copy size={16} className="mr-2" /> Copy Report
          </Button>
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
                  <p className="text-sm text-blue-600 dark:text-blue-400">Executing multi-layered autonomous test suite.</p>
                </div>
                <Button variant="outline" onClick={() => cancelMutation.mutate(currentRun._id)} className="text-rose-500 border-rose-200 hover:bg-rose-50">
                  <XCircle size={16} className="mr-2" /> Cancel Test
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex flex-col sm:flex-row sm:justify-between text-sm font-bold mb-2 text-blue-800 dark:text-blue-200 gap-2 sm:gap-0">
                    <span>Overall Progress: {currentRun.progress?.current || 0}%</span>
                    <span>{currentRun.pagesTestedCount || 0} / {currentRun.progress?.totalPages || 0} test cases</span>
                  </div>
                  <div className="w-full bg-blue-100 dark:bg-blue-900/50 rounded-full h-4 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all duration-500 ease-out"
                      style={{ width: `${currentRun.progress?.current || 0}%` }}
                    />
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-black/40 border border-blue-100 dark:border-blue-800/50 p-4 rounded-xl">
                  <div className="text-xs uppercase font-bold text-blue-500 tracking-wider mb-1">Currently Testing</div>
                  <div className="text-blue-900 dark:text-blue-100 font-mono text-sm">
                    {currentRun.progress?.currentPage || 'Initializing framework...'}
                  </div>
                </div>
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
                    <li className="flex items-center gap-2"><CheckCircle size={16} className="text-emerald-500" /> Multi-layered tests prepared (Frontend, Backend, Bottleneck)</li>
                    <li className="flex items-center gap-2"><CheckCircle size={16} className="text-emerald-500" /> Agent {selectedAgent.name} primed with {selectedAgent.role} access</li>
                    <li className="flex items-center gap-2"><CheckCircle size={16} className="text-emerald-500" /> Plain-english reporting module online</li>
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
