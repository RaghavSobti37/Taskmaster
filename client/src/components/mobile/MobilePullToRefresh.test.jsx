import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MobilePullToRefresh from './MobilePullToRefresh';

const mockUsePullToRefreshEnabled = vi.fn();
const mockUsePullToRefresh = vi.fn();

vi.mock('../../hooks/useBreakpoint', () => ({
  usePullToRefreshEnabled: () => mockUsePullToRefreshEnabled(),
}));

vi.mock('../../hooks/usePullToRefresh', async () => {
  const actual = await vi.importActual('../../hooks/usePullToRefresh');
  return {
    ...actual,
    usePullToRefresh: (...args) => mockUsePullToRefresh(...args),
  };
});

vi.mock('../../lib/pageRefresh', () => ({
  refreshMobilePage: vi.fn(),
}));

vi.mock('../ui/Spinner', () => ({
  Spinner: () => <div data-testid="ptr-spinner" />,
}));

function renderPtr(path = '/dashboard') {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <MobilePullToRefresh />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MobilePullToRefresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePullToRefreshEnabled.mockReturnValue(true);
    mockUsePullToRefresh.mockReturnValue({
      pullDistance: 0,
      isRefreshing: false,
      indicatorVisible: false,
      progress: 0,
    });
  });

  it('renders nothing on desktop layout', () => {
    mockUsePullToRefreshEnabled.mockReturnValue(false);
    const { container } = renderPtr();
    expect(container).toBeEmptyDOMElement();
  });

  it('does not mount indicator DOM until pull is active', () => {
    renderPtr();
    expect(screen.queryByTestId('mobile-ptr-indicator')).not.toBeInTheDocument();
  });

  it('shows indicator when pulling on mobile', () => {
    mockUsePullToRefresh.mockReturnValue({
      pullDistance: 40,
      isRefreshing: false,
      indicatorVisible: true,
      progress: 0.55,
    });
    renderPtr();
    expect(screen.getByTestId('mobile-ptr-indicator')).toBeInTheDocument();
  });

  it('uses artist workspace scroll target on workspace routes', () => {
    renderPtr('/artist-workspace/abc123');
    expect(mockUsePullToRefresh).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        getScrollElement: expect.any(Function),
      }),
    );
    const { getScrollElement } = mockUsePullToRefresh.mock.calls[0][0];
    document.body.innerHTML = '<main data-artist-workspace-scroll></main>';
    expect(getScrollElement()).toBe(document.querySelector('[data-artist-workspace-scroll]'));
  });
});
