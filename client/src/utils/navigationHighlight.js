const HIGHLIGHT_PARAM = 'highlight';
const HIGHLIGHT_CLASS = 'flash-highlight';
const HIGHLIGHT_MS = 2000;

export function parseActionUrl(actionUrl) {
  if (!actionUrl) return { path: '', highlightId: null };
  try {
    const url = actionUrl.startsWith('http')
      ? new URL(actionUrl)
      : new URL(actionUrl, window.location.origin);
    const highlightId = url.searchParams.get(HIGHLIGHT_PARAM);
    return { path: `${url.pathname}${url.search}`, highlightId };
  } catch {
    return { path: actionUrl, highlightId: null };
  }
}

export function applyFlashHighlight(highlightId) {
  if (!highlightId) return;
  const run = () => {
    const el = document.querySelector(`[data-highlight-id="${highlightId}"]`);
    if (!el) return false;
    el.classList.add(HIGHLIGHT_CLASS);
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => el.classList.remove(HIGHLIGHT_CLASS), HIGHLIGHT_MS);
    return true;
  };
  if (run()) return;
  window.setTimeout(run, 300);
  window.setTimeout(run, 800);
}

export function useHighlightFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const highlightId = params.get(HIGHLIGHT_PARAM);
  if (highlightId) {
    applyFlashHighlight(highlightId);
  }
}

export { HIGHLIGHT_PARAM, HIGHLIGHT_CLASS };
