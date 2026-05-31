import React, { useState } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bug, Play, XCircle, RefreshCw, Trash2, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { PageContainer, PageHeader, Card, Button, Badge } from '../../components/ui';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'react-hot-toast';
import { useProjects } from '../../hooks/useTaskmasterQueries';

// Helper for polling
const useQAProgress = (projectId, testRunId) => {
  return useQuery({
    queryKey: ['qa-progress', projectId, testRunId],
    queryFn: async () => {
      if (!testRunId) return null;
      const { data } = await axios.get(`/api/projects/${projectId}/qa/progress?testRunId=${testRunId}`);
      return data;
    },
    enabled: !!projectId && !!testRunId,
    refetchInterval: (data) => (data?.status === 'running' || data?.status === 'pending' ? 3000 : false),
  });
};

const QATestingPage = () => {
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState('');
  
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['qa-history', selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return { runs: [] };
      const { data } = await axios.get(`/api/projects/${selectedProjectId}/qa/history`);
      return data;
    },
    enabled: !!selectedProjectId,
  });

  const activeRun = historyData?.runs?.find(r => r.status === 'running' || r.status === 'pending');
  const [activeTestRunId, setActiveTestRunId] = useState(activeRun?._id || null);

  const { data: progressData } = useQAProgress(selectedProjectId, activeTestRunId);

  // Sync activeRun to state
  React.useEffect(() => {
    if (activeRun && !activeTestRunId) {
      setActiveTestRunId(activeRun._id);
    } else if (!activeRun && progressData?.status === 'completed') {
      setActiveTestRunId(null);
      queryClient.invalidateQueries(['qa-history', selectedProjectId]);
    }
  }, [activeRun, activeTestRunId, progressData, queryClient, selectedProjectId]);

  const startMutation = useMutation({
    mutationFn: async (opts) => {
      const { data } = await axios.post(`/api/projects/${selectedProjectId}/qa/start`, opts);
      return data;
    },
    onSuccess: (data) => {
      toast.success('QA Test started successfully');
      setActiveTestRunId(data.testRun._id);
      queryClient.invalidateQueries(['qa-history', selectedProjectId]);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to start QA test');
    }
  });

  const cancelMutation = useMutation({
    mutationFn: async (testRunId) => {
      await axios.post(`/api/projects/${selectedProjectId}/qa/cancel/${testRunId}`);
    },
    onSuccess: () => {
      toast.success('Test cancelled');
      setActiveTestRunId(null);
      queryClient.invalidateQueries(['qa-history', selectedProjectId]);
    }
  });

  const cleanupMutation = useMutation({
    mutationFn: async (testRunId) => {
      await axios.post(`/api/projects/${selectedProjectId}/qa/cleanup/${testRunId}`);
    },
    onSuccess: () => {
      toast.success('Cleanup completed');
      queryClient.invalidateQueries(['qa-history', selectedProjectId]);
    }
  });

  const handleStart = () => {
    if (!selectedProjectId) return;
    startMutation.mutate({ scope: 'full' });
  };

  const currentRun = activeTestRunId ? (progressData || activeRun) : null;

  return (
    <PageContainer>
      <PageHeader 
        title="QA Testing Agent" 
        subtitle="Automated end-to-end testing and bug discovery"
        icon={Bug}
      />

      <div className="max-w-5xl mx-auto py-6 space-y-6">
        <Card className="p-6">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-end mb-6">
            <div className="flex-1 w-full">
              <label className="block text-sm font-semibold text-[var(--color-text-secondary)] mb-2">Select Project to Test</label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full md:w-96 p-3 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-lg text-[var(--color-text-primary)] focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                disabled={!!activeTestRunId}
              >
                <option value="">-- Choose a Project --</option>
                {projects.map(p => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            </div>
            
            {selectedProjectId && (
              <Button 
                onClick={handleStart} 
                disabled={!!activeTestRunId || startMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-2 py-3 px-6 rounded-lg"
              >
                {startMutation.isPending ? <RefreshCw className="animate-spin" size={18} /> : <Play size={18} />}
                Start QA Test
              </Button>
            )}
          </div>

          {currentRun && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                  <RefreshCw className="animate-spin text-blue-500" size={18} /> 
                  Testing in Progress...
                </h3>
                <Button size="sm" variant="outline" onClick={() => cancelMutation.mutate(currentRun._id)} className="text-rose-500 border-rose-200 hover:bg-rose-50">
                  <XCircle size={14} className="mr-1" /> Cancel
                </Button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1 text-blue-800 dark:text-blue-200">
                    <span>Progress ({currentRun.progress || 0}%)</span>
                    <span>{currentRun.completedTasks || 0} / {currentRun.totalTasks || 0} tasks</span>
                  </div>
                  <div className="w-full bg-blue-200/50 dark:bg-blue-800/50 rounded-full h-3">
                    <div 
                      className="bg-blue-500 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${currentRun.progress || 0}%` }}
                    />
                  </div>
                </div>

                <div className="bg-white/50 dark:bg-black/20 p-3 rounded-lg text-sm text-blue-900 dark:text-blue-100 font-mono">
                  {currentRun.currentAction || 'Initializing agent framework...'}
                </div>
              </div>
            </div>
          )}
        </Card>

        {selectedProjectId && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-[var(--color-text-primary)] flex items-center gap-2">
              <Clock size={18} /> Test History
            </h3>
            
            {historyLoading ? (
              <div className="text-center py-8 text-[var(--color-text-muted)]">Loading history...</div>
            ) : historyData?.runs?.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-[var(--color-bg-border)] rounded-xl text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)]/30">
                No QA tests have been run for this project yet.
              </div>
            ) : (
              <div className="grid gap-4">
                {historyData?.runs?.map(run => (
                  <Card key={run._id} className="p-5 flex flex-col md:flex-row justify-between md:items-center gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-bold text-[var(--color-text-primary)] text-sm">{new Date(run.startTime).toLocaleString()}</span>
                        {run.status === 'completed' && <Badge variant="success">Completed</Badge>}
                        {run.status === 'failed' && <Badge variant="error">Failed</Badge>}
                        {run.status === 'cancelled' && <Badge variant="warning">Cancelled</Badge>}
                        {(run.status === 'running' || run.status === 'pending') && <Badge variant="info">Running</Badge>}
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">
                        Scope: {run.scope} • Agent: {run.agentVersion}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-sm font-semibold text-[var(--color-text-primary)]">{run.bugsFound?.length || 0}</div>
                        <div className="text-[10px] uppercase text-[var(--color-text-muted)] tracking-wider">Bugs Found</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-semibold text-[var(--color-text-primary)]">{run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : '-'}</div>
                        <div className="text-[10px] uppercase text-[var(--color-text-muted)] tracking-wider">Duration</div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {run.status === 'completed' && run.cleanupStatus !== 'completed' && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => cleanupMutation.mutate(run._id)}
                            title="Cleanup test data"
                          >
                            <Trash2 size={14} />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost">View Details</Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  );
};

export default QATestingPage;
