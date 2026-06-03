import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Button } from './ui';
import { NexusModal } from './ui/modals';;

const QATestingProgress = ({ projectId, testRunId, isOpen, onClose }) => {
  const [testData, setTestData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !projectId || !testRunId) return;

    setLoading(true);
    
    const fetchProgress = async () => {
      try {
        const response = await axios.get(`/api/projects/${projectId}/qa/progress?testRunId=${testRunId}`);
        setTestData(response.data);
        setError(null);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to fetch progress');
      } finally {
        setLoading(false);
      }
    };

    // Fetch immediately
    fetchProgress();

    // Poll every 2 seconds
    const interval = setInterval(fetchProgress, 2000);

    return () => clearInterval(interval);
  }, [isOpen, projectId, testRunId]);

  // Socket.io listener for real-time updates
  useEffect(() => {
    if (!projectId || typeof window === 'undefined') return;

    const handleProgressUpdate = (data) => {
      if (data.testRunId === testRunId) {
        setTestData(prev => ({
          ...prev,
          progress: data.progress || prev?.progress,
          currentPage: data.currentPage || prev?.currentPage,
          pagesTestedCount: data.completed || prev?.pagesTestedCount,
          total: data.total || prev?.progress?.totalPages
        }));
      }
    };

    // Register listener if socket exists (assuming socket.io is available)
    const socket = window.__SOCKET_IO_INSTANCE;
    if (socket) {
      socket.on(`qa-progress:${projectId}`, handleProgressUpdate);
      return () => socket.off(`qa-progress:${projectId}`, handleProgressUpdate);
    }
  }, [projectId, testRunId]);

  if (!isOpen) return null;

  const progress = testData?.progress?.current || 0;
  const currentPage = testData?.progress?.currentPage || 'Initializing';
  const completed = testData?.pagesTestedCount || 0;
  const total = testData?.progress?.totalPages || 0;
  const status = testData?.status || 'pending';

  const isComplete = status === 'completed';
  const hasError = status === 'error';

  return (
    <NexusModal
      isOpen={isOpen}
      onClose={onClose}
      showFooter={false}
      title="QA Testing Progress"
      className="max-w-2xl"
    >
      <div className="space-y-6 pt-4">
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-400">{error}</div>
          </div>
        )}

        {/* Circular Progress */}
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="relative w-32 h-32">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
              {/* Background circle */}
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke="var(--color-bg-border)"
                strokeWidth="3"
              />
              {/* Progress circle */}
              <motion.circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke="url(#progressGradient)"
                strokeWidth="3"
                strokeDasharray={2 * Math.PI * 50}
                initial={{ strokeDashoffset: 2 * Math.PI * 50 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 50 * (1 - progress / 100) }}
                transition={{ duration: 0.5 }}
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="rgb(59, 130, 246)" />
                  <stop offset="100%" stopColor="rgb(139, 92, 246)" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-3xl font-black text-white">{progress}%</div>
              <div className="text-xs text-gray-400">{completed}/{total} tests</div>
            </div>
          </div>

          {/* Status */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              {isComplete && <CheckCircle2 className="w-5 h-5 text-green-500" />}
              {hasError && <XCircle className="w-5 h-5 text-red-500" />}
              {!isComplete && !hasError && <Loader className="w-5 h-5 text-blue-500 animate-spin" />}
              <span className="font-bold text-sm capitalize">{status}</span>
            </div>
            <div className="text-gray-400 text-xs">{currentPage}</div>
          </div>
        </div>

        {/* Test Cases */}
        {testData?.testCases && testData.testCases.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Test Cases</h3>
            <div className="max-h-48 overflow-y-auto space-y-1 text-xs">
              <AnimatePresence>
                {testData.testCases.map((testCase, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 p-2 bg-[var(--color-bg-primary)] rounded border border-[var(--color-bg-border)]"
                  >
                    {testCase.status === 'passed' && <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />}
                    {testCase.status === 'failed' && <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                    {testCase.status === 'running' && <Loader className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />}
                    {!['passed', 'failed', 'running'].includes(testCase.status) && <AlertCircle className="w-4 h-4 text-gray-500 flex-shrink-0" />}
                    
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{testCase.name}</div>
                      <div className="text-gray-500">{testCase.category}</div>
                    </div>
                    
                    {testCase.duration && (
                      <div className="text-gray-500 flex-shrink-0">{testCase.duration}ms</div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Bugs Identified */}
        {testData?.bugsIdentified > 0 && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <div className="text-sm font-bold text-amber-400">
              {testData.bugsIdentified} bug{testData.bugsIdentified !== 1 ? 's' : ''} identified
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end border-t border-[var(--color-bg-border)] pt-4">
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            disabled={!isComplete && !hasError}
          >
            {isComplete || hasError ? 'Close' : 'Keep Watching'}
          </Button>
          {isComplete && (
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                // Could navigate to results page
                onClose();
              }}
            >
              View Results
            </Button>
          )}
        </div>
      </div>
    </NexusModal>
  );
};

export default QATestingProgress;
