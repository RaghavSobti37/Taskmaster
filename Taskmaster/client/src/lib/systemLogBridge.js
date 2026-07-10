import { useCallback, useMemo } from 'react';
import {
  SEVERITY,
  MODULE,
  TOAST_DURATION,
  normalizeSystemEventEntry,
  makeToastId,
} from './systemLogContract';
import { showSystemToast, suppressAutoToasts, dismissSystemToast, shouldSuppressDuplicateToast } from './notifications';

let currentTraceId = globalThis.crypto?.randomUUID?.() || `trace-${Date.now()}`;

export function getClientTraceId() {
  return currentTraceId;
}

export function startClientTrace() {
  currentTraceId = globalThis.crypto?.randomUUID?.() || `trace-${Date.now()}`;
  return currentTraceId;
}

/**
 * Single emit surface for system events — toast UI only (no server persistence).
 */
export function emitSystemEvent(rawEntry = {}) {
  const entry = normalizeSystemEventEntry(rawEntry);
  const needsTrace =
    entry.severity === SEVERITY.ERROR || entry.severity === SEVERITY.WARN || !entry.traceId;
  const traceId = entry.traceId || (needsTrace ? getClientTraceId() : undefined);
  const toastId = entry.id;

  if (entry.userVisible && !shouldSuppressDuplicateToast(entry)) {
    const duration = entry.duration ?? TOAST_DURATION[entry.severity] ?? 5000;
    suppressAutoToasts(duration === Infinity ? 60000 : Math.min(duration, 8000));

    showSystemToast({
      id: toastId,
      severity: entry.severity,
      module: entry.module,
      message: entry.message,
      title: entry.title,
      description: entry.description,
      technicalError: entry.technicalError,
      errorCode: entry.errorCode,
      status: entry.status,
      traceId,
      timestamp: entry.timestamp,
      duration,
      customRender: entry.customRender,
    });
  }

  return toastId;
}

/** Map legacy ToastContext shape through the unified pipeline */
export function emitFromLegacy(legacy = {}) {
  const type = legacy.type || 'info';
  const severityMap = {
    success: SEVERITY.SUCCESS,
    error: SEVERITY.ERROR,
    warning: SEVERITY.WARN,
    info: SEVERITY.INFO,
  };

  return emitSystemEvent({
    severity: severityMap[type] || SEVERITY.INFO,
    module: legacy.module || MODULE.SYSTEM,
    title: legacy.title,
    message: legacy.message || legacy.title,
    description: legacy.message && legacy.message !== legacy.title ? legacy.message : undefined,
    userVisible: true,
    id: legacy.id,
    toastId: legacy.id,
    duration: legacy.duration,
    technicalError: legacy.technicalError,
    errorCode: legacy.errorCode,
    status: legacy.status,
    payload: legacy.payload,
    relatedEntities: legacy.relatedEntities,
  });
}

function resolveLegacyAddToast(arg1, arg2) {
  const legacyTypes = ['success', 'error', 'warning', 'info'];
  if (typeof arg1 === 'string' && typeof arg2 === 'string' && legacyTypes.includes(arg1)) {
    return emitFromLegacy({
      title: arg1 === 'error' ? 'Error' : arg1 === 'success' ? 'Success' : 'Notice',
      message: arg2,
      type: arg1,
      id: makeToastId(MODULE.SYSTEM, arg2, arg1),
    });
  }
  if (typeof arg1 === 'object' && arg1 !== null) {
    return emitFromLegacy(arg1);
  }
  if (typeof arg1 === 'string') {
    return emitFromLegacy({ message: arg1, type: 'info' });
  }
  return null;
}

/** Callable outside React tree (mutations, query hooks) */
export const globalToast = {
  addToast: (...args) => resolveLegacyAddToast(...args),
};

/**
 * Ergonomic hook — prefer over legacy useToast.
 */
export function useSystemToast() {
  const emit = useCallback((entry) => emitSystemEvent(entry), []);

  return useMemo(
    () => ({
      emit,
      success: (message, opts = {}) =>
        emitSystemEvent({ severity: SEVERITY.SUCCESS, message, module: opts.module, ...opts }),
      info: (message, opts = {}) =>
        emitSystemEvent({ severity: SEVERITY.INFO, message, module: opts.module, ...opts }),
      warn: (message, opts = {}) =>
        emitSystemEvent({ severity: SEVERITY.WARN, message, module: opts.module, ...opts }),
      error: (message, opts = {}) =>
        emitSystemEvent({
          severity: SEVERITY.ERROR,
          message,
          title: opts.title || message,
          ...opts,
        }),
      addToast: (...args) => resolveLegacyAddToast(...args),
      dismiss: dismissSystemToast,
    }),
    [emit]
  );
}

/** @deprecated Use useSystemToast */
export const useToast = useSystemToast;
