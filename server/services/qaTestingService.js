const QATestRun = require('../models/QATestRun');
const Task = require('../models/Task');
const Log = require('../models/Log');
const logger = require('../utils/logger');
const { getISTDate } = require('../utils/attendanceDate');
const { broadcastRealtimeEvent } = require('../config/realtime');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

class QATestingService {
  constructor(projectId, userId, config = {}) {
    this.projectId = projectId;
    this.userId = userId;
    this.config = config;
    this.testRunId = null;
    this.testRun = null;
    this.totalTestCases = 0;
    this.completedTestCases = 0;
  }

  async startTesting() {
    try {
      // Create test run record
      this.testRun = await QATestRun.create({
        projectId: this.projectId,
        initiatedBy: this.userId,
        status: 'pending',
        testIdentity: {
          name: this.config.testAgentName || 'QA Agent',
          role: this.config.testRole || 'user',
          permissions: this.config.permissions || []
        }
      });

      this.testRunId = this.testRun._id;
      logger.info('QA', `Test run created: ${this.testRunId}`);

      // Begin testing
      await this.executeTests();
      
      return { success: true, testRunId: this.testRunId };
    } catch (error) {
      logger.error('QA', 'Error starting testing', { error: error.message });
      if (this.testRunId) {
        await QATestRun.findByIdAndUpdate(this.testRunId, {
          status: 'error',
          errorDetails: {
            phase: 'startup',
            message: error.message,
            stack: error.stack
          },
          completedAt: new Date()
        });
      }
      throw error;
    }
  }

  async executeTests() {
    try {
      const testCases = await this.getTestCases();
      this.totalTestCases = testCases.length;

      // Initialize test cases in the database to prevent defaulting to 'backend'
      await QATestRun.findByIdAndUpdate(this.testRunId, { 
        status: 'in-progress', 
        startedAt: new Date(),
        testCases: testCases.map(tc => ({
          name: tc.name,
          category: tc.category,
          severity: tc.severity,
          status: 'pending'
        }))
      });

      for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        
        // Update progress
        const progress = Math.round((i / testCases.length) * 100);
        await this.updateProgress(progress, testCase.name, i, testCases.length);

        // Execute test
        await this.runTestCase(testCase, i);

        // Broadcast update (global instead of project specific)
        broadcastRealtimeEvent(`qa-test:global`, 'progress', {
          testRunId: this.testRunId,
          progress,
          currentPage: testCase.name,
          completed: i + 1,
          total: testCases.length
        });

        this.completedTestCases++;
      }

      // Process results
      await this.processResults();

      // Cleanup test data
      await this.cleanupTestData();

      // Mark complete
      await QATestRun.findByIdAndUpdate(this.testRunId, {
        status: 'completed',
        completedAt: new Date(),
        progress: { current: 100, currentPage: 'Complete', totalPages: testCases.length }
      });

      logger.info('QA', `Test run completed: ${this.testRunId}`);
    } catch (error) {
      logger.error('QA', 'Error executing tests', { error: error.message });
      await QATestRun.findByIdAndUpdate(this.testRunId, {
        status: 'error',
        errorDetails: {
          phase: 'execution',
          message: error.message,
          stack: error.stack
        },
        completedAt: new Date()
      });
      throw error;
    }
  }

  async getTestCases() {
    const targetDir = path.resolve('c:/Users/ragha/OneDrive/Desktop/Coreknot/client/src/pages');
    const testCases = [];
    
    // Recursive directory reader
    const walk = async (dir) => {
      const files = await fs.readdir(dir, { withFileTypes: true });
      for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
          await walk(fullPath);
        } else if (/\.(js|jsx|tsx)$/.test(file.name)) {
          const content = await fs.readFile(fullPath, 'utf8');
          const routeName = file.name;
          
          testCases.push({
            name: `[${routeName}] Dynamic QA Scan`,
            category: 'frontend',
            severity: 'low',
            test: async () => {
              const errors = [];
              
              // 1. AST/Regex Code Evaluation: Optional Chaining Guard Check
              if (content.includes('return (')) {
                // Matches patterns like `row.email` or `data.user` without `?.` inside JSX curlies
                const riskyChaining = /\{\s*(row|data|lead|user|task)\.([a-zA-Z0-9_]+)\s*\}/g;
                let match;
                while ((match = riskyChaining.exec(content)) !== null) {
                  errors.push({ 
                    error: `Missing optional chaining guard (?. ) on ${match[0]}`, 
                    category: 'data', 
                    severity: 'medium',
                    codeApproximation: match[0]
                  });
                }
              }

              // 2. AST/Regex Code Evaluation: Performance Re-render Check
              const handlerRegex = /const handle[A-Z][a-zA-Z0-9_]*\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g;
              if (handlerRegex.test(content) && !content.includes('useCallback(')) {
                errors.push({ 
                  error: 'Unmemoized event handler detected without useCallback.', 
                  category: 'bottleneck', 
                  severity: 'medium',
                  codeApproximation: 'Event Handler Definition'
                });
              }

              // 3. Extract Target API Routes & Live Backend Probes
              const apiEndpointsMatch = content.match(/\/api\/[a-zA-Z0-9_/-]+/g) || [];
              const endpoints = [...new Set(apiEndpointsMatch)];
              
              for (const endpoint of endpoints) {
                try {
                  const probeUrl = `http://localhost:5000${endpoint}`;
                  // Unauthenticated Probe Request
                  const res = await axios.get(probeUrl, { validateStatus: () => true });
                  
                  // Evaluate Security Status Codes
                  if (res.status === 200 || res.status === 201) {
                    errors.push({ 
                      error: `Unauthenticated API access allowed on ${endpoint} (Status ${res.status}).`,
                      category: 'permission', 
                      severity: 'high',
                      endpointValidation: probeUrl
                    });
                  }
                } catch (err) {
                  // Ignore network failures for probe
                }
              }

              if (errors.length > 0) {
                // Return the highest severity error
                const highest = errors.find(e => e.severity === 'high') || errors.find(e => e.severity === 'medium') || errors[0];
                return {
                  passed: false,
                  error: highest.error,
                  description: `Dynamic test found ${errors.length} issue(s) in ${routeName}. Code snippet: ${highest.codeApproximation || highest.endpointValidation || 'N/A'}`,
                  category: highest.category,
                  severity: highest.severity,
                  details: highest
                };
              }

              return { passed: true, message: `${routeName} passed all dynamic checks and probes.` };
            }
          });
        }
      }
    };

    try {
      await walk(targetDir);
    } catch (err) {
      logger.error('QA', 'Failed to read directory', { error: err.message });
    }

    return testCases;
  }

  async runTestCase(testCase, index) {
    try {
      const startTime = Date.now();
      
      // Update test case status to running
      await QATestRun.updateOne(
        { _id: this.testRunId },
        { $set: { [`testCases.${index}.status`]: 'running' } }
      );

      // Execute test
      const result = await testCase.test();
      const duration = Date.now() - startTime;

      // Update test case with result
      const status = result.passed ? 'passed' : 'failed';
      await QATestRun.updateOne(
        { _id: this.testRunId },
        {
          $set: {
            [`testCases.${index}.status`]: status,
            [`testCases.${index}.duration`]: duration,
            [`testCases.${index}.result`]: result,
            [`testCases.${index}.severity`]: result.severity || testCase.severity || 'medium',
            [`testCases.${index}.category`]: result.category || testCase.category,
            [`testCases.${index}.error`]: result.error || null,
            [`testCases.${index}.description`]: result.description || null
          }
        }
      );

      // Log failed tests
      if (!result.passed) {
        await Log.create({
          userId: this.userId,
          action: 'QA_TEST',
          module: 'QA_TESTING',
          origin: 'QA_AGENT_TEST',
          subsystem: testCase.category,
          severity: 'high',
          status: 'BUG_DETECTED',
          details: {
            testName: testCase.name,
            errorMessage: result.error,
            category: result.category || testCase.category,
            codeApproximation: result.details?.codeApproximation || null,
            endpointValidation: result.details?.endpointValidation || null
          }
        });
      }

      logger.info('QA', `Test case executed: ${testCase.name} - ${status}`, { duration });
    } catch (error) {
      logger.error('QA', `Error running test case: ${testCase.name}`, { error: error.message });
      await QATestRun.updateOne(
        { _id: this.testRunId },
        { $set: { 
            [`testCases.${index}.status`]: 'failed', 
            [`testCases.${index}.error`]: error.message,
            [`testCases.${index}.severity`]: testCase.severity || 'medium'
          } }
      );
    }
  }

  async processResults() {
    try {
      const testRun = await QATestRun.findById(this.testRunId);
      const failedTests = testRun.testCases.filter(t => t.status === 'failed');

      // Count bugs
      const bugsFound = failedTests.length;
      
      // Create tasks for critical/high bugs
      for (const failedTest of failedTests) {
        try {
          const bugTaskData = {
            title: `[QA BUG] ${failedTest.name}`,
            description: `**Test Category:** ${failedTest.category}\n**Error:** ${failedTest.error || 'Unknown'}\n\nThis bug was detected during automated QA testing.`,
            status: 'todo',
            priority: failedTest.category === 'permission' ? 'critical' : 'high',
            createdBy: this.userId,
            assignees: [],
            type: 'Bug'
          };
          if (this.projectId) bugTaskData.projectId = this.projectId;
          const bugTask = await Task.create(bugTaskData);

          await QATestRun.findByIdAndUpdate(this.testRunId, {
            $push: { bugsCreated: bugTask._id },
            bugsIdentified: bugsFound
          });

          // Track artifact for cleanup
          await QATestRun.findByIdAndUpdate(this.testRunId, {
            $push: { createdArtifacts: { type: 'task', id: bugTask._id } }
          });

          logger.info('QA', `Bug task created: ${bugTask._id}`);
        } catch (error) {
          logger.error('QA', `Error creating bug task for ${failedTest.name}`, { error: error.message });
        }
      }

      logger.info('QA', `Test results processed: ${bugsFound} bugs identified`);
    } catch (error) {
      logger.error('QA', 'Error processing test results', { error: error.message });
    }
  }

  async cleanupTestData() {
    try {
      const testRun = await QATestRun.findById(this.testRunId);
      const cleanupResults = { deleted: { tasks: 0, projects: 0, logs: 0 }, errors: [] };

      // Delete created artifacts in reverse order
      for (const artifact of testRun.createdArtifacts.reverse()) {
        try {
          if (artifact.type === 'task') {
            await Task.findByIdAndDelete(artifact.id);
            cleanupResults.deleted.tasks++;
          } else if (artifact.type === 'log') {
            await Log.findByIdAndDelete(artifact.id);
            cleanupResults.deleted.logs++;
          }
        } catch (error) {
          cleanupResults.errors.push(`Failed to delete ${artifact.type} ${artifact.id}: ${error.message}`);
        }
      }

      // Update cleanup results
      await QATestRun.findByIdAndUpdate(this.testRunId, { cleanupResults });
      logger.info('QA', 'Cleanup completed', cleanupResults);
    } catch (error) {
      logger.error('QA', 'Error during cleanup', { error: error.message });
    }
  }

  async updateProgress(current, currentPage, completed, total) {
    try {
      await QATestRun.findByIdAndUpdate(this.testRunId, {
        progress: {
          current,
          currentPage,
          totalPages: total
        },
        pagesTestedCount: completed
      });
    } catch (error) {
      logger.error('QA', 'Error updating progress', { error: error.message });
    }
  }

  async cancelTesting() {
    try {
      await QATestRun.findByIdAndUpdate(this.testRunId, {
        status: 'cancelled',
        completedAt: new Date()
      });
      logger.info('QA', `Test run cancelled: ${this.testRunId}`);
    } catch (error) {
      logger.error('QA', 'Error cancelling test run', { error: error.message });
      throw error;
    }
  }

  async getProgress() {
    try {
      const testRun = await QATestRun.findById(this.testRunId);
      return testRun;
    } catch (error) {
      logger.error('QA', 'Error fetching progress', { error: error.message });
      throw error;
    }
  }
}

module.exports = QATestingService;
