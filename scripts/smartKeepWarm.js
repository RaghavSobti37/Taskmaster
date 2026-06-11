#!/usr/bin/env node
/**
 * Smart inactive-aware keep-warm for Render free-tier APIs.
 *
 * Render spins down web services after ~15 minutes of no traffic. This script
 * runs on a short checker interval (e.g. every 5 min via GitHub Actions) but
 * only counts a request as a keep-warm ping when the service may be going cold.
 *
 * Usage:
 *   node scripts/smartKeepWarm.js
 *
 * Environment:
 *   KEEP_WARM_URL              Health endpoint (default: taskmaster production /api/health)
 *   KEEP_WARM_IDLE_MINUTES     Minutes since last ping before warming (default: 7)
 *   KEEP_WARM_COLD_MS          Response slower than this = cold start (default: 3000)
 *   KEEP_WARM_FAST_MS          Fast response threshold for skip (default: 2000)
 *   KEEP_WARM_STATE_PATH       State file path (default: .keep-warm-state.json)
 *   KEEP_WARM_STATE_JSON       Inline state JSON for CI cache restore (optional)
 *   SMART_KEEP_WARM_DRY_RUN    Set to 1 to exercise decision logic without network
 *
 * Exit codes:
 *   0 — skip (still warm) or successful ping
 *   1 — ping required but health check failed
 *
 * GitHub Actions: see .github/workflows/keep-warm.yml
 * Docs: docs/EXTERNAL_KEEP_WARM.md
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const DEFAULT_HEALTH_URL = 'https://YOUR-PRODUCTION-API.onrender.com/api/health';
const DEFAULT_STATE_PATH = '.keep-warm-state.json';

const KEEP_WARM_URL = (process.env.KEEP_WARM_URL || DEFAULT_HEALTH_URL).trim();
const IDLE_MINUTES = Number(process.env.KEEP_WARM_IDLE_MINUTES || 7);
const COLD_MS = Number(process.env.KEEP_WARM_COLD_MS || 3000);
const FAST_MS = Number(process.env.KEEP_WARM_FAST_MS || 2000);
const STATE_PATH = path.resolve(process.env.KEEP_WARM_STATE_PATH || DEFAULT_STATE_PATH);
const DRY_RUN = process.env.SMART_KEEP_WARM_DRY_RUN === '1';

const emptyState = () => ({
  lastKeepWarmPingAt: null,
  lastHealthCheckAt: null,
  lastResponseMs: null,
  consecutiveFastChecks: 0,
});

function loadState() {
  if (process.env.KEEP_WARM_STATE_JSON) {
    try {
      const parsed = JSON.parse(process.env.KEEP_WARM_STATE_JSON);
      return { ...emptyState(), ...parsed };
    } catch (err) {
      console.warn(`[keep-warm] invalid KEEP_WARM_STATE_JSON, starting fresh: ${err.message}`);
    }
  }
  if (fs.existsSync(STATE_PATH)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
      return { ...emptyState(), ...parsed };
    } catch (err) {
      console.warn(`[keep-warm] could not read ${STATE_PATH}, starting fresh: ${err.message}`);
    }
  }
  return emptyState();
}

function saveState(state) {
  const payload = JSON.stringify(state, null, 2);
  if (process.env.KEEP_WARM_STATE_JSON !== undefined) {
    console.log(`[keep-warm] state (for cache): ${payload}`);
  }
  try {
    fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
    fs.writeFileSync(STATE_PATH, payload);
  } catch (err) {
    console.warn(`[keep-warm] could not write ${STATE_PATH}: ${err.message}`);
  }
}

function minutesSince(iso) {
  if (!iso) return Infinity;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return Infinity;
  return ms / 60000;
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const started = Date.now();
    const req = client.get(url, { timeout: 30000 }, (res) => {
      res.resume();
      resolve({
        statusCode: res.statusCode,
        durationMs: Date.now() - started,
      });
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('request timed out after 30s'));
    });
    req.on('error', reject);
  });
}

function decideAction(state, responseMs) {
  const sincePing = minutesSince(state.lastKeepWarmPingAt);
  const isFast = responseMs < FAST_MS;
  const isCold = responseMs >= COLD_MS;
  const idleExceeded = sincePing >= IDLE_MINUTES;

  if (!idleExceeded && isFast && !isCold) {
    return { action: 'skip', reason: 'still warm' };
  }
  if (isCold) {
    return { action: 'ping', reason: `cold start (${responseMs}ms >= ${COLD_MS}ms)` };
  }
  if (idleExceeded) {
    return { action: 'ping', reason: `${sincePing.toFixed(1)}m since last ping (>= ${IDLE_MINUTES}m)` };
  }
  return { action: 'ping', reason: 'warm-up required' };
}

function runDryRunSelfTest() {
  const now = new Date().toISOString();
  const cases = [
    {
      name: 'skip when recent ping and fast',
      state: { lastKeepWarmPingAt: now, lastResponseMs: 500 },
      responseMs: 800,
      expect: 'skip',
    },
    {
      name: 'ping when idle exceeded',
      state: { lastKeepWarmPingAt: new Date(Date.now() - 8 * 60000).toISOString() },
      responseMs: 900,
      expect: 'ping',
    },
    {
      name: 'ping when cold response',
      state: { lastKeepWarmPingAt: now },
      responseMs: 4500,
      expect: 'ping',
    },
  ];

  let failed = 0;
  for (const c of cases) {
    const merged = { ...emptyState(), ...c.state };
    const { action } = decideAction(merged, c.responseMs);
    if (action !== c.expect) {
      console.error(`[keep-warm] dry-run FAIL: ${c.name} (got ${action}, expected ${c.expect})`);
      failed += 1;
    } else {
      console.log(`[keep-warm] dry-run OK: ${c.name}`);
    }
  }
  return failed === 0;
}

async function main() {
  if (!KEEP_WARM_URL) {
    console.error('[keep-warm] KEEP_WARM_URL is required');
    process.exit(1);
  }

  if (DRY_RUN) {
    const ok = runDryRunSelfTest();
    console.log('[keep-warm] dry-run complete (no network)');
    process.exit(ok ? 0 : 1);
  }

  const state = loadState();
  const checkStarted = new Date().toISOString();

  let statusCode;
  let responseMs;

  try {
    console.log(`[keep-warm] health GET ${KEEP_WARM_URL}`);
    const result = await httpGet(KEEP_WARM_URL);
    statusCode = result.statusCode;
    responseMs = result.durationMs;
    console.log(`[keep-warm] health ${statusCode} in ${responseMs}ms`);
  } catch (err) {
    console.error(`[keep-warm] health check failed: ${err.message}`);
    const sincePing = minutesSince(state.lastKeepWarmPingAt);
    const pingRequired = sincePing >= IDLE_MINUTES || !state.lastKeepWarmPingAt;
    process.exit(pingRequired ? 1 : 0);
  }

  state.lastHealthCheckAt = checkStarted;
  state.lastResponseMs = responseMs;

  const { action, reason } = decideAction(state, responseMs);

  if (action === 'skip') {
    state.consecutiveFastChecks += 1;
    saveState(state);
    console.log(`[keep-warm] skip: ${reason} (${responseMs}ms, consecutiveFastChecks=${state.consecutiveFastChecks})`);
    process.exit(0);
  }

  if (statusCode !== 200) {
    saveState(state);
    console.error(`[keep-warm] ping required (${reason}) but HTTP ${statusCode}`);
    process.exit(1);
  }

  state.lastKeepWarmPingAt = checkStarted;
  state.consecutiveFastChecks = 0;
  saveState(state);
  console.log(`[keep-warm] ping OK: ${reason} (${responseMs}ms)`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`[keep-warm] unexpected error: ${err.message}`);
  process.exit(1);
});
