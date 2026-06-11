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
const Contact = require('../models/Contact');
const FinanceDocument = require('../models/FinanceDocument');
const { purgeQaTestData, purgeQaRunArtifacts } = require('./qa/qaTestData');
const DataHubService = require('./DataHubService');
const { buildPreDeploymentTestCases } = require('./qaPreDeploymentChecklist');
const { buildExtendedProbeTestCases } = require('./qa/qaExtendedProbes');
const { buildIntegrationTestCases } = require('./qa/qaIntegrationTests');
const { buildUiDiscoveryTestCases } = require('./qa/qaUiDiscovery');
const { buildPermissionMatrixTestCases } = require('./qa/qaPermissionMatrix');
const { buildWorkflowTestCases } = require('./qa/qaWorkflowTests');
const { buildVisualRegressionTestCases } = require('./qa/qaVisualRegression');
const { takeDbSnapshot, compareSnapshotAfterCleanup } = require('./qa/qaSnapshot');
const { scanQaSideEffects } = require('./qa/qaSideEffects');
const { buildFullReport } = require('./qa/qaReporting');
const { QA_API_BASE } = require('./qa/qaApiClient');
const {
  setQaActivityHook,
  reportQaActivity,
  inferQaMeta,
  formatActivitySummary,
} = require('./qa/qaActivity');

const PREDEPLOY_CATEGORIES = new Set([
  'authorization', 'password-reset', 'input-validation', 'cors', 'rate-limiting',
  'error-handling', 'database-indexes', 'logging-monitoring', 'rollback', 'business-logic',
  'security-hardening',
]);

const LIGHTHOUSE_CATEGORY = 'lighthouse';

const L1_FILTER_CATEGORIES = new Set([
  ...PREDEPLOY_CATEGORIES,
  LIGHTHOUSE_CATEGORY,
  'backend', 'bottleneck', 'data', 'frontend', 'mobile', 'desktop',
]);

const CATEGORY_MATCHERS = {
  'ui-discovery': (tc) =>
    tc.category === 'ui-discovery'
    || tc.qaMeta?.layer === 2
    || String(tc.name || '').startsWith('[UI Discovery]'),
  workflow: (tc) =>
    tc.category === 'workflow'
    || (tc.qaMeta?.layer === 4 && String(tc.name || '').startsWith('[Workflow]')),
  'visual-regression': (tc) =>
    tc.category === 'visual-regression'
    || tc.qaMeta?.layer === 5
    || String(tc.name || '').startsWith('[Visual Regression]'),
  integration: (tc) => String(tc.name || '').startsWith('[Integration]'),
};

function categoriesNeedLayer1(categories) {
  if (!categories?.length) return true;
  return categories.some((c) => L1_FILTER_CATEGORIES.has(String(c).toLowerCase()));
}

function categoriesNeedPageScans(categories) {
  if (!categories?.length) return true;
  return categories.some((c) => String(c).toLowerCase() === 'backend');
}

function categoriesNeedLighthouse(categories) {
  if (!categories?.length) return true;
  return categories.map((c) => String(c).toLowerCase()).includes(LIGHTHOUSE_CATEGORY);
}

function filterTestCasesByCategories(testCases, categories) {
  if (!categories?.length) return testCases;
  const allowed = categories.map((c) => String(c).toLowerCase());
  return testCases.filter((tc) =>
    allowed.some((key) => {
      const matcher = CATEGORY_MATCHERS[key];
      if (matcher) return matcher(tc);
      return String(tc.category || '').toLowerCase() === key;
    })
  );
}

class QATestingService {
  constructor(projectId, userId, config = {}) {
    this.projectId = projectId;
    this.userId = userId;
    this.config = config;
    this.testRunId = null;
    this.testRun = null;
    this.totalTestCases = 0;
    this.completedTestCases = 0;
    this.dbSnapshotBefore = null;
    this.runStartedAt = null;
    this.createdDuringRun = { tasks: 0, leads: 0, contacts: 0, users: 0, finance: 0, projects: 0, notifications: 0 };
  }

  async initTestRun() {
    this.testRun = await QATestRun.create({
      projectId: this.projectId,
      initiatedBy: this.userId,
      status: 'pending',
      selectedCategories: this.config.categories?.length ? this.config.categories : [],
      selectedLighthousePaths: this.config.lighthousePaths?.length ? this.config.lighthousePaths : [],
      testIdentity: {
        name: this.config.testAgentName || 'QA Agent',
        role: this.config.testRole || 'user',
        permissions: this.config.permissions || [],
      },
    });
    this.testRunId = this.testRun._id;
    logger.info('QA', `Test run created: ${this.testRunId}`);
    return this.testRunId;
  }

  async startTesting() {
    try {
      await this.initTestRun();
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
    process.env.QA_SYNC_GAMIFICATION = 'true';
    try {
      this.runStartedAt = new Date();
      this.dbSnapshotBefore = await takeDbSnapshot();
      await QATestRun.findByIdAndUpdate(this.testRunId, {
        status: 'in-progress',
        startedAt: this.runStartedAt,
        testCases: [],
        activityLog: [],
        dbSnapshotBefore: this.dbSnapshotBefore,
        progress: {
          current: 0,
          currentPage: 'Discovering test cases…',
          totalPages: 0,
          liveActivity: {
            phase: 'discovery',
            action: 'Building 5-layer checklist (L1 infra → L2 UI → L3 permissions → L4 workflows → L5 visual)',
            startedAt: new Date(),
            updatedAt: new Date(),
          },
        },
        pagesTestedCount: 0,
      });

      const allTestCases = await this.getTestCases();
      const testCases = filterTestCasesByCategories(allTestCases, this.config.categories);
      this.totalTestCases = testCases.length;

      if (testCases.length === 0) {
        await QATestRun.findByIdAndUpdate(this.testRunId, {
          status: 'error',
          completedAt: new Date(),
          errorDetails: {
            phase: 'discovery',
            message: 'No tests matched the selected categories.',
          },
        });
        return;
      }

      await QATestRun.findByIdAndUpdate(this.testRunId, {
        progress: {
          current: 0,
          currentPage: 'Starting test execution…',
          totalPages: testCases.length,
          liveActivity: {
            phase: 'ready',
            action: `${testCases.length} tests queued`,
            updatedAt: new Date(),
          },
        },
      });

      for (let i = 0; i < testCases.length; i++) {
        const cancelled = await QATestRun.findById(this.testRunId).select('status').lean();
        if (cancelled?.status === 'cancelled') {
          logger.info('QA', `Test run cancelled — stopping at case ${i + 1}/${testCases.length}`);
          break;
        }

        const testCase = testCases[i];
        
        const progress = Math.round((i / testCases.length) * 100);
        await this.updateProgress(progress, testCase, i, testCases.length);

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

      await this.processResults();

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
    } finally {
      delete process.env.QA_SYNC_GAMIFICATION;
      try {
        await this.cleanupTestData();
        await this.finalizeReporting(this.totalTestCases);
      } catch (cleanupErr) {
        logger.error('QA', 'Cleanup failed in finally block', { error: cleanupErr.message });
      }
    }
  }

  async getTestCases() {
    const reportDiscovery = (message) => this.setLiveActivity({
      phase: 'discovery',
      action: message,
      testName: message,
      updatedAt: new Date(),
    });

    const cats = this.config.categories;
    const testCases = [];

    if (categoriesNeedLayer1(cats)) {
      await reportDiscovery('Layer 1: pre-deployment + security checklist…');
      const preDeployCases = await buildPreDeploymentTestCases(reportDiscovery);
      await reportDiscovery(`Layer 1: ${preDeployCases.length} pre-deploy cases`);
      testCases.push(...preDeployCases);
      const extendedProbes = await buildExtendedProbeTestCases();
      await reportDiscovery(`Layer 1: ${extendedProbes.length} HTTP probes`);
      testCases.push(...extendedProbes);
    }

    const wantsUi = !cats?.length || cats.some((c) => String(c).toLowerCase() === 'ui-discovery');
    if (wantsUi) {
      await reportDiscovery('Layer 2: UI discovery engine…');
      testCases.push(...await buildUiDiscoveryTestCases(reportDiscovery));
    }

    const wantsPerm = !cats?.length || cats.some((c) => String(c).toLowerCase() === 'permission');
    if (wantsPerm) {
      await reportDiscovery('Layer 3: permission matrix…');
      testCases.push(...await buildPermissionMatrixTestCases(reportDiscovery));
    }

    const wantsIntegration = !cats?.length || cats.some((c) => String(c).toLowerCase() === 'integration')
      || cats.some((c) => PREDEPLOY_CATEGORIES.has(String(c).toLowerCase()) && String(c).toLowerCase() === 'business-logic');
    const wantsWorkflow = !cats?.length || cats.some((c) => String(c).toLowerCase() === 'workflow');
    if (wantsIntegration || wantsWorkflow || !cats?.length) {
      await reportDiscovery('Layer 4: integration + workflow tests…');
      if (wantsIntegration || !cats?.length) {
        testCases.push(...await buildIntegrationTestCases());
      }
      if (wantsWorkflow || !cats?.length) {
        testCases.push(...await buildWorkflowTestCases(reportDiscovery));
      }
    }

    const wantsVisual = !cats?.length || cats.some((c) => String(c).toLowerCase() === 'visual-regression');
    if (wantsVisual) {
      await reportDiscovery('Layer 5: visual regression scaffold…');
      testCases.push(...await buildVisualRegressionTestCases(reportDiscovery));
    }

    if (categoriesNeedPageScans(cats)) {
      const targetDir = path.join(__dirname, '../../client/src/pages');
      await reportDiscovery('Layer 1+: scanning client pages for dynamic probes…');
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
          
          const { inferPageScanEndpoint } = require('./qa/qaActivity');
          const pageMeta = {
            kind: 'page-scan',
            action: 'Dynamic pentest from page file heuristics',
            target: routeName,
            ...inferPageScanEndpoint(routeName),
          };

          testCases.push({
            name: `[${routeName}] Dynamic QA Scan`,
            category: 'backend',
            severity: 'high',
            qaMeta: pageMeta,
            test: async () => {
              const errors = [];
              const routeLower = routeName.toLowerCase();
              let payloadMatrix = {};
              let endpoint = '/api/general/ping';
              let httpMethod = 'POST';

              reportQaActivity({
                phase: 'http',
                method: pageMeta.method,
                url: `${QA_API_BASE()}${pageMeta.url}`,
                requestBody: pageMeta.payloadHint,
                message: `Page scan probe for ${routeName}`,
              });

              // 1. True Authentication (JWT Injection)
              const testRole = this.config.testRole || 'user';
              let testUser = await User.findOne({ role: testRole }) || await User.findOne();
              const testToken = jwt.sign({ id: testUser._id }, process.env.JWT_SECRET || 'secret');
              const authHeaders = { Authorization: `Bearer ${testToken}` };

              // Dynamic Business & Transactional Assertions
              let dynamicId = '123';
              
              if (routeLower.includes('forgotpassword') || routeLower.includes('resetpassword')) {
                endpoint = '/api/auth/forgot-password';
                httpMethod = 'POST';
                payloadMatrix = { email: 'qa-probe@example.com' };
                const probeUrl = `${QA_API_BASE()}${endpoint}`;
                reportQaActivity({ method: 'POST', url: probeUrl, requestBody: JSON.stringify(payloadMatrix) });
                try {
                  const res = await axios.post(probeUrl, payloadMatrix, { headers: authHeaders, validateStatus: () => true });
                  reportQaActivity({ httpStatus: res.status, message: `POST ${endpoint} → ${res.status}` });
                  if (res.status === 500) {
                    errors.push({
                      error: `Password reset surface returned 500 on ${endpoint}.`,
                      category: 'data',
                      severity: 'high',
                      endpointValidation: probeUrl,
                    });
                  }
                } catch (err) {}
              }
              else if (routeLower.includes('projectanalytics') || routeLower.includes('adminprojectanalytics')) {
                endpoint = '/api/projects';
                httpMethod = 'GET';
                const probeUrl = `${QA_API_BASE()}${endpoint}`;
                reportQaActivity({ method: 'GET', url: probeUrl });
                try {
                  const res = await axios.get(probeUrl, { headers: authHeaders, validateStatus: () => true });
                  reportQaActivity({ httpStatus: res.status, message: `GET ${endpoint} → ${res.status}` });
                  if (res.status === 500) {
                    errors.push({
                      error: `Project analytics page depends on ${endpoint} but got 500.`,
                      category: 'data',
                      severity: 'medium',
                      endpointValidation: probeUrl,
                    });
                  }
                } catch (err) {}
              }
              else if (routeLower.includes('crm') || routeLower.includes('lead') || routeLower.includes('exly')) {
                const lead = await Lead.findOne();
                if(lead) dynamicId = lead._id;
                endpoint = `/api/crm/leads/${dynamicId}`;
                httpMethod = 'PUT';
                payloadMatrix = { status: 'won' };
                const probeUrl = `${QA_API_BASE()}${endpoint}`;
                reportQaActivity({ method: 'PUT', url: probeUrl, requestBody: JSON.stringify(payloadMatrix) });

                try {
                  const resCRM = await axios.put(probeUrl, payloadMatrix, { headers: authHeaders, validateStatus: () => true });
                  reportQaActivity({ httpStatus: resCRM.status, message: `PUT ${endpoint} → ${resCRM.status}` });
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
                httpMethod = 'PATCH';
                payloadMatrix = { amount: 5000, status: 'approved', tenantId: 'spoofed_tenant_999' };
                const probeUrl = `${QA_API_BASE()}${endpoint}`;
                reportQaActivity({ method: 'PATCH', url: probeUrl, requestBody: JSON.stringify(payloadMatrix) });

                try {
                  const resFin = await axios.patch(probeUrl, payloadMatrix, { headers: authHeaders, validateStatus: () => true });
                  reportQaActivity({ httpStatus: resFin.status, message: `PATCH ${endpoint} → ${resFin.status}` });
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
                httpMethod = 'PUT';
                payloadMatrix = { visibility: 'public', assignedUsers: [testUser._id] };
                const probeUrl = `${QA_API_BASE()}${endpoint}`;
                reportQaActivity({ method: 'PUT', url: probeUrl, requestBody: JSON.stringify(payloadMatrix) });

                try {
                  const [resP1, resP2] = await Promise.all([
                    axios.put(probeUrl, payloadMatrix, { headers: authHeaders, validateStatus: () => true }),
                    axios.put(probeUrl, payloadMatrix, { headers: authHeaders, validateStatus: () => true })
                  ]);
                  
                  reportQaActivity({ httpStatus: resP1.status, message: `PUT ${endpoint} (×2) → ${resP1.status}/${resP2.status}` });
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
                httpMethod = 'POST';
                payloadMatrix = { data: 'test' };
                const probeUrl = `${QA_API_BASE()}${endpoint}`;
                reportQaActivity({ method: 'POST', url: probeUrl, requestBody: JSON.stringify(payloadMatrix) });

                try {
                  const resPing = await axios.post(probeUrl, payloadMatrix, { headers: authHeaders, validateStatus: () => true });
                  reportQaActivity({ httpStatus: resPing.status, message: `POST ${endpoint} → ${resPing.status}` });
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
    }

    if (categoriesNeedLighthouse(cats)) {
      const { buildLighthouseBatchTestCase, getAllLighthouseRoutes } = require('./qa/qaLighthouseRunner');
      const lhPaths = this.config.lighthousePaths?.length
        ? this.config.lighthousePaths
        : null;
      testCases.push(buildLighthouseBatchTestCase(this, lhPaths));
      const total = lhPaths?.length || getAllLighthouseRoutes().length;
      await reportDiscovery(
        lhPaths?.length
          ? `Queued Lighthouse (${lhPaths.length} selected routes)`
          : `Queued Lighthouse category (${total} app routes)`
      );
    }

    return testCases;
  }

  async setLiveActivity(patch) {
    const now = new Date();
    const liveActivity = { ...patch, updatedAt: now };
    if (liveActivity.startedAt && !liveActivity.elapsedMs) {
      liveActivity.elapsedMs = now - new Date(liveActivity.startedAt);
    }
    await QATestRun.findByIdAndUpdate(this.testRunId, {
      $set: { 'progress.liveActivity': liveActivity },
    });
  }

  async appendActivityLog(entry) {
    await QATestRun.findByIdAndUpdate(this.testRunId, {
      $push: {
        activityLog: {
          $each: [entry],
          $slice: -40,
        },
      },
    });
  }

  async runTestCase(testCase, index) {
    const meta = inferQaMeta(testCase);
    const startedAt = new Date();
    await this.setLiveActivity({
      phase: 'running',
      testName: testCase.name,
      checklistId: testCase.checklistId || meta.checklistId,
      category: testCase.category || meta.category,
      kind: meta.kind,
      action: meta.action,
      method: meta.method,
      url: meta.url,
      requestBody: meta.payloadHint || meta.requestBody,
      target: meta.target,
      startedAt,
    });

    setQaActivityHook((patch) => {
      this.setLiveActivity({
        phase: patch.phase || 'running',
        testName: testCase.name,
        checklistId: testCase.checklistId,
        kind: meta.kind,
        ...patch,
        startedAt,
      }).catch(() => {});
    });

    try {
      const startTime = Date.now();
      const result = await testCase.test();
      const duration = Date.now() - startTime;

      if (result.lighthouseReport && result.lighthousePages?.length) {
        const { pageToTestCasePayload } = require('./qa/qaLighthouseRunner');
        await QATestRun.updateOne(
          { _id: this.testRunId },
          { $set: { lighthouseReport: result.lighthouseReport } }
        );
        for (const page of result.lighthousePages) {
          const payload = pageToTestCasePayload(page);
          await QATestRun.updateOne(
            { _id: this.testRunId },
            {
              $push: {
                testCases: {
                  name: payload.name,
                  status: payload.status,
                  duration: Math.round(duration / result.lighthousePages.length),
                  result: payload.result,
                  severity: payload.severity,
                  category: payload.category,
                  error: payload.error,
                  description: payload.description,
                  checklistId: payload.checklistId,
                  checkStatus: payload.checkStatus,
                },
              },
            }
          );
        }
        await QATestRun.updateOne(
          { _id: this.testRunId },
          {
            $push: {
              testCases: {
                name: testCase.name,
                status: 'passed',
                duration,
                result: { summary: result.lighthouseReport.summary },
                severity: testCase.severity || 'medium',
                category: LIGHTHOUSE_CATEGORY,
                description: result.message,
                checkStatus: 'pass',
                checklistId: 'lh-batch-summary',
              },
            },
          }
        );
        await this.appendActivityLog({
          at: new Date(),
          phase: 'done',
          testName: testCase.name,
          kind: 'lighthouse',
          outcome: 'passed',
          durationMs: duration,
          message: result.message,
        });
        logger.info('QA', `Lighthouse batch: ${result.lighthousePages.length} pages`, { duration });
        setQaActivityHook(null);
        return;
      }

      const checkStatus = result.checkStatus || (result.passed ? 'pass' : 'fail');
      const status =
        checkStatus === 'fail'
          ? 'failed'
          : checkStatus === 'warn'
            ? 'warn'
            : checkStatus === 'skip'
              ? 'skip'
              : 'passed';

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
              description: result.description || null,
              evidence: result.evidence || null,
              checklistId: result.checklistId || testCase.checklistId || null,
              checkStatus: checkStatus,
            }
          }
        }
      );

      if (result.artifacts?.length) {
        await QATestRun.updateOne(
          { _id: this.testRunId },
          { $push: { createdArtifacts: { $each: result.artifacts } } }
        );
        for (const a of result.artifacts) {
          if (a.type && this.createdDuringRun[a.type] !== undefined) {
            this.createdDuringRun[a.type] += 1;
          }
        }
      }

      if (result.pageManifests?.length) {
        await QATestRun.updateOne(
          { _id: this.testRunId },
          { $set: { pageManifests: result.pageManifests } }
        );
      }

      // Log failed tests (not warn/skip)
      if (checkStatus === 'fail') {
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

      const logEntry = {
        at: new Date(),
        phase: 'done',
        testName: testCase.name,
        checklistId: testCase.checklistId || result.checklistId,
        kind: meta.kind,
        summary: formatActivitySummary({ ...meta, method: meta.method, url: meta.url, requestBody: meta.payloadHint }),
        method: meta.method,
        url: meta.url,
        httpStatus: result.httpStatus,
        outcome: status,
        durationMs: duration,
        message: result.description || result.message || result.error || status,
      };
      await this.appendActivityLog(logEntry);
      await this.setLiveActivity({
        phase: 'done',
        testName: testCase.name,
        outcome: status,
        message: logEntry.message,
        httpStatus: result.httpStatus,
        startedAt,
        elapsedMs: duration,
      });

      logger.info('QA', `Test case executed: ${testCase.name} - ${status}`, { duration });

      await new Promise((resolve) => setTimeout(resolve, 80));
    } catch (error) {
      logger.error('QA', `Error running test case: ${testCase.name}`, { error: error.message });
      await this.appendActivityLog({
        at: new Date(),
        phase: 'error',
        testName: testCase.name,
        kind: meta.kind,
        outcome: 'failed',
        message: error.message,
      });
      await this.setLiveActivity({
        phase: 'error',
        testName: testCase.name,
        outcome: 'failed',
        message: error.message,
        startedAt,
      });
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
      await new Promise((resolve) => setTimeout(resolve, 80));
    } finally {
      setQaActivityHook(null);
    }
  }

  async processResults() {
    try {
      const testRun = await QATestRun.findById(this.testRunId);
      const failedTests = testRun.testCases.filter(t => t.status === 'failed');

      // Count bugs
      const bugsFound = failedTests.length;
      
      // Create tasks for dynamic-scan bugs only (checklist shown in UI, no task spam)
      for (const failedTest of failedTests) {
        if (PREDEPLOY_CATEGORIES.has(failedTest.category)) continue;
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
      const cleanupResults = {
        deleted: {
          tasks: 0, projects: 0, logs: 0, dailyLogs: 0, finance: 0, leads: 0, contacts: 0, audits: 0,
          users: 0, notifications: 0, xpAudits: 0, tracked: 0,
        },
        created: { ...this.createdDuringRun },
        errors: [],
      };

      const tracked = await purgeQaRunArtifacts(testRun);
      cleanupResults.deleted.tracked = tracked.deleted;
      cleanupResults.errors.push(...tracked.errors);

      const { repairCorruptLeadPhones } = require('./leadPhoneRepair');
      const [swept, phoneRepair] = await Promise.all([
        purgeQaTestData(),
        repairCorruptLeadPhones(),
      ]);
      DataHubService.clearFolderCache();
      cleanupResults.deleted.leads += swept.deleted.leads;
      cleanupResults.deleted.contacts += swept.deleted.contacts;
      cleanupResults.deleted.audits = swept.deleted.audits;
      cleanupResults.deleted.logs += swept.deleted.logs;
      cleanupResults.deleted.dailyLogs = swept.deleted.dailyLogs || 0;
      cleanupResults.deleted.users = swept.deleted.users;
      cleanupResults.deleted.tasks += swept.deleted.tasks;
      cleanupResults.deleted.finance = swept.deleted.finance;
      cleanupResults.deleted.projects = swept.deleted.projects;
      cleanupResults.deleted.notifications = swept.deleted.notifications;
      cleanupResults.deleted.xpAudits = swept.deleted.xpAudits;
      cleanupResults.phoneRepair = phoneRepair;

      const GamificationService = require('./gamificationService');
      const xpRecalc = await GamificationService.recalculateUsersFromAudit(
        swept.affectedUserIds || []
      );
      cleanupResults.xpRecalc = xpRecalc;

      const sideEffectScan = await scanQaSideEffects({
        since: this.runStartedAt || testRun?.startedAt,
        testRunId: this.testRunId,
      });

      const cleanupVerification = await compareSnapshotAfterCleanup(
        this.dbSnapshotBefore || testRun?.dbSnapshotBefore,
        cleanupResults
      );

      if (this.testRunId) {
        await QATestRun.findByIdAndUpdate(this.testRunId, {
          cleanupResults,
          cleanupVerification,
          sideEffectScan,
        });

        if (!cleanupVerification.passed) {
          await QATestRun.updateOne(
            { _id: this.testRunId },
            {
              $push: {
                testCases: {
                  name: '[Cleanup] Residual QA artifacts',
                  status: 'failed',
                  category: 'rollback',
                  severity: 'high',
                  checklistId: 'cleanup-residual-fail',
                  error: cleanupVerification.failReason,
                  description: `Residual counts: ${JSON.stringify(cleanupVerification.after)}`,
                  checkStatus: 'fail',
                },
              },
            }
          );
        }
      }
      logger.info('QA', 'Cleanup completed', { cleanupResults, cleanupVerification });
      return { ...cleanupResults, cleanupVerification, sideEffectScan };
    } catch (error) {
      logger.error('QA', 'Error during cleanup', { error: error.message });
      throw error;
    }
  }

  async finalizeReporting(totalQueued) {
    try {
      const testRun = await QATestRun.findById(this.testRunId);
      if (!testRun) return;

      const report = buildFullReport(testRun);
      const status = report.executiveSummary.status === 'fail' ? 'completed' : 'completed';

      await QATestRun.findByIdAndUpdate(this.testRunId, {
        status,
        completedAt: new Date(),
        progress: { current: 100, currentPage: 'Complete', totalPages: totalQueued },
        executiveSummary: report.executiveSummary,
        riskReport: report.riskReport,
        performanceReport: report.performance,
      });
    } catch (error) {
      logger.error('QA', 'Error finalizing report', { error: error.message });
      await QATestRun.findByIdAndUpdate(this.testRunId, {
        status: 'completed',
        completedAt: new Date(),
      });
    }
  }

  async updateProgress(current, testCase, completed, total) {
    try {
      const name = typeof testCase === 'string' ? testCase : testCase?.name;
      const meta = typeof testCase === 'object' ? inferQaMeta(testCase) : {};
      await QATestRun.findByIdAndUpdate(this.testRunId, {
        $set: {
          'progress.current': current,
          'progress.currentPage': name,
          'progress.totalPages': total,
          'progress.liveActivity.testName': name,
          'progress.liveActivity.checklistId': testCase?.checklistId,
          'progress.liveActivity.kind': meta.kind,
          'progress.liveActivity.action': meta.action || 'Queued — starting next test',
          'progress.liveActivity.target': meta.target,
          'progress.liveActivity.method': meta.method,
          'progress.liveActivity.url': meta.url,
          'progress.liveActivity.phase': 'queued',
          'progress.liveActivity.updatedAt': new Date(),
        },
        pagesTestedCount: completed,
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
