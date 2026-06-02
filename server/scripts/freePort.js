/**
 * Free a TCP port before dev server start (Windows-focused).
 * Usage: node scripts/freePort.js [port] [--wait]
 */
const { execSync } = require('child_process');

function getListeningPids(port = '5000') {
  const portStr = String(port);
  const pids = new Set();
  if (process.platform !== 'win32') {
    try {
      const out = execSync(`lsof -ti :${portStr}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      for (const pid of out.split(/\s+/).filter(Boolean)) pids.add(pid);
    } catch {
      /* port free */
    }
    return pids;
  }

  try {
    const out = execSync(`netstat -ano | findstr ":${portStr}.*LISTENING"`, { encoding: 'utf8' });
    for (const line of out.split(/\r?\n/)) {
      const m = line.trim().match(/LISTENING\s+(\d+)\s*$/i);
      if (m) pids.add(m[1]);
    }
  } catch {
    /* port free */
  }
  return pids;
}

function freePort(port = '5000', { exceptPid = null, wait = false, waitTimeoutMs = 8000 } = {}) {
  const portStr = String(port);
  const skip = exceptPid ? String(exceptPid) : null;

  const killPids = (pids) => {
    let killed = false;
    for (const pid of pids) {
      if (skip && pid === skip) continue;
      try {
        execSync(`taskkill /PID ${pid} /F /T`, { stdio: 'ignore' });
        console.log(`[freePort] Killed PID ${pid} on port ${portStr}`);
        killed = true;
      } catch {
        /* ignore */
      }
    }
    if (killed && process.platform === 'win32') {
      try {
        execSync('powershell -NoProfile -Command "Start-Sleep -Milliseconds 400"', { stdio: 'ignore' });
      } catch {
        /* ignore */
      }
    }
    return killed;
  };

  if (process.platform === 'win32') {
    killPids(getListeningPids(portStr));
  } else {
    try {
      execSync(`lsof -ti :${portStr} | xargs kill -9 2>/dev/null`, { shell: true, stdio: 'ignore' });
    } catch {
      /* ignore */
    }
  }

  if (wait) {
    const ok = waitUntilPortFree(portStr, { timeoutMs: waitTimeoutMs });
    if (!ok) {
      console.warn(`[freePort] Port ${portStr} still in use after ${waitTimeoutMs}ms`);
    }
  }
}

function waitUntilPortFree(port = '5000', { timeoutMs = 8000, intervalMs = 150, exceptPid = null } = {}) {
  const portStr = String(port);
  const skip = exceptPid ? String(exceptPid) : null;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const pids = [...getListeningPids(portStr)].filter((pid) => pid !== skip);
    if (pids.length === 0) return true;
    try {
      execSync(`powershell -NoProfile -Command "Start-Sleep -Milliseconds ${intervalMs}"`, {
        stdio: 'ignore',
      });
    } catch {
      /* ignore */
    }
  }
  return [...getListeningPids(portStr)].filter((pid) => pid !== skip).length === 0;
}

if (require.main === module) {
  const port = process.argv[2] || '5000';
  const shouldWait = process.argv.includes('--wait');
  freePort(port, { wait: shouldWait, waitTimeoutMs: 10000 });
}

module.exports = { freePort, waitUntilPortFree, getListeningPids };
