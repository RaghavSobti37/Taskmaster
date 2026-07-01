import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  Copy,
  HelpCircle,
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

export function RouteErrorFallback({ error, errorRef, onReload }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

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

  return (
    <div
      className="flex min-h-[calc(100dvh-6rem)] w-full items-center justify-center bg-[var(--color-bg-workspace)] px-6 py-10"
      role="alert"
    >
      <div className="w-full max-w-[22rem] text-center">
        <div className="rounded-2xl border border-[var(--color-bg-border)]/80 bg-[var(--color-bg-surface)] px-6 py-8 shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-brand-teal)]/12 text-[var(--color-brand-teal)]">
            <AlertTriangle size={28} aria-hidden />
          </div>

          <h1 className="text-base font-bold tracking-tight text-[var(--color-text-primary)]">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
            This page hit an unexpected error. Reload to recover — if it keeps happening, contact your
            admin with the reference below.
          </p>

          <p className="mt-4 text-sm leading-relaxed text-[var(--color-text-secondary)]">{summary}</p>

          <p className="mt-4 font-mono text-[11px] tracking-wide text-[var(--color-text-muted)]">
            Ref{' '}
            <span className="text-[var(--color-text-primary)]" data-testid="route-error-ref">
              {errorRef}
            </span>
          </p>

          <div className="mt-6 flex flex-col gap-2">
            <Button type="button" onClick={onReload} className="min-h-11 w-full justify-center gap-2">
              <RefreshCw size={14} aria-hidden />
              Refresh
            </Button>

            <a
              href={supportMailto}
              className="rounded-[var(--radius-atomic)] font-semibold transition-all inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border border-[var(--color-bg-border)] hover:bg-[var(--color-bg-border)] px-4 py-2 text-sm min-h-11 w-full"
            >
              <Mail size={14} aria-hidden />
              Contact admin
            </a>

            <Button
              type="button"
              variant="ghost"
              onClick={() => setDetailsOpen((open) => !open)}
              aria-expanded={detailsOpen}
              className="min-h-11 w-full justify-center gap-2 text-[var(--color-text-secondary)]"
            >
              <HelpCircle size={14} aria-hidden />
              What is the error
              <ChevronDown
                size={14}
                aria-hidden
                className={`transition-transform ${detailsOpen ? 'rotate-180' : ''}`}
              />
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={handleCopyRef}
              className="min-h-11 w-full justify-center gap-2 text-[var(--color-text-secondary)]"
            >
              <Copy size={14} aria-hidden />
              {copied ? 'Copied' : 'Copy error code'}
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={handleGoBack}
              className="min-h-11 w-full justify-center gap-2"
            >
              <ArrowLeft size={14} aria-hidden />
              Go back
            </Button>
          </div>

          {detailsOpen ? (
            <p
              className="mt-4 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] px-3 py-2.5 text-left text-xs leading-relaxed text-[var(--color-text-muted)] break-words"
              data-testid="route-error-technical"
            >
              {technicalDetail}
            </p>
          ) : null}
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
