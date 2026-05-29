import React, { useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import {
  CheckCircle,
  AlertTriangle,
  OctagonX,
  X,
  Copy,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

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

/** Deterministic id from strings — prevents toast spam on repeated calls */
export function slugId(...parts) {
  return parts
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
}

const TOAST_WIDTH_CLASS = 'w-[min(420px,calc(100vw-2rem))] min-w-[300px] max-w-[420px]';

const cardBase =
  `pointer-events-auto ${TOAST_WIDTH_CLASS} shadow-lg rounded-xl border transition-all duration-300`;

export function buildErrorCopyText({ title, description, technicalError, errorCode, status }) {
  const lines = [];
  if (title) lines.push(`Error: ${title}`);
  if (description && description !== title) lines.push(`Message: ${description}`);
  if (errorCode) lines.push(`Code: ${errorCode}`);
  if (status) lines.push(`HTTP: ${status}`);
  if (technicalError) {
    lines.push('', '--- Details ---', technicalError);
  }
  return lines.join('\n').trim() || 'Unknown error';
}

const ErrorToastCard = ({ t, title, description, technicalError, errorCode, status }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyPayload = buildErrorCopyText({ title, description, technicalError, errorCode, status });
  const hasExpandableDetails = Boolean(technicalError && technicalError.length > 0);

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
      className={`${cardBase} bg-[var(--color-bg-surface)] border-[var(--color-pastel-rose-text)]/30 dark:border-red-900/50 p-4 flex flex-col gap-3`}
      role="alert"
    >
      <div className="flex items-start gap-3 w-full">
        <OctagonX className="w-5 h-5 text-[var(--color-pastel-rose-text)] shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 overflow-hidden">
          <p className="text-sm font-semibold text-[var(--color-text-primary)] break-words">{title}</p>
          {description && description !== title && (
            <p className="text-xs text-[var(--color-text-secondary)] mt-1 break-words">{description}</p>
          )}
          {errorCode && (
            <p className="text-[10px] font-mono text-[var(--color-pastel-rose-text)] mt-1.5">
              Code: {errorCode}
              {status ? ` · HTTP ${status}` : ''}
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

      <div className="pt-3 border-t border-[var(--color-bg-border)] flex flex-col gap-2">
        <div className="flex items-center gap-4 flex-wrap">
          {hasExpandableDetails && (
            <button
              type="button"
              onClick={() => setIsOpen((v) => !v)}
              className="flex items-center gap-1 text-xs font-medium text-[var(--color-text-secondary)] hover:underline"
            >
              {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {isOpen ? 'Hide Details' : 'Show Details'}
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-pastel-rose-text)] transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            {copied ? 'Copied!' : 'Copy Error'}
          </button>
        </div>
        {isOpen && hasExpandableDetails && (
          <pre className="p-2 bg-[var(--color-bg-primary)] text-[10px] font-mono text-[var(--color-pastel-rose-text)] overflow-x-auto rounded border border-[var(--color-bg-border)] max-h-32 whitespace-pre-wrap break-words">
            {technicalError}
          </pre>
        )}
      </div>
    </div>
  );
};

const SimpleToastCard = ({ icon: Icon, iconClass, borderClass, message, onDismiss }) => (
  <div
    className={`${cardBase} flex items-center gap-3 bg-[var(--color-bg-surface)] ${borderClass} p-4`}
    role="status"
  >
    <Icon className={`w-5 h-5 shrink-0 ${iconClass}`} />
    <span className="text-sm font-medium text-[var(--color-text-primary)] flex-1">{message}</span>
    {onDismiss && (
      <button
        type="button"
        onClick={onDismiss}
        className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    )}
  </div>
);

function pushCustom(render, { id, duration = 4000 }) {
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
  const technicalError =
    (typeof data?.stack === 'string' && data.stack) ||
    (import.meta.env.DEV && error?.stack ? error.stack : null) ||
    (typeof data?.technical === 'string' && data.technical) ||
    null;

  return { title, description, technicalError, errorCode, status };
}

export const notify = {
  success(message, customId, options = {}) {
    const toastId = customId || slugId('success', message);
    const duration = options.duration ?? 4000;
    pushCustom(
      (t) => (
        <SimpleToastCard
          icon={CheckCircle}
          iconClass="text-[var(--color-pastel-mint-text)]"
          borderClass="border border-[var(--color-pastel-mint-text)]/25"
          message={message}
          onDismiss={() => toast.dismiss(t.id)}
        />
      ),
      { id: toastId, duration }
    );
  },

  warning(message, customId, options = {}) {
    const toastId = customId || slugId('warning', message);
    const duration = options.duration ?? 5000;
    pushCustom(
      (t) => (
        <SimpleToastCard
          icon={AlertTriangle}
          iconClass="text-[var(--color-pastel-apricot-text)]"
          borderClass="border border-[var(--color-pastel-apricot-text)]/25"
          message={message}
          onDismiss={() => toast.dismiss(t.id)}
        />
      ),
      { id: toastId, duration }
    );
  },

  info(message, customId, options = {}) {
    const toastId = customId || slugId('info', message);
    const duration = options.duration ?? 5000;
    pushCustom(
      (t) => (
        <SimpleToastCard
          icon={AlertTriangle}
          iconClass="text-[var(--color-pastel-blue-text)]"
          borderClass="border border-[var(--color-pastel-blue-text)]/25"
          message={message}
          onDismiss={() => toast.dismiss(t.id)}
        />
      ),
      { id: toastId, duration }
    );
  },

  error({ title, description, technicalError, errorCode, status, uniqueKey, duration = Infinity }) {
    const toastId = uniqueKey || slugId('error', title);
    pushCustom(
      (t) => (
        <ErrorToastCard
          t={t}
          title={title}
          description={description}
          technicalError={technicalError}
          errorCode={errorCode}
          status={status}
        />
      ),
      { id: toastId, duration }
    );
  },

  /** Map legacy ToastContext shape to notify */
  fromLegacy({ title, message, type = 'info', id, duration, technicalError, errorCode, status }) {
    suppressAutoToasts(duration ?? 5000);
    const toastId = id || slugId(type, title, message);
    const text = message || title || 'Notification';

    if (type === 'error') {
      const errorTitle = title || 'Error';
      notify.error({
        title: errorTitle,
        description: message && message !== errorTitle ? message : null,
        technicalError,
        errorCode,
        status,
        uniqueKey: toastId,
        duration: duration ?? Infinity,
      });
      return toastId;
    }
    if (type === 'success') {
      notify.success(text, toastId, { duration: duration ?? 4000 });
      return toastId;
    }
    if (type === 'warning') {
      notify.warning(text, toastId, { duration: duration ?? 5000 });
      return toastId;
    }
    notify.info(text, toastId, { duration: duration ?? 5000 });
    return toastId;
  },

  dismiss(id) {
    toast.dismiss(id);
  },

  dismissAll() {
    toast.dismiss();
  },

  custom(render, options = {}) {
    return toast.custom(render, { position: 'top-right', ...options });
  },
};

export function useNotification() {
  return notify;
}

export const ERPNotificationProvider = () => (
  <Toaster
    position="top-right"
    reverseOrder={false}
    gutter={8}
    containerClassName="tm-toast-container"
    containerStyle={{
      top: 16,
      right: 16,
      left: 'auto',
      bottom: 'auto',
      zIndex: 10060,
    }}
    toastOptions={{
      className: 'tm-toast-host',
      style: {
        background: 'transparent',
        boxShadow: 'none',
        padding: 0,
        margin: 0,
        minWidth: 'min(420px, calc(100vw - 2rem))',
        maxWidth: '420px',
        width: 'min(420px, calc(100vw - 2rem))',
      },
    }}
  />
);
