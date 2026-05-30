import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import toast, { Toaster } from 'react-hot-toast';
import {
  CheckCircle,
  AlertTriangle,
  OctagonX,
  X,
  Copy,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import {
  SEVERITY,
  buildErrorCopyText as buildCopyFromContract,
  TOAST_DURATION,
} from './systemLogContract';

/** Generic API messages — interceptor must not toast these */
const GENERIC_API_MESSAGES = new Set([
  'operation successful',
  'success',
  'ok',
  'done',
  'created',
  'updated',
  'deleted',
]);

let suppressAutoUntil = 0;

/** Call before multi-step axios flows that show their own toast */
export function suppressAutoToasts(ms = 4000) {
  suppressAutoUntil = Date.now() + ms;
}

export function shouldShowAutoToast() {
  return Date.now() > suppressAutoUntil;
}

export function isGenericApiMessage(message) {
  if (!message || typeof message !== 'string') return true;
  return GENERIC_API_MESSAGES.has(message.trim().toLowerCase());
}

/** Pass as axios config third arg / spread into config to silence global interceptor */
export const AXIOS_SKIP_TOAST = { headers: { 'x-skip-toast': 'true' } };

export function shouldShowApiSuccessToast(response) {
  if (!shouldShowAutoToast()) return false;
  const headers = response?.config?.headers || {};
  if (headers['x-skip-toast'] || headers['X-Skip-Toast']) return false;
  if (headers['x-show-toast'] || headers['X-Show-Toast']) return true;
  const message = response?.data?.message;
  return Boolean(message) && !isGenericApiMessage(message);
}

export function shouldShowApiErrorToast(error) {
  if (!shouldShowAutoToast()) return false;
  const headers = error?.config?.headers || {};
  if (headers['x-skip-toast'] || headers['X-Skip-Toast']) return false;
  if (headers['x-show-toast'] || headers['X-Show-Toast']) return true;
  return true;
}

/** @deprecated Prefer makeToastId from systemLogContract — kept for axios slug helpers */
export function slugId(...parts) {
  return parts
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
}

const TOAST_WIDTH_CLASS = 'w-full max-w-[min(420px,calc(100vw-2rem))]';

const cardBase =
  `pointer-events-auto ${TOAST_WIDTH_CLASS} shadow-lg rounded-xl border transition-all duration-300`;

export function buildErrorCopyText(props) {
  return buildCopyFromContract(props);
}

const SEVERITY_UI = {
  [SEVERITY.SUCCESS]: {
    Icon: CheckCircle,
    iconClass: 'text-[var(--color-pastel-mint-text)]',
    borderClass: 'border-[var(--color-pastel-mint-text)]/25',
  },
  [SEVERITY.INFO]: {
    Icon: Info,
    iconClass: 'text-[var(--color-pastel-blue-text)]',
    borderClass: 'border-[var(--color-pastel-apricot-text)]/25',
  },
  [SEVERITY.WARN]: {
    Icon: AlertTriangle,
    iconClass: 'text-[var(--color-pastel-apricot-text)]',
    borderClass: 'border-[var(--color-pastel-apricot-text)]/25',
  },
  [SEVERITY.ERROR]: {
    Icon: OctagonX,
    iconClass: 'text-[var(--color-pastel-rose-text)]',
    borderClass: 'border-[var(--color-pastel-rose-text)]/30 dark:border-red-900/50',
  },
};

const SystemToastCard = ({
  t,
  severity,
  module: logModule,
  message,
  title,
  description,
  technicalError,
  errorCode,
  status,
  traceId,
  timestamp,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ui = SEVERITY_UI[severity] || SEVERITY_UI[SEVERITY.INFO];
  const Icon = ui.Icon;
  const displayTitle = title || message;
  const hasExpandableDetails = Boolean(technicalError && technicalError.length > 0);
  const showDiagnostics = severity === SEVERITY.ERROR || (hasExpandableDetails && severity === SEVERITY.WARN);

  const copyPayload = buildErrorCopyText({
    title: displayTitle,
    description,
    technicalError,
    errorCode,
    status,
    traceId,
    module: logModule,
    timestamp,
    severity,
  });

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(copyPayload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  };

  return (
    <div
      className={`${cardBase} bg-[var(--color-bg-surface)] ${ui.borderClass} p-4 flex flex-col gap-3`}
      role="alert"
    >
      <div className="flex items-start gap-3 w-full">
        <Icon className={`w-5 h-5 ${ui.iconClass} shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0 overflow-hidden">
          {logModule && (
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-0.5">
              {logModule}
            </p>
          )}
          <p className="text-sm font-semibold text-[var(--color-text-primary)] break-words">{displayTitle}</p>
          {description && description !== displayTitle && (
            <p className="text-xs text-[var(--color-text-secondary)] mt-1 break-words">{description}</p>
          )}
          {errorCode && (
            <p className="text-[10px] font-mono text-[var(--color-text-muted)] mt-1.5">
              Code: {errorCode}
              {status ? ` · HTTP ${status}` : ''}
              {traceId ? ` · Trace ${traceId.slice(0, 8)}…` : ''}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => toast.dismiss(t.id)}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {showDiagnostics && (
        <div className="pt-3 border-t border-[var(--color-bg-border)] flex flex-col gap-2">
          <div className="flex items-center gap-4 flex-wrap">
            {hasExpandableDetails && (
              <button
                type="button"
                onClick={() => setIsOpen((v) => !v)}
                className="flex items-center gap-1 text-xs font-medium text-[var(--color-text-secondary)] hover:underline"
              >
                {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {isOpen ? 'Hide technical logs' : 'Show technical logs'}
              </button>
            )}
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-pastel-rose-text)] transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? 'Copied!' : 'Copy diagnostics'}
            </button>
          </div>
          {isOpen && hasExpandableDetails && (
            <pre className="p-2 bg-[var(--color-bg-primary)] text-[10px] font-mono text-[var(--color-pastel-rose-text)] overflow-x-auto rounded border border-[var(--color-bg-border)] max-h-32 whitespace-pre-wrap break-words">
              {technicalError}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};

function pushCustom(render, { id, duration = 4000 }) {
  toast.dismiss(id);
  toast.custom(render, { id, duration, position: 'top-right' });
}

/** Extract human + technical parts from axios or native errors */
export function parseErrorPayload(error, fallbackTitle = 'Something went wrong') {
  const data = error?.response?.data;
  const status = error?.response?.status;
  const title =
    (typeof data?.error === 'string' && data.error) ||
    (typeof data?.message === 'string' && data.message) ||
    error?.message ||
    fallbackTitle;
  const description =
    (typeof data?.message === 'string' && data?.message !== title ? data.message : null) ||
    (typeof data?.details === 'string' ? data.details : null) ||
    null;
  const errorCode =
    (typeof data?.code === 'string' && data.code) ||
    (typeof data?.errorCode === 'string' && data.errorCode) ||
    (typeof data?.error_code === 'string' && data.error_code) ||
    (status ? `HTTP_${status}` : null);
  const traceId = typeof data?.traceId === 'string' ? data.traceId : null;
  const technicalError =
    (typeof data?.stack === 'string' && data.stack) ||
    (import.meta.env.DEV && error?.stack ? error.stack : null) ||
    (typeof data?.technical === 'string' && data.technical) ||
    null;

  return { title, description, technicalError, errorCode, status, traceId };
}

/**
 * @internal — only systemLogBridge should call this for standard toasts.
 */
export function showSystemToast({
  id,
  severity,
  module,
  message,
  title,
  description,
  technicalError,
  errorCode,
  status,
  traceId,
  timestamp,
  duration,
  customRender,
}) {
  const resolvedDuration = duration ?? TOAST_DURATION[severity] ?? 5000;

  if (customRender) {
    pushCustom(customRender, { id, duration: resolvedDuration });
    return id;
  }

  pushCustom(
    (t) => (
      <SystemToastCard
        t={t}
        severity={severity}
        module={module}
        message={message}
        title={title}
        description={description}
        technicalError={technicalError}
        errorCode={errorCode}
        status={status}
        traceId={traceId}
        timestamp={timestamp}
      />
    ),
    { id, duration: resolvedDuration }
  );
  return id;
}

/** Custom render escape hatch (e.g. XP awards) — not for standard severity toasts */
export function pushCustomToast(render, options = {}) {
  return toast.custom(render, { position: 'top-right', ...options });
}

export function dismissSystemToast(id) {
  toast.dismiss(id);
}

export function dismissAllSystemToasts() {
  toast.dismiss();
}

export const ERPNotificationProvider = () => {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <Toaster
      position="top-right"
      reverseOrder={false}
      gutter={8}
      containerClassName="tm-toast-container"
      containerStyle={{
        zIndex: 10060,
      }}
      toastOptions={{
        className: 'tm-toast-host',
        style: {
          background: 'transparent',
          boxShadow: 'none',
          padding: 0,
          margin: 0,
          maxWidth: 'min(420px, calc(100vw - 2rem))',
          width: 'max-content',
        },
      }}
    />,
    document.body
  );
};
