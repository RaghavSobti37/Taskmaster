import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  CloudOff,
  Copy,
  Home,
  Mail,
  RefreshCw,
} from 'lucide-react';
import { brand } from '../constants/marketingContent';
import { useToast } from '../lib/systemLogBridge';
import {
  buildRouteErrorCopyText,
  buildRouteErrorSupportMailto,
  copyRouteErrorReference,
  formatErrorTimestamp,
  getSystemStatusUrl,
  resolveAppErrorPresentation,
} from '../utils/routeErrorPresentation';
import { hardReloadApp } from '../utils/chunkRecovery';
import { Button } from './ui/primitives';

const actionBtnClass =
  'h-10 min-h-[44px] w-full justify-center gap-2 sm:min-h-10';

const footerLinkClass =
  'font-semibold text-[var(--color-brand-teal)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-action-primary)]';

/**
 * Shared full-page error — boot failures, route boundaries, and other blocking errors.
 */
export default function AppErrorPage({
  title,
  summary,
  message,
  error = null,
  errorRef = null,
  statusCode = null,
  capturedAt,
  showHealthyBadge,
  onRetry,
  onGoDashboard,
  className = '',
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const presentation = useMemo(
    () => resolveAppErrorPresentation({
      summary: summary || message,
      error,
      errorRef,
      statusCode,
      capturedAt,
      showHealthyBadge,
    }),
    [summary, message, error, errorRef, statusCode, capturedAt, showHealthyBadge],
  );

  const resolvedTitle = title || presentation.title;
  const supportMailto = useMemo(
    () => buildRouteErrorSupportMailto(presentation.errorRef, presentation.summary),
    [presentation.errorRef, presentation.summary],
  );
  const statusUrl = useMemo(() => getSystemStatusUrl(), []);
  const hostname =
    typeof window !== 'undefined' ? window.location.hostname : 'coreknot';
  const metadataParts = [
    presentation.statusCode ? `Error ${presentation.statusCode}` : null,
    hostname,
    formatErrorTimestamp(presentation.capturedAt),
  ].filter(Boolean);

  const fullErrorText = useMemo(
    () => buildRouteErrorCopyText({
      errorRef: presentation.errorRef,
      summary: presentation.summary,
      error: presentation.error,
      capturedAt: presentation.capturedAt,
    }),
    [presentation],
  );

  const handleRetry = onRetry || (() => { void hardReloadApp(); });

  const handleGoDashboard = () => {
    if (onGoDashboard) {
      onGoDashboard();
      return;
    }
    navigate('/dashboard', { replace: true });
  };

  const handleCopyFullError = async () => {
    try {
      await copyRouteErrorReference({
        errorRef: presentation.errorRef,
        summary: presentation.summary,
        error: presentation.error,
        capturedAt: presentation.capturedAt,
      });
      setCopied(true);
      toast.success('Full error copied');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.warn('Could not copy — select the error text manually');
    }
  };

  return (
    <div
      className={`flex min-h-screen w-full items-center justify-center bg-[var(--color-bg-workspace)] px-4 py-8 sm:px-6 ${className}`}
      role="alert"
    >
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] px-6 py-8 shadow-sm sm:px-8">
          {presentation.showHealthyBadge ? (
            <div className="mb-5 flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] px-3 py-1 text-[11px] font-medium text-[var(--color-text-secondary)]">
                <span
                  className="h-2 w-2 rounded-full bg-[var(--color-brand-teal)]"
                  aria-hidden
                />
                All other services are running normally
              </span>
            </div>
          ) : null}

          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-400">
            <CloudOff size={26} aria-hidden />
          </div>

          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-2xl">
              {resolvedTitle}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
              {presentation.summary}
            </p>
            <p className="mt-3 text-xs text-[var(--color-text-muted)]/80">
              {metadataParts.join(' • ')}
            </p>
            <p className="mt-1 font-mono text-[10px] tracking-wide text-[var(--color-text-muted)]">
              Ref {presentation.errorRef}
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button type="button" onClick={handleRetry} className={`${actionBtnClass} sm:flex-1`}>
              <RefreshCw size={14} aria-hidden />
              Refresh
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleGoDashboard}
              className={`${actionBtnClass} sm:flex-1`}
            >
              <Home size={14} aria-hidden />
              Go to dashboard
            </Button>
          </div>

          <div className="mt-6 border-t border-[var(--color-bg-border)] pt-4">
            <p className="flex flex-col items-center gap-1 text-center text-xs text-[var(--color-text-muted)] sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-1">
              <span className="inline-flex items-center gap-1">
                <Mail size={12} className="shrink-0 text-[var(--color-text-secondary)]" aria-hidden />
                Still broken?
              </span>
              <span className="inline-flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
                <a href={supportMailto} className={footerLinkClass}>
                  Contact your admin
                </a>
                <span>or</span>
                <a
                  href={statusUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={footerLinkClass}
                >
                  check system status
                </a>
              </span>
            </p>
          </div>

          <div className="mt-4 border-t border-[var(--color-bg-border)] pt-4">
            <button
              type="button"
              onClick={() => setDetailsOpen((open) => !open)}
              aria-expanded={detailsOpen}
              className="mx-auto flex min-h-[44px] w-full items-center justify-center gap-2 text-xs font-semibold text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
            >
              {detailsOpen ? 'Hide full error' : 'Show full error'}
              <ChevronDown
                size={14}
                aria-hidden
                className={`transition-transform ${detailsOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {detailsOpen ? (
              <div className="relative mt-3">
                <pre
                  className="max-h-48 overflow-auto rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] px-3 py-2.5 pr-10 text-left font-mono text-[11px] leading-relaxed text-[var(--color-text-muted)] whitespace-pre-wrap break-words"
                  data-testid="app-error-full"
                >
                  {fullErrorText}
                </pre>
                <button
                  type="button"
                  onClick={handleCopyFullError}
                  className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-atomic)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-border)] hover:text-[var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-action-primary)]"
                  aria-label={copied ? 'Copied full error' : 'Copy full error'}
                  title={copied ? 'Copied' : 'Copy full error'}
                >
                  <Copy size={14} aria-hidden />
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <p className="mt-4 text-center text-[10px] text-[var(--color-text-muted)]">
          {brand.name}
          {' '}
          support:
          {' '}
          <a href={`mailto:${brand.supportEmail}`} className={footerLinkClass}>
            {brand.supportEmail}
          </a>
        </p>
      </div>
    </div>
  );
}
