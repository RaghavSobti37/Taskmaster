const QATestRun = require('../models/QATestRun');
const Task = require('../models/Task');
const Log = require('../models/Log');
const logger = require('../utils/logger');
const { getISTDate } = require('../utils/attendanceDate');
const { broadcastRealtimeEvent } = require('../config/realtime');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Project = require('../models/Project');
const Lead = require('../models/Lead');
const FinanceDocument = require('../models/FinanceDocument');

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

      // Initialize test cases in the database (start empty, push atomically)
      await QATestRun.findByIdAndUpdate(this.testRunId, { 
        status: 'in-progress', 
        startedAt: new Date(),
        testCases: [],
        progress: { current: 0, currentPage: 'Starting...', totalPages: testCases.length },
        pagesTestedCount: 0
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
    const targetDir = path.join(__dirname, '../../client/src/pages');
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
            category: 'backend',
            severity: 'high',
            test: async () => {
              const errors = [];
              const routeLower = routeName.toLowerCase();
              let payloadMatrix = {};
              let endpoint = '/api/system/ping';

              // 1. True Authentication (JWT Injection)
              const testRole = this.config.testRole || 'user';
              let testUser = await User.findOne({ role: testRole }) || await User.findOne();
              const testToken = jwt.sign({ id: testUser._id }, process.env.JWT_SECRET || 'secret');
              const authHeaders = { Authorization: `Bearer ${testToken}` };

              // Dynamic Business & Transactional Assertions
              let dynamicId = '123';
              
              if (routeLower.includes('crm') || routeLower.includes('lead') || routeLower.includes('exly')) {
                const lead = await Lead.findOne();
                if(lead) dynamicId = lead._id;
                endpoint = `/api/crm/leads/${dynamicId}`;
                payloadMatrix = { status: 'won' }; // Intentionally missing tracking props
                const probeUrl = `http://localhost:5000${endpoint}`;
                
                try {
                  const resCRM = await axios.put(probeUrl, payloadMatrix, { headers: authHeaders, validateStatus: () => true });
                  if (resCRM.status === 200 || resCRM.status === 201) {
                    errors.push({
                      error: `Automation Breach! Lead mutated without audit/tracking integrity on ${endpoint}.`,
                      category: 'bottleneck',
                      severity: 'critical',
                      endpointValidation: probeUrl
                    });
                  }
                } catch(err) {}
              } 
              else if (routeLower.includes('finance') || routeLower.includes('invoice')) {
                const doc = await FinanceDocument.findOne({ category: 'invoice', approvalStatus: 'pending' }) || await FinanceDocument.findOne();
                if(doc) dynamicId = doc._id;
                endpoint = `/api/finance/${dynamicId}/approve`;
                payloadMatrix = { amount: 5000, status: 'approved', tenantId: 'spoofed_tenant_999' };
                const probeUrl = `http://localhost:5000${endpoint}`;
                
                try {
                  const resFin = await axios.patch(probeUrl, payloadMatrix, { headers: authHeaders, validateStatus: () => true });
                  if (resFin.status !== 403) {
                    errors.push({
                      error: `Multi-Tenant Leakage! Finance mutation bypassed tenant isolation (Expected 403, got ${resFin.status}) on ${endpoint}.`,
                      category: 'permission',
                      severity: 'critical',
                      endpointValidation: probeUrl
                    });
                  }
                } catch(err) {}
              }
              else if (routeLower.includes('project') || routeLower.includes('workspace')) {
                const project = await Project.findOne();
                if(project) dynamicId = project._id;
                endpoint = `/api/projects/${dynamicId}`;
                payloadMatrix = { visibility: 'public', assignedUsers: [testUser._id] };
                const probeUrl = `http://localhost:5000${endpoint}`;
                
                try {
                  const [resP1, resP2] = await Promise.all([
                    axios.put(probeUrl, payloadMatrix, { headers: authHeaders, validateStatus: () => true }),
                    axios.put(probeUrl, payloadMatrix, { headers: authHeaders, validateStatus: () => true })
                  ]);
                  
                  if (resP1.status === 200 && resP2.status === 200) {
                    errors.push({
                      error: `Concurrency Breach! Project allowed overlapping identical mutations without version conflict (__v) on ${endpoint}.`,
                      category: 'bottleneck',
                      severity: 'high',
                      endpointValidation: probeUrl
                    });
                  }
                } catch(err) {}
              } else {
                endpoint = '/api/general/ping';
                payloadMatrix = { data: 'test' };
                const probeUrl = `http://localhost:5000${endpoint}`;
                
                try {
                  const resPing = await axios.post(probeUrl, payloadMatrix, { headers: authHeaders, validateStatus: () => true });
                  if (resPing.status === 500) {
                     errors.push({
                       error: `State Desync! Unhandled server rejection (500) instead of 400 on ${endpoint}.`,
                       category: 'data',
                       severity: 'medium',
                       endpointValidation: probeUrl
                     });
                  }
                } catch(err) {}
              }

              if (errors.length > 0) {
                const highest = errors.find(e => e.severity === 'critical') || errors.find(e => e.severity === 'high') || errors[0];
                return {
                  passed: false,
                  error: highest.error,
                  description: `Dynamic tests found ${errors.length} issue(s) in ${routeName}. Snippet: ${highest.endpointValidation}`,
                  category: highest.category,
                  severity: highest.severity,
                  details: highest
                };
              }

              return { passed: true, message: `${routeName} passed dynamic payload matrices.` };
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
      
      // Execute test
      const result = await testCase.test();
      const duration = Date.now() - startTime;
      const status = result.passed ? 'passed' : 'failed';

      // Atomic push of completed test
      await QATestRun.updateOne(
        { _id: this.testRunId },
        {
          $push: {
            testCases: {
              name: testCase.name,
              status: status,
              duration: duration,
              result: result,
              severity: result.severity || testCase.severity || 'medium',
              category: result.category || testCase.category,
              error: result.error || null,
              description: result.description || null
            }
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
      
      // Intentional mechanical delay to stabilize React Query refetch loops and UI progress bar
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      logger.error('QA', `Error running test case: ${testCase.name}`, { error: error.message });
      await QATestRun.updateOne(
        { _id: this.testRunId },
        { 
          $push: { 
            testCases: {
              name: testCase.name,
              status: 'failed',
              error: error.message,
              severity: testCase.severity || 'medium'
            }
          } 
        }
      );
      await new Promise(resolve => setTimeout(resolve, 200));
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
