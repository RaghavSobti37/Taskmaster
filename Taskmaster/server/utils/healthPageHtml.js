const os = require('os');
const path = require('path');
const { config } = require('../config');
const { getSnapshot: getRequestMetrics } = require('./healthRequestMetrics');
const { getRecent, syncProbeEvents } = require('./healthEventLog');
const { getRuntimeSnapshot } = require('./healthRuntimeMetrics');
const { formatDisplayDateTime } = require('../../shared/dateDisplay');

const PKG_VERSION = (() => {
  try {
    return require(path.join(__dirname, '..', 'package.json')).version || '0.0.0';
  } catch {
    return '0.0.0';
  }
})();

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function jsonForTextarea(obj) {
  return JSON.stringify(obj, null, 2).replace(/<\/textarea/gi, '<\\/textarea');
}

function wantsHealthHtml(req) {
  if (req.query.format === 'json' || req.query.raw === '1') return false;
  if (req.query.format === 'html' || req.query.view === 'dashboard') return true;
  const accept = String(req.headers.accept || '');
  if (!accept || accept === '*/*') return false;
  return accept.includes('text/html') && !accept.includes('application/json');
}

function wantsDashboardJson(req) {
  return req.query.dashboard === '1' || req.query.format === 'dashboard';
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatStartedAt(uptimeSeconds) {
  const started = new Date(Date.now() - uptimeSeconds * 1000);
  return formatDisplayDateTime(started);
}

function depStatus(ok, state) {
  const s = String(state || '').toLowerCase();
  if (s === 'not_configured' || s === 'skipped_local') {
    return { dot: 'ok', label: s === 'skipped_local' ? 'Skipped (dev)' : 'Not configured' };
  }
  if (ok) return { dot: 'ok', label: 'Connected' };
  if (s.includes('connect') || s.includes('retry') || s === 'unavailable' || s === 'error') {
    return { dot: 'warn', label: 'Reconnecting' };
  }
  return { dot: 'bad', label: 'Unavailable' };
}

function computeHealthScore(detail, probe) {
  const scores = [];
  for (const svc of probe?.services || []) {
    if (svc.id === 'mongodb') scores.push(svc.status === 'ok' ? 100 : 0);
    else if (svc.id === 'redis') {
      if (svc.state === 'not_configured') scores.push(100);
      else scores.push(svc.status === 'ok' ? 100 : svc.status === 'degraded' ? 65 : 20);
    } else if (svc.status === 'ok') scores.push(100);
    else if (svc.status === 'degraded') scores.push(70);
    else scores.push(25);
  }
  if (scores.length) {
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }
  const deps = detail.dependencies || {};
  const flags = [deps.mongodb?.ok, deps.uploadthing?.ok, deps.supabase?.ok !== false];
  const hit = flags.filter(Boolean).length;
  return Math.round((hit / flags.length) * 100);
}

function overallHero(detail, probe, score) {
  const probeStatus = probe?.status;
  const apiStatus = detail.status;

  if (apiStatus === 'FAIL' || probeStatus === 'down') {
    return { dot: 'bad', title: 'OUTAGE', subtitle: detail.reason || 'Critical systems are unavailable.' };
  }
  if (probeStatus === 'degraded' || score < 85) {
    return { dot: 'warn', title: 'DEGRADED', subtitle: 'Some dependencies need attention.' };
  }
  if (apiStatus === 'STARTING') {
    return { dot: 'warn', title: 'STARTING', subtitle: 'API is booting — dependencies are being checked.' };
  }
  return { dot: 'ok', title: 'OPERATIONAL', subtitle: 'All critical systems are functioning normally.' };
}

function buildDependencyRows(detail, probe) {
  const probeById = Object.fromEntries((probe?.services || []).map((s) => [s.id, s]));
  const deps = detail.dependencies || {};
  const rows = [];

  const mongoProbe = probeById.mongodb;
  const mongo = deps.mongodb || {};
  rows.push({
    name: 'MongoDB',
    status: depStatus(mongo.ok, mongo.state),
    detail: mongoProbe?.latencyMs != null
      ? `Replica Healthy · ${mongoProbe.latencyMs} ms`
      : (mongo.state || '—'),
  });

  const sbProbe = probeById.supabase;
  const sb = deps.supabase || {};
  const sbState = sbProbe?.state || sb.state;
  rows.push({
    name: 'Supabase',
    status: depStatus(sbProbe?.status === 'ok' || sb.ok, sbState),
    detail: sbProbe?.detail || sbProbe?.error || (sbProbe?.latencyMs != null ? `${sbProbe.latencyMs} ms` : sb.state),
  });

  const redisProbe = probeById.redis;
  const redis = deps.redis || {};
  const redisState = redisProbe?.state || redis.state;
  let redisDetail = redisProbe?.detail || redisProbe?.error;
  if (!redisDetail) {
    if (redisState === 'not_configured') redisDetail = 'In-memory queue fallback';
    else if (redis.ok || redisProbe?.status === 'ok') {
      redisDetail = redisProbe?.latencyMs != null ? `${redisProbe.latencyMs} ms` : 'Connected';
    } else {
      redisDetail = 'Retry in progress';
    }
  }
  rows.push({
    name: 'Redis',
    status: depStatus(redis.ok || redisState === 'not_configured', redisState),
    detail: redisDetail,
  });

  const ut = deps.uploadthing || {};
  rows.push({
    name: 'UploadThing',
    status: depStatus(ut.ok, ut.state),
    detail: ut.ok
      ? `Ready · ${process.env.UPLOADTHING_REGION || process.env.RENDER_REGION || 'auto'}`
      : (ut.reason || ut.state),
  });

  const resendProbe = probeById.resend;
  rows.push({
    name: 'Email (Resend)',
    status: depStatus(resendProbe?.status === 'ok', resendProbe?.state),
    detail: resendProbe?.detail || resendProbe?.error
      || (resendProbe?.latencyMs != null ? `${resendProbe.latencyMs} ms` : (resendProbe?.status === 'ok' ? 'Operational' : 'Not configured')),
  });

  const bullProbe = probeById.bullmq;
  if (bullProbe) {
    rows.push({
      name: 'Job Queues',
      status: depStatus(bullProbe.status === 'ok', bullProbe.state),
      detail: bullProbe.detail || bullProbe.error || bullProbe.state,
    });
  }

  return rows;
}

function collectWarnings(detail, probe) {
  const warnings = [];
  const redisProbe = probe?.services?.find((s) => s.id === 'redis');
  const redis = detail.dependencies?.redis;
  if (redisProbe?.status === 'down' || (redis && !redis.ok && redis.state !== 'not_configured')) {
    warnings.push('Redis is currently unavailable. Queue processing may be delayed.');
  }
  for (const svc of probe?.services || []) {
    if (svc.status === 'down') {
      warnings.push(`${svc.label} is down: ${svc.error || svc.state}`);
    } else if (svc.status === 'degraded' && svc.error) {
      warnings.push(`${svc.label}: ${svc.error}`);
    }
  }
  if (detail.status === 'FAIL' && detail.reason) warnings.push(detail.reason);
  return warnings;
}

function buildSparklinePath(values, width, height) {
  if (!values.length) return `M0,${height / 2} L${width},${height / 2}`;
  const max = Math.max(...values, 1);
  const step = width / Math.max(values.length - 1, 1);
  return values
    .map((v, i) => {
      const x = i * step;
      const y = height - (v / max) * (height - 8) - 4;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function buildDashboardData(detail, probe) {
  if (probe) syncProbeEvents(probe);

  const metrics = getRequestMetrics();
  const runtime = getRuntimeSnapshot();
  const build = detail.build || {};
  const branch = (process.env.RENDER_GIT_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || 'local').trim();
  const region = (process.env.RENDER_REGION || process.env.AWS_REGION || process.env.VERCEL_REGION || 'local').trim();
  const envLabel = build.deployTier || config.COREKNOT_DEPLOY_TIER || config.NODE_ENV || 'development';
  const score = computeHealthScore(detail, probe);
  const hero = overallHero(detail, probe, score);

  const avgLatency = metrics.avgLatencyMs;
  const p95Latency = metrics.p95LatencyMs;

  return {
    checkedAt: new Date().toISOString(),
    detail,
    probe,
    hero,
    score,
    metrics: {
      requestsPerMin: metrics.requestsPerMin,
      errorRatePct: metrics.errorRatePct,
      avgLatencyMs: avgLatency,
      p95LatencyMs: p95Latency,
      sampleCount: metrics.requestsPerMin,
      latencySeries: metrics.latencySeries,
    },
    uptime: formatUptime(detail.uptimeSeconds || 0),
    uptimeSeconds: detail.uptimeSeconds || 0,
    dependencies: buildDependencyRows(detail, probe),
    warnings: collectWarnings(detail, probe),
    runtime,
    deployment: {
      environment: envLabel,
      branch,
      commit: (build.commitSha || 'local').slice(0, 7),
      version: `v${PKG_VERSION}`,
      node: process.version.replace('v', ''),
      region,
      started: formatStartedAt(detail.uptimeSeconds || 0),
      service: build.service || null,
    },
    events: getRecent(12),
    sparkPath: buildSparklinePath(metrics.latencySeries, 320, 72),
    hasLatencyData: metrics.latencySeries.length > 0,
  };
}

function buildSnapshot(detail, probe, basePayload) {
  const dashboard = buildDashboardData(detail, probe);
  return { ...dashboard, jsonPayload: { ...basePayload, dashboard } };
}

function renderHeapBreakdown(heap) {
  const totalRss = heap.rss || 1;
  const stackBar = heap.segments.map((s) => {
    const w = Math.max(2, Math.round((s.bytes / totalRss) * 100));
    return `<div class="heap-seg" style="width:${w}%;background:${s.color}" title="${escapeHtml(s.label)}: ${s.mb} MB"></div>`;
  }).join('');

  const rows = heap.segments.map((s) => `
    <div class="heap-row">
      <span class="heap-swatch" style="background:${s.color}"></span>
      <span class="heap-name">${escapeHtml(s.label)}</span>
      <span class="heap-mb">${s.mb} MB</span>
      <span class="heap-pct">${s.pctOfRss}% RSS</span>
    </div>`).join('');

  const heapBarUsed = heap.heapUsedPct;

  return `
    <div class="heap-panel">
      <div class="section-title">Heap Memory Breakdown</div>
      <p class="heap-summary">${heap.heapUsedMb} MB used of ${heap.heapTotalMb} MB V8 heap (${heap.heapUsedPct}%) · RSS ${heap.rssMb} MB / ${heap.systemTotalMb} MB system</p>
      <div class="heap-stack" aria-label="RSS memory composition">${stackBar}</div>
      <div class="heap-legend">${rows}</div>
      <div class="section-title" style="margin-top:16px">V8 Heap Allocation</div>
      <div class="bar-row">
        <span class="bar-label">Heap</span>
        <div class="bar-track"><div class="bar-fill" style="width:${heapBarUsed}%"></div></div>
        <span class="bar-val">${heapBarUsed}%</span>
      </div>
      <div class="heap-alloc-grid">
        <div><span class="deploy-key">heapUsed</span><span class="deploy-val">${heap.heapUsedMb} MB</span></div>
        <div><span class="deploy-key">heapFree</span><span class="deploy-val">${heap.heapFreeMb} MB</span></div>
        <div><span class="deploy-key">external</span><span class="deploy-val">${heap.externalMb} MB</span></div>
        <div><span class="deploy-key">arrayBuffers</span><span class="deploy-val">${heap.arrayBuffersMb} MB</span></div>
      </div>
    </div>`;
}

function renderHealthPage(snapshot) {
  const s = snapshot;
  const jsonSafe = escapeHtml(JSON.stringify(s.jsonPayload, null, 2));
  const envBadge = escapeHtml(String(s.deployment.environment).toUpperCase());
  const heapHtml = renderHeapBreakdown(s.runtime.heap);

  const depHtml = s.dependencies.map((d) => `
    <div class="dep-row">
      <div class="dep-main">
        <span class="pulse pulse-${d.status.dot}"></span>
        <span class="dep-name">${escapeHtml(d.name)}</span>
        <span class="dep-state">${escapeHtml(d.status.label)}</span>
      </div>
      <div class="dep-detail">${escapeHtml(d.detail)}</div>
    </div>`).join('');

  const renderEvents = (events) => (events.length ? events : [{ at: new Date().toISOString(), level: 'ok', message: 'Awaiting events' }])
    .map((ev) => {
      const t = new Date(ev.at).toLocaleTimeString('en-GB', { hour12: false });
      const lvl = ev.level === 'warn' ? 'warn' : ev.level === 'bad' ? 'bad' : 'ok';
      return `<div class="event-row"><span class="event-time">${escapeHtml(t)}</span><span class="pulse pulse-${lvl}"></span><span>${escapeHtml(ev.message)}</span></div>`;
    }).join('');

  const eventsHtml = renderEvents(s.events);

  const warningsHtml = s.warnings.length
    ? s.warnings.map((w) => `<div class="warning-item">⚠ ${escapeHtml(w)}</div>`).join('')
    : '<div class="warning-ok">No active warnings.</div>';

  const bar = (label, pct, suffix = '%') => {
    const display = pct == null ? '—' : `${pct}${suffix}`;
    const width = pct == null ? 0 : Math.min(100, pct);
    return `
    <div class="bar-row">
      <span class="bar-label">${label}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
      <span class="bar-val">${display}</span>
    </div>`;
  };

  const latencyDisplay = typeof s.metrics.avgLatencyMs === 'number' ? `${s.metrics.avgLatencyMs} ms` : '—';
  const p95Display = s.metrics.p95LatencyMs != null ? `${s.metrics.p95LatencyMs} ms` : '—';
  const chartNote = s.hasLatencyData ? '' : '<p class="chart-empty">No API traffic in the last 60s — chart updates as requests arrive.</p>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CoreKnot · System Health</title>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0B0F13;color:#eef0f3;min-height:100vh;line-height:1.45}
    .page{max-width:1200px;margin:0 auto;padding:20px 16px 40px}
    .header{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding-bottom:16px;border-bottom:1px solid #252830}
    .brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:15px;letter-spacing:-0.02em}
    .brand-logo{width:32px;height:32px;border-radius:22%;overflow:hidden;flex-shrink:0;display:inline-flex;box-shadow:inset 0 1px 0 rgb(255 255 255 / 0.12),0 2px 8px rgb(0 0 0 / 0.12)}
    .brand-logo img{width:100%;height:100%;display:block}
    .header-actions{display:flex;align-items:center;gap:16px;font-size:11px;color:#7a808a}
    .header-actions button{background:transparent;border:1px solid #252830;color:#eef0f3;border-radius:8px;padding:6px 12px;font-size:11px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
    .header-actions button:hover:not(:disabled){border-color:#126d5e;color:#126d5e}
    .header-actions button:disabled{cursor:wait;opacity:.7}
    .header-actions button.is-loading .refresh-icon{display:inline-block;animation:refresh-spin .7s linear infinite}
    @keyframes refresh-spin{to{transform:rotate(360deg)}}
    .auto-toggle{display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none}
    .auto-dot{width:8px;height:8px;border-radius:50%;background:#126d5e;box-shadow:0 0 0 3px rgba(18,109,94,.25)}
    .auto-dot.off{background:#7a808a;box-shadow:none}
    .section-title{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#7a808a;margin-bottom:12px}
    .hero{margin:20px 0;padding:20px;border:1px solid #252830;border-radius:14px;background:#0f1012;position:relative}
    .env-pill{position:absolute;top:16px;right:16px;font-size:9px;font-weight:700;letter-spacing:.1em;padding:4px 8px;border-radius:6px;background:#141519;border:1px solid #252830;color:#7ab8aa}
    .hero-status{display:flex;align-items:center;gap:10px;font-size:13px;font-weight:700;letter-spacing:.08em;margin-bottom:6px}
    .hero-sub{font-size:13px;color:#7a808a}
    .metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin:16px 0 20px}
    .metric-card{background:#0f1012;border:1px solid #252830;border-radius:12px;padding:14px 16px}
    .metric-label{font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#7a808a;margin-bottom:8px}
    .metric-value{font-size:22px;font-weight:700;font-variant-numeric:tabular-nums;color:#eef0f3}
    .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
    @media(max-width:800px){.grid-2{grid-template-columns:1fr}}
    .panel{background:#0f1012;border:1px solid #252830;border-radius:14px;padding:16px;min-height:180px}
    .dep-row{padding:12px 0;border-bottom:1px solid #1a1c22}
    .dep-row:last-child{border-bottom:none}
    .dep-main{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .dep-name{font-weight:600;font-size:13px;flex:1}
    .dep-state{font-size:11px;color:#7ab8aa;font-weight:600}
    .dep-detail{font-size:11px;color:#7a808a;margin-top:4px;padding-left:20px}
    .chart-wrap{background:#141519;border-radius:10px;padding:12px;margin-bottom:14px;border:1px solid #1a1c22}
    .chart-label{font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#7a808a;text-align:center;margin-bottom:8px}
    .chart-empty{font-size:10px;color:#7a808a;text-align:center;margin-top:6px}
    .chart-svg{width:100%;height:72px;display:block}
    .chart-line{fill:none;stroke:#126d5e;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
    .bar-row{display:grid;grid-template-columns:72px 1fr 40px;align-items:center;gap:10px;margin-bottom:10px;font-size:11px}
    .bar-label{color:#7a808a;font-weight:600}
    .bar-track{height:8px;background:#141519;border-radius:4px;overflow:hidden;border:1px solid #1a1c22}
    .bar-fill{height:100%;background:linear-gradient(90deg,#083d3a,#126d5e);border-radius:4px;transition:width .4s ease}
    .bar-val{text-align:right;font-variant-numeric:tabular-nums;color:#eef0f3;font-weight:600}
    .perf-stats{font-size:11px;color:#7a808a;margin-top:8px;display:flex;gap:16px;flex-wrap:wrap}
    .deploy-grid{display:grid;grid-template-columns:auto 1fr;gap:8px 16px;font-size:12px}
    .deploy-key{color:#7a808a;font-weight:600}
    .deploy-val{color:#eef0f3;font-variant-numeric:tabular-nums}
    .event-row{display:flex;align-items:center;gap:8px;font-size:11px;padding:6px 0;border-bottom:1px solid #1a1c22}
    .event-row:last-child{border-bottom:none}
    .event-time{color:#7a808a;font-variant-numeric:tabular-nums;min-width:64px}
    .tabs{display:flex;flex-wrap:wrap;gap:8px;margin:20px 0 16px;padding:12px 0;border-top:1px solid #252830}
    .tab{background:transparent;border:none;color:#7a808a;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:8px 14px;border-radius:8px;cursor:pointer}
    .tab.active{color:#126d5e;background:rgba(18,109,94,.12)}
    .tab-panel{display:none}
    .tab-panel.active{display:block}
    .warnings{margin-top:16px;padding:16px;border:1px solid #252830;border-radius:14px;background:#0f1012}
    .warning-item{font-size:12px;color:#b56f1c;margin-bottom:8px}
    .warning-ok{font-size:12px;color:#7ab8aa}
    .actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}
    .actions button{background:#141519;border:1px solid #252830;color:#eef0f3;border-radius:8px;padding:8px 14px;font-size:11px;font-weight:600;cursor:pointer}
    .actions button:hover{border-color:#126d5e;color:#126d5e}
    .toast{position:fixed;bottom:20px;right:20px;background:#126d5e;color:#fff;padding:10px 14px;border-radius:8px;font-size:12px;opacity:0;transition:opacity .2s;pointer-events:none}
    .toast.show{opacity:1}
    pre.json{background:#070809;border:1px solid #252830;border-radius:12px;padding:16px;font-size:11px;line-height:1.5;overflow:auto;max-height:480px;color:#7ab8aa}
    .pulse{width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0}
    .pulse-ok{background:#126d5e;box-shadow:0 0 0 0 rgba(18,109,94,.5);animation:pulse-ok 2s infinite}
    .pulse-warn{background:#b56f1c;animation:pulse-warn 1.5s infinite}
    .pulse-bad{background:#88281c;animation:pulse-bad 1.2s infinite}
    @keyframes pulse-ok{0%,100%{box-shadow:0 0 0 0 rgba(18,109,94,.45)}50%{box-shadow:0 0 0 6px rgba(18,109,94,0)}}
    @keyframes pulse-warn{0%,100%{opacity:1}50%{opacity:.55}}
    @keyframes pulse-bad{0%,100%{opacity:1}50%{opacity:.4}}
    .metrics-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}
    .diag-row{font-size:12px;padding:8px 0;border-bottom:1px solid #1a1c22;display:flex;justify-content:space-between;gap:12px}
    .heap-panel{margin-top:0}
    .heap-summary{font-size:11px;color:#7a808a;margin-bottom:12px}
    .heap-stack{display:flex;height:14px;border-radius:7px;overflow:hidden;border:1px solid #252830;margin-bottom:14px}
    .heap-seg{min-width:2px}
    .heap-row{display:grid;grid-template-columns:12px 1fr auto auto;gap:10px;align-items:center;font-size:11px;padding:5px 0;border-bottom:1px solid #1a1c22}
    .heap-row:last-child{border-bottom:none}
    .heap-swatch{width:12px;height:12px;border-radius:3px}
    .heap-name{color:#eef0f3}
    .heap-mb{color:#7ab8aa;font-variant-numeric:tabular-nums}
    .heap-pct{color:#7a808a;font-variant-numeric:tabular-nums;text-align:right}
    .heap-alloc-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;margin-top:10px;font-size:12px}
  </style>
</head>
<body>
  <div class="page">
    <header class="header">
      <div class="brand">
        <span class="brand-logo" role="img" aria-label="CoreKnot">
          <img src="/api/health/brand-mark.svg" alt="" width="32" height="32" />
        </span>
        <span>CoreKnot</span>
      </div>
      <div class="header-actions">
        <span>SYSTEM HEALTH</span>
        <button type="button" id="btn-refresh"><span class="refresh-icon" aria-hidden="true">⟳</span><span class="refresh-label">Refresh</span></button>
        <label class="auto-toggle" id="auto-toggle">
          <span class="auto-dot" id="auto-dot"></span>
          <span>Auto</span>
        </label>
        <span id="last-updated">Last Updated: —</span>
      </div>
    </header>

    <nav class="tabs" aria-label="Health views">
      <button class="tab active" data-tab="overview">Overview</button>
      <button class="tab" data-tab="metrics">Metrics</button>
      <button class="tab" data-tab="logs">Logs</button>
      <button class="tab" data-tab="json">Raw JSON</button>
      <button class="tab" data-tab="diagnostics">Diagnostics</button>
    </nav>

    <div id="panel-overview" class="tab-panel active">
      <section class="hero">
        <span class="env-pill" id="env-pill">${envBadge}</span>
        <div class="hero-status" id="hero-status"><span class="pulse pulse-${s.hero.dot}" id="hero-dot"></span> <span id="hero-title">${escapeHtml(s.hero.title)}</span></div>
        <p class="hero-sub" id="hero-sub">${escapeHtml(s.hero.subtitle)}</p>
      </section>

      <div class="metrics">
        <div class="metric-card"><div class="metric-label">Health Score</div><div class="metric-value" id="m-score">${s.score}%</div></div>
        <div class="metric-card"><div class="metric-label">API Latency</div><div class="metric-value" id="m-latency">${latencyDisplay}</div></div>
        <div class="metric-card"><div class="metric-label">Uptime</div><div class="metric-value" id="m-uptime">${escapeHtml(s.uptime)}</div></div>
        <div class="metric-card"><div class="metric-label">Requests/min</div><div class="metric-value" id="m-rpm">${s.metrics.requestsPerMin}</div></div>
        <div class="metric-card"><div class="metric-label">Error Rate</div><div class="metric-value" id="m-err">${s.metrics.errorRatePct.toFixed(2)}%</div></div>
      </div>

      <div class="grid-2">
        <div class="panel">
          <div class="section-title">Dependencies</div>
          <div id="dep-list">${depHtml}</div>
        </div>
        <div class="panel">
          <div class="section-title">Performance</div>
          <div class="chart-wrap">
            <div class="chart-label">API Response (last 60s)</div>
            <svg class="chart-svg" viewBox="0 0 320 72" preserveAspectRatio="none"><path class="chart-line" id="spark-path" d="${s.sparkPath}"/></svg>
            ${chartNote}
          </div>
          <div id="perf-bars">
            ${bar('CPU', s.runtime.cpuPct)}
            ${bar('Memory', s.runtime.memPct)}
            ${bar('Heap', s.runtime.heapPct)}
            ${bar('Disk', s.runtime.diskPct)}
          </div>
          <div class="perf-stats">
            <span>Avg Response: <strong id="avg-resp">${latencyDisplay === '—' ? '—' : latencyDisplay.replace(' ', '')}</strong></span>
            <span>P95 Response: <strong id="p95-resp">${p95Display === '—' ? '—' : p95Display.replace(' ', '')}</strong></span>
            <span>Samples: <strong id="sample-count">${s.metrics.sampleCount}</strong></span>
          </div>
        </div>
      </div>

      <div class="grid-2" style="margin-top:16px">
        <div class="panel">
          <div class="section-title">Deployment</div>
          <div class="deploy-grid" id="deploy-grid">
            <span class="deploy-key">Environment</span><span class="deploy-val">${escapeHtml(s.deployment.environment)}</span>
            <span class="deploy-key">Branch</span><span class="deploy-val">${escapeHtml(s.deployment.branch)}</span>
            <span class="deploy-key">Commit</span><span class="deploy-val">${escapeHtml(s.deployment.commit)}</span>
            <span class="deploy-key">Version</span><span class="deploy-val">${escapeHtml(s.deployment.version)}</span>
            <span class="deploy-key">Node</span><span class="deploy-val">${escapeHtml(s.deployment.node)}</span>
            <span class="deploy-key">Region</span><span class="deploy-val">${escapeHtml(s.deployment.region)}</span>
            <span class="deploy-key">Started</span><span class="deploy-val" id="deploy-started">${escapeHtml(s.deployment.started)}</span>
          </div>
        </div>
        <div class="panel">
          <div class="section-title">Recent Health Events</div>
          <div id="event-list">${eventsHtml}</div>
        </div>
      </div>
    </div>

    <div id="panel-metrics" class="tab-panel">
      <div class="panel" style="margin-bottom:16px">
        <div class="section-title">Runtime Metrics</div>
        <div class="metrics-grid" id="runtime-metrics">
          <div class="metric-card"><div class="metric-label">Heap Used</div><div class="metric-value" id="rm-heap-used">${s.runtime.heap.heapUsedMb} MB</div></div>
          <div class="metric-card"><div class="metric-label">RSS</div><div class="metric-value" id="rm-rss">${s.runtime.heap.rssMb} MB</div></div>
          <div class="metric-card"><div class="metric-label">Load (1m)</div><div class="metric-value" id="rm-load">${s.runtime.load1m}</div></div>
          <div class="metric-card"><div class="metric-label">CPUs</div><div class="metric-value">${s.runtime.cpuCount}</div></div>
          <div class="metric-card"><div class="metric-label">System Free</div><div class="metric-value" id="rm-sys-free">${s.runtime.heap.systemFreeMb} MB</div></div>
          <div class="metric-card"><div class="metric-label">Disk Used</div><div class="metric-value" id="rm-disk">${s.runtime.disk?.usedPct != null ? `${s.runtime.disk.usedPct}%` : '—'}</div></div>
        </div>
      </div>
      <div class="panel" id="heap-breakdown">${heapHtml}</div>
    </div>

    <div id="panel-logs" class="tab-panel">
      <div class="panel"><div class="section-title">Event Log</div><div id="event-list-full">${eventsHtml}</div></div>
    </div>

    <div id="panel-json" class="tab-panel">
      <pre class="json" id="raw-json">${jsonSafe}</pre>
    </div>

    <div id="panel-diagnostics" class="tab-panel">
      <div class="panel">
        <div class="section-title">Diagnostics</div>
        <div class="diag-row"><span>API Status</span><span id="diag-status">${escapeHtml(s.detail.status)}</span></div>
        <div class="diag-row"><span>Probe Status</span><span id="diag-probe">${escapeHtml(s.probe?.status || '—')}</span></div>
        <div class="diag-row"><span>PID</span><span>${process.pid}</span></div>
        <div class="diag-row"><span>Platform</span><span>${escapeHtml(process.platform)} ${escapeHtml(process.arch)}</span></div>
        <div class="diag-row"><span>Probe checked</span><span id="diag-checked">${escapeHtml(s.probe?.checkedAt || '—')}</span></div>
        <div class="diag-row"><span>Disk path</span><span>${escapeHtml(s.runtime.disk?.path || '—')}</span></div>
      </div>
    </div>

    <section class="warnings">
      <div class="section-title">System Warnings</div>
      <div id="warnings">${warningsHtml}</div>
      <div class="actions">
        <button type="button" id="btn-retry">Retry Connection</button>
        <button type="button" id="btn-download">Download Report</button>
        <button type="button" id="btn-copy">Copy Diagnostics</button>
        <button type="button" id="btn-json-tab">View JSON</button>
      </div>
    </section>
  </div>
  <div class="toast" id="toast"></div>
  <textarea id="health-data" hidden readonly aria-hidden="true">${jsonForTextarea(s.jsonPayload)}</textarea>
  <script src="/api/health/dashboard.js" defer></script>
</body>
</html>`;
}

module.exports = {
  wantsHealthHtml,
  wantsDashboardJson,
  buildDashboardData,
  buildSnapshot,
  renderHealthPage,
};
