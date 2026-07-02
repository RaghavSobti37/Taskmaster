import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  Copy,
  Mail,
  RefreshCw,
} from 'lucide-react';
import { Button } from './ui/primitives';
import { hardReloadApp } from '../utils/chunkRecovery';
import { useToast } from '../lib/systemLogBridge';
import {
  buildRouteErrorReference,
  buildRouteErrorSupportMailto,
  copyRouteErrorReference,
  summarizeRouteError,
} from '../utils/routeErrorPresentation';

/** ponytail: RR history idx when present, else length heuristic */
export function canGoBackInHistory() {
  const idx = window.history.state?.idx;
  return typeof idx === 'number' ? idx > 0 : window.history.length > 1;
}

const actionBtnClass =
  'h-9 min-h-[44px] w-full justify-center gap-2 sm:min-h-9';

export function RouteErrorFallback({ error, errorRef, onReload }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [detailCopied, setDetailCopied] = useState(false);

  const summary = useMemo(() => summarizeRouteError(error), [error]);
  const supportMailto = useMemo(
    () => buildRouteErrorSupportMailto(errorRef, summary),
    [errorRef, summary],
  );
  const technicalDetail = useMemo(() => {
    const name = String(error?.name || 'Error').trim();
    const message = String(error?.message || '').trim();
    if (!message) return name;
    return `${name}: ${message}`;
  }, [error]);

  const handleGoBack = () => {
    if (canGoBackInHistory()) {
      navigate(-1);
    } else {
      navigate('/dashboard', { replace: true });
    }
  };

  const handleCopyRef = async () => {
    try {
      await copyRouteErrorReference({ errorRef, summary, error });
      setCopied(true);
      toast.success('Error details copied');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.warn('Could not copy — select the reference manually');
    }
  };

  const handleCopyTechnical = async () => {
    try {
      await copyRouteErrorReference(technicalDetail);
      setDetailCopied(true);
      toast.success('Error message copied');
      window.setTimeout(() => setDetailCopied(false), 2000);
    } catch {
      toast.warn('Could not copy — select the message manually');
    }
  };

  return (
    <div
      className="flex min-h-[calc(100dvh-6rem)] w-full items-center justify-center bg-[var(--color-bg-workspace)] px-4 py-10 sm:px-6"
      role="alert"
    >
      <div className="w-full max-w-md text-center">
        <div className="rounded-2xl border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] px-6 py-8 sm:px-8 sm:py-10">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-brand-teal)]/12 text-[var(--color-brand-teal)]">
            <AlertTriangle size={28} aria-hidden />
          </div>

          <h1 className="text-lg font-bold tracking-tight text-[var(--color-text-primary)]">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
            {summary}
          </p>

          <div className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] px-3 py-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Reference
            </span>
            <code
              className="font-mono text-xs tracking-wide text-[var(--color-text-primary)]"
              data-testid="route-error-ref"
            >
              {errorRef}
            </code>
            <button
              type="button"
              onClick={handleCopyRef}
              className="ml-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-atomic)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-border)] hover:text-[var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-action-primary)]"
              aria-label={copied ? 'Copied' : 'Copy error details'}
              title={copied ? 'Copied' : 'Copy error details'}
            >
              <Copy size={14} aria-hidden />
            </button>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <Button type="button" onClick={onReload} className={actionBtnClass}>
              <RefreshCw size={14} aria-hidden />
              Refresh
            </Button>

            <a
              href={supportMailto}
              className={`rounded-[var(--radius-atomic)] font-semibold transition-all inline-flex shrink-0 items-center ${actionBtnClass} bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border border-[var(--color-bg-border)] hover:bg-[var(--color-bg-border)] px-4 text-sm`}
            >
              <Mail size={14} aria-hidden />
              Contact admin
            </a>

            <Button
              type="button"
              variant="secondary"
              onClick={handleGoBack}
              className={actionBtnClass}
            >
              <ArrowLeft size={14} aria-hidden />
              Go back
            </Button>
          </div>

          <div className="mt-4 border-t border-[var(--color-bg-border)] pt-4">
            <button
              type="button"
              onClick={() => setDetailsOpen((open) => !open)}
              aria-expanded={detailsOpen}
              className="mx-auto flex min-h-[44px] items-center justify-center gap-2 text-xs font-semibold text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
            >
              What happened
              <ChevronDown
                size={14}
                aria-hidden
                className={`transition-transform ${detailsOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {detailsOpen ? (
              <div className="relative mt-3">
                <pre
                  className="max-h-40 overflow-auto rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] px-3 py-2.5 pr-10 text-left font-mono text-[11px] leading-relaxed text-[var(--color-text-muted)] whitespace-pre-wrap break-words"
                  data-testid="route-error-technical"
                >
                  {technicalDetail}
                </pre>
                <button
                  type="button"
                  onClick={handleCopyTechnical}
                  className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-atomic)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-border)] hover:text-[var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-action-primary)]"
                  aria-label={detailCopied ? 'Copied error message' : 'Copy error message'}
                  title={detailCopied ? 'Copied' : 'Copy error message'}
                >
                  <Copy size={14} aria-hidden />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorRef: null };
  }

  static getDerivedStateFromError(error) {
    const capturedAt = Date.now();
    return {
      error,
      errorRef: buildRouteErrorReference(error, capturedAt),
    };
  }

  componentDidCatch(error, info) {
    console.error('[RouteErrorBoundary]', error, info?.componentStack);
  }

  handleReload = () => {
    this.setState({ error: null, errorRef: null });
    void hardReloadApp();
  };

  render() {
    if (this.state.error) {
      return (
        <RouteErrorFallback
          error={this.state.error}
          errorRef={this.state.errorRef}
          onReload={this.handleReload}
        />
      );
    }
    return this.props.children;
  }
}
