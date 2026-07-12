/**
 * Health dashboard client — external file for CSP script-src 'self' (no inline scripts).
 */
(function healthDashboard() {
  const REFRESH_MS = 60_000;
  let RAW = {};
  let autoOn = false;
  let timer = null;

  function loadRaw() {
    const el = document.getElementById('health-data');
    if (!el) return {};
    try {
      return JSON.parse(el.textContent || el.value || '{}');
    } catch {
      return {};
    }
  }

  function toast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2000);
  }

  function setLastUpdated() {
    const el = document.getElementById('last-updated');
    if (el) {
      el.textContent = `Last Updated: ${new Date().toLocaleTimeString('en-GB', { hour12: false })}`;
    }
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function switchTab(tabId) {
    document.querySelectorAll('.tab').forEach((b) => {
      b.classList.toggle('active', b.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-panel').forEach((p) => {
      p.classList.toggle('active', p.id === `panel-${tabId}`);
    });
  }

  function applyDashboard(data) {
    if (!data) return;
    RAW = { status: data.detail?.status, dependencies: data.detail?.dependencies, dashboard: data };
    setText('m-score', `${data.score}%`);
    setText('m-latency', data.metrics?.avgLatencyMs != null ? `${data.metrics.avgLatencyMs} ms` : '—');
    setText('m-uptime', data.uptime || '—');
    setText('m-rpm', String(data.metrics?.requestsPerMin ?? 0));
    setText('m-err', `${(data.metrics?.errorRatePct ?? 0).toFixed(2)}%`);
    setText('avg-resp', data.metrics?.avgLatencyMs != null ? `${data.metrics.avgLatencyMs}ms` : '—');
    setText('p95-resp', data.metrics?.p95LatencyMs != null ? `${data.metrics.p95LatencyMs}ms` : '—');
    setText('sample-count', String(data.metrics?.sampleCount ?? 0));
    setText('hero-title', data.hero?.title || '—');
    setText('hero-sub', data.hero?.subtitle || '—');
    setText('diag-status', data.detail?.status || '—');
    setText('diag-probe', data.probe?.status || '—');
    setText('diag-checked', data.probe?.checkedAt || data.checkedAt || '—');
    const dot = document.getElementById('hero-dot');
    if (dot) dot.className = `pulse pulse-${data.hero?.dot || 'ok'}`;
    const spark = document.getElementById('spark-path');
    if (spark && data.sparkPath) spark.setAttribute('d', data.sparkPath);
    const raw = document.getElementById('raw-json');
    if (raw) raw.textContent = JSON.stringify(RAW, null, 2);
    setLastUpdated();
  }

  function setRefreshLoading(loading) {
    const btn = document.getElementById('btn-refresh');
    if (!btn) return;
    btn.classList.toggle('is-loading', loading);
    btn.disabled = loading;
    btn.setAttribute('aria-busy', loading ? 'true' : 'false');
    const label = btn.querySelector('.refresh-label');
    if (label) label.textContent = loading ? 'Refreshing…' : 'Refresh';
  }

  async function refreshDashboard(force, options = {}) {
    const { showRefreshLoading = false } = options;
    const btn = document.getElementById('btn-refresh');
    if (showRefreshLoading && btn?.disabled) return;

    if (showRefreshLoading) setRefreshLoading(true);
    try {
      const q = force ? '&refresh=1' : '';
      const res = await fetch(`/api/health?dashboard=1&format=json${q}`, {
        headers: { Accept: 'application/json' },
      });
      const body = await res.json();
      if (body.dashboard) applyDashboard(body.dashboard);
    } catch {
      toast('Refresh failed');
    } finally {
      if (showRefreshLoading) setRefreshLoading(false);
    }
  }

  function schedule() {
    clearInterval(timer);
    if (!autoOn) return;
    timer = setInterval(() => refreshDashboard(false), REFRESH_MS);
  }

  function init() {
    RAW = loadRaw();
    setLastUpdated();

    document.querySelectorAll('.tab').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab(btn.dataset.tab);
      });
    });

    document.getElementById('auto-toggle')?.addEventListener('click', () => {
      autoOn = !autoOn;
      document.getElementById('auto-dot')?.classList.toggle('off', !autoOn);
      schedule();
    });

    document.getElementById('btn-refresh')?.addEventListener('click', () => {
      refreshDashboard(true, { showRefreshLoading: true });
    });
    document.getElementById('btn-retry')?.addEventListener('click', () => refreshDashboard(true));

    document.getElementById('btn-download')?.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(RAW, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `coreknot-health-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast('Report downloaded');
    });

    document.getElementById('btn-copy')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(JSON.stringify(RAW, null, 2));
        toast('Copied to clipboard');
      } catch {
        window.prompt('Copy diagnostics:', JSON.stringify(RAW, null, 2));
      }
    });

    document.getElementById('btn-json-tab')?.addEventListener('click', () => switchTab('json'));

    schedule();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
