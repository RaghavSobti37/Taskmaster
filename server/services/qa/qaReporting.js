/**
 * Enhanced QA reporting: executive summary, risk report, permission violations, performance, cleanup.
 */
const { getAllActions } = require('./qaActionRegistry');

function buildExecutiveSummary(testRun) {
  const cases = testRun.testCases || [];
  const passed = cases.filter((t) => t.status === 'passed').length;
  const failed = cases.filter((t) => t.status === 'failed').length;
  const warned = cases.filter((t) => t.status === 'warn').length;
  const skipped = cases.filter((t) => t.status === 'skip').length;
  const total = cases.length;

  const layers = {
    layer1: cases.filter((t) =>
      String(t.name || '').startsWith('[Pre-Deploy]')
      || String(t.name || '').startsWith('[Lighthouse]')
      || ['authorization', 'security-hardening', 'lighthouse', 'cors', 'rate-limiting'].includes(t.category)
    ),
    layer2: cases.filter((t) =>
      String(t.name || '').startsWith('[UI Discovery]')
      || String(t.checklistId || '').startsWith('ui-disc')
      || t.category === 'ui-discovery'
    ),
    layer3: cases.filter((t) =>
      String(t.name || '').startsWith('[Permission]')
      || String(t.checklistId || '').startsWith('perm-')
    ),
    layer4: cases.filter((t) =>
      String(t.name || '').startsWith('[Workflow]')
      || String(t.name || '').startsWith('[Integration]')
      || String(t.checklistId || '').startsWith('wf-')
      || t.category === 'workflow'
    ),
    layer5: cases.filter((t) =>
      String(t.name || '').startsWith('[Visual Regression]')
      || t.checklistId === 'visual-regression-scaffold'
      || t.category === 'visual-regression'
    ),
  };

  const layerSummary = {};
  for (const [key, arr] of Object.entries(layers)) {
    layerSummary[key] = {
      total: arr.length,
      passed: arr.filter((t) => t.status === 'passed').length,
      failed: arr.filter((t) => t.status === 'failed').length,
      skipped: arr.filter((t) => t.status === 'skip').length,
    };
  }

  const durationMs = testRun.completedAt && testRun.startedAt
    ? new Date(testRun.completedAt) - new Date(testRun.startedAt)
    : null;

  const cleanupOk = testRun.cleanupVerification?.passed !== false;
  const overallStatus = failed > 0 ? 'fail' : !cleanupOk ? 'fail' : warned > 0 ? 'warn' : 'pass';

  return {
    status: overallStatus,
    totalTests: total,
    passed,
    failed,
    warned,
    skipped,
    passRate: total > 0 ? Number(((passed / total) * 100).toFixed(1)) : 0,
    durationMs,
    bugsIdentified: testRun.bugsIdentified || failed,
    pagesTested: testRun.pagesTestedCount || 0,
    layerSummary,
    cleanupVerified: cleanupOk,
    generatedAt: new Date(),
  };
}

function buildRiskReport(testRun) {
  const cases = testRun.testCases || [];
  const critical = cases.filter((t) => t.status === 'failed' && (t.severity === 'high' || t.category === 'permission'));
  const permissionViolations = cases.filter(
    (t) => t.status === 'failed' && (t.category === 'permission' || String(t.checklistId || '').startsWith('perm-'))
  );

  const risks = [];
  for (const tc of critical) {
    risks.push({
      level: tc.severity === 'high' || tc.category === 'permission' ? 'critical' : 'high',
      test: tc.name,
      category: tc.category,
      error: tc.error || tc.description,
      checklistId: tc.checklistId,
    });
  }

  if (testRun.cleanupVerification && !testRun.cleanupVerification.passed) {
    risks.push({
      level: 'high',
      test: 'Cleanup verification',
      category: 'rollback',
      error: testRun.cleanupVerification.failReason,
    });
  }

  return {
    totalRisks: risks.length,
    criticalCount: risks.filter((r) => r.level === 'critical').length,
    permissionViolations: permissionViolations.map((t) => ({
      test: t.name,
      error: t.error || t.description,
      checklistId: t.checklistId,
    })),
    risks: risks.slice(0, 50),
    actionRegistrySize: getAllActions().length,
  };
}

function buildPerformanceReport(testRun) {
  const cases = testRun.testCases || [];
  const withDuration = cases.filter((t) => typeof t.duration === 'number' && t.duration > 0);
  const sorted = [...withDuration].sort((a, b) => (b.duration || 0) - (a.duration || 0));
  const totalDuration = withDuration.reduce((s, t) => s + (t.duration || 0), 0);
  const avgDuration = withDuration.length ? Math.round(totalDuration / withDuration.length) : 0;

  return {
    totalDurationMs: totalDuration,
    avgDurationMs: avgDuration,
    slowest: sorted.slice(0, 10).map((t) => ({
      name: t.name,
      durationMs: t.duration,
      category: t.category,
    })),
    lighthouse: testRun.lighthouseReport?.summary || null,
  };
}

function buildCleanupReport(testRun) {
  const cv = testRun.cleanupVerification || {};
  const cr = testRun.cleanupResults || {};
  return {
    verified: cv.passed !== false,
    before: cv.before || testRun.dbSnapshotBefore?.counts,
    after: cv.after,
    delta: cv.delta,
    deleted: cr.deleted,
    created: cv.created || testRun.createdArtifacts?.length || 0,
    errors: cr.errors || [],
    failReason: cv.failReason,
    sideEffects: testRun.sideEffectScan || null,
  };
}

function buildFullReport(testRun) {
  return {
    executiveSummary: buildExecutiveSummary(testRun),
    riskReport: buildRiskReport(testRun),
    performance: buildPerformanceReport(testRun),
    cleanup: buildCleanupReport(testRun),
    pageManifests: testRun.pageManifests || null,
    dbSnapshotBefore: testRun.dbSnapshotBefore || null,
  };
}

module.exports = {
  buildExecutiveSummary,
  buildRiskReport,
  buildPerformanceReport,
  buildCleanupReport,
  buildFullReport,
};
