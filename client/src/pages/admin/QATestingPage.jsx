import React, { useState } from 'react';
import axios from 'axios';
import { Play, CheckCircle2, XCircle, Loader2, Bug } from 'lucide-react';
import { Badge, Button, Card, PageContainer, PageHeader } from '../../components/ui';

const QATestingPage = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTest, setCurrentTest] = useState('');
  const [testResults, setTestResults] = useState([]);
  const [bugs, setBugs] = useState([]);

  const testCases = [
    { name: 'Testing Authentication Middleware', severity: 'High', type: 'Backend' },
    { name: 'Testing Role Permission Leaks', severity: 'High', type: 'Backend' },
    { name: 'Testing DB Index Bottlenecks', severity: 'Medium', type: 'Backend' },
    { name: 'Testing Task Status Workflows', severity: 'High', type: 'Frontend' },
    { name: 'Testing Mobile Responsive Breakpoints', severity: 'Medium', type: 'Frontend' },
    { name: 'Testing CRM Leads Rate Limiting', severity: 'Low', type: 'Backend' },
  ];

  const runQASuite = async () => {
    setIsRunning(true);
    setProgress(0);
    setTestResults([]);
    setBugs([]);

    try {
      // We will perform actual API calls for multi-layered testing
      for (let i = 0; i < testCases.length; i++) {
        setCurrentTest(testCases[i].name);

        let success = true;
        let errorMessage = '';

        try {
          const res = await axios.post('/api/admin/qa/run-test', { testName: testCases[i].name });
          success = res.data.success;
        } catch (err) {
          success = false;
          errorMessage = err.response?.data?.message || err.message;
        }

        setProgress(((i + 1) / testCases.length) * 100);
        setTestResults(prev => [...prev, { ...testCases[i], success }]);

        if (!success) {
          setBugs(prev => [...prev, {
            title: `Bug in ${testCases[i].name}`,
            description: `Detected failure while asserting expected values for ${testCases[i].name}. Agent: QA_ENGINEER_BOT. Error: ${errorMessage}`,
            severity: testCases[i].severity,
            type: testCases[i].type,
            status: 'Open'
          }]);
        }
      }

      await axios.post('/api/admin/qa/cleanup');
    } catch (err) {
      console.error(err);
    } finally {
      setIsRunning(false);
      setCurrentTest('All tests completed.');
    }
  };

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Automated QA Agent Suite"
        subtitle="Multi-layered testing for permission leaks, UI bottlenecks, and API endpoints."
        icon={Bug}
        actions={
          <Button onClick={runQASuite} disabled={isRunning}>
            {isRunning ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Running...</> : <><Play className="w-4 h-4 mr-2" /> Start QA Testing</>}
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-5 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider">Test Progress</h3>

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
              <span>{currentTest || 'Ready to run tests.'}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-[var(--color-bg-workspace)] h-2 rounded-full overflow-hidden">
              <div
                className="bg-blue-500 h-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto mt-4">
            {testResults.map((result, i) => (
              <div key={i} className="flex justify-between items-center text-sm p-2 rounded bg-[var(--color-bg-workspace)]">
                <span className="flex items-center gap-2">
                  {result.success ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-rose-500" />}
                  {result.name}
                </span>
                <Badge variant={result.success ? 'success' : 'danger'}>
                  {result.success ? 'Pass' : 'Fail'}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider">Discovered Bugs</h3>

          {bugs.length === 0 && !isRunning && (
            <p className="text-sm text-[var(--color-text-muted)]">No bugs discovered yet. Run tests to evaluate.</p>
          )}

          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {bugs.map((bug, i) => (
              <div key={i} className="border border-rose-500/30 p-3 rounded-lg bg-rose-500/5 space-y-2">
                <div className="flex justify-between items-start">
                  <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">{bug.title}</h4>
                  <Badge variant={bug.severity === 'High' ? 'danger' : 'warning'}>{bug.severity}</Badge>
                </div>
                <p className="text-xs text-[var(--color-text-muted)]">{bug.description}</p>
                <div className="flex justify-between text-[10px] font-mono text-[var(--color-text-muted)]">
                  <span>Type: {bug.type}</span>
                  <span>Status: {bug.status}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PageContainer>
  );
};

export default QATestingPage;
