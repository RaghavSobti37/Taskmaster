import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import RouteErrorBoundary, { RouteErrorFallback } from './RouteErrorBoundary.jsx';
import AppErrorPage from './AppErrorPage.jsx';
import { canGoBackInHistory } from '../utils/historyNavigation.js';
import {
  buildRouteErrorCopyText,
  buildRouteErrorReference,
  buildRouteErrorSupportMailto,
  copyRouteErrorReference,
  resolveAppErrorPresentation,
  summarizeRouteError,
} from '../utils/routeErrorPresentation.js';

vi.mock('../lib/systemLogBridge', () => ({
  useToast: () => ({
    success: vi.fn(),
    warn: vi.fn(),
  }),
}));

describe('canGoBackInHistory', () => {
  const originalState = window.history.state;

  afterEach(() => {
    window.history.replaceState(originalState, '');
  });

  it('uses history idx when available', () => {
    window.history.replaceState({ idx: 2 }, '');
    expect(canGoBackInHistory()).toBe(true);

    window.history.replaceState({ idx: 0 }, '');
    expect(canGoBackInHistory()).toBe(false);
  });

  it('falls back to history length', () => {
    window.history.replaceState(null, '');
    expect(canGoBackInHistory()).toBe(window.history.length > 1);
  });
});

describe('routeErrorPresentation', () => {
  it('builds stable reference from error and timestamp', () => {
    const error = new Error('Chunk load failed');
    const ref = buildRouteErrorReference(error, 1_700_000_000_000);
    expect(ref).toMatch(/^CK-\d{8}-[0-9A-F]{4,6}$/);
    expect(buildRouteErrorReference(error, 1_700_000_000_000)).toBe(ref);
  });

  it('summarizes chunk errors in plain language', () => {
    expect(summarizeRouteError(new Error('Loading chunk 42 failed'))).toMatch(/failed to load/i);
  });

  it('hides raw TypeError messages from users', () => {
    expect(summarizeRouteError(new Error('tableData.slice is not a function'))).toMatch(/unexpected error/i);
  });

  it('builds mailto with reference and summary', () => {
    const url = buildRouteErrorSupportMailto('CK-20260101-AB12', 'Network failed');
    expect(url).toMatch(/^mailto:/);
    expect(url).toContain('CK-20260101-AB12');
    expect(url).toContain('Network');
  });

  it('builds full support-ready copy text', () => {
    const error = new Error('Loading chunk 9 failed');
    const text = buildRouteErrorCopyText({
      errorRef: 'CK-20260701-A1B2',
      summary: 'A part of the app failed to load.',
      error,
      capturedAt: Date.parse('2026-07-01T10:00:00.000Z'),
    });
    expect(text).toContain('Reference: CK-20260701-A1B2');
    expect(text).toContain('Summary: A part of the app failed to load.');
    expect(text).toContain('Error: Error: Loading chunk 9 failed');
    expect(text).toContain('--- Stack ---');
    expect(text).toContain('Loading chunk 9 failed');
  });

  it('copies full diagnostics via clipboard API', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const error = new Error('Network failed');
    await copyRouteErrorReference({
      errorRef: 'CK-TEST-REF',
      summary: 'Network failed',
      error,
      capturedAt: Date.parse('2026-07-01T10:00:00.000Z'),
    });
    const copied = writeText.mock.calls[0][0];
    expect(copied).toContain('Reference: CK-TEST-REF');
    expect(copied).toContain('Summary: Network failed');
    expect(copied).toContain('Error: Error: Network failed');
    vi.unstubAllGlobals();
  });

  it('resolves server unavailable title for gateway errors', () => {
    const result = resolveAppErrorPresentation({ statusCode: 503 });
    expect(result.title).toMatch(/temporarily unavailable/i);
    expect(result.showHealthyBadge).toBe(true);
  });
});

describe('AppErrorPage', () => {
  const error = new Error('Loading chunk 9 failed');
  const errorRef = 'CK-20260701-A1B2';

  function renderPage(overrides = {}) {
    return render(
      <MemoryRouter>
        <AppErrorPage
          error={error}
          errorRef={errorRef}
          summary="A part of the app failed to load."
          onRetry={vi.fn()}
          {...overrides}
        />
      </MemoryRouter>,
    );
  }

  it('renders anchored card with actions and support links', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument();
    expect(screen.getByText(/Ref CK-20260701-A1B2/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go to dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /contact your admin/i })).toHaveAttribute(
      'href',
      expect.stringMatching(/^mailto:/),
    );
    expect(screen.getByRole('link', { name: /check system status/i })).toHaveAttribute(
      'href',
      expect.stringMatching(/\/api\/health$/),
    );
    expect(screen.getByRole('button', { name: /show full error/i })).toBeInTheDocument();
  });

  it('toggles and copies full error details', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    renderPage();

    expect(screen.queryByTestId('app-error-full')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /show full error/i }));
    expect(screen.getByTestId('app-error-full')).toHaveTextContent('Loading chunk 9 failed');
    await user.click(screen.getByRole('button', { name: /copy full error/i }));
    expect(writeText).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('RouteErrorFallback', () => {
  const error = new Error('Loading chunk 9 failed');

  it('delegates to AppErrorPage', () => {
    render(
      <MemoryRouter>
        <RouteErrorFallback error={error} errorRef="CK-20260701-A1B2" onReload={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show full error/i })).toBeInTheDocument();
  });
});

describe('RouteErrorBoundary', () => {
  function Bomb({ shouldThrow }) {
    if (shouldThrow) throw new Error('Boom in child');
    return <p>All good</p>;
  }

  it('renders children when healthy', () => {
    render(
      <MemoryRouter>
        <RouteErrorBoundary>
          <Bomb shouldThrow={false} />
        </RouteErrorBoundary>
      </MemoryRouter>,
    );
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('shows shared error page with generated reference on error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <MemoryRouter>
        <RouteErrorBoundary>
          <Bomb shouldThrow />
        </RouteErrorBoundary>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument();
    expect(screen.getByText(/Ref CK-/)).toBeInTheDocument();
    spy.mockRestore();
  });
});
