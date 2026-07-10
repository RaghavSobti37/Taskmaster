import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { mockGet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ confirmSessionFromEstablish: vi.fn() }),
}));

vi.mock('../../lib/orgFirstAuth', () => ({
  isOrgFirstAuthEnabled: () => false,
}));

vi.mock('../../config/clerk', () => ({
  isClerkConfigured: () => false,
}));

vi.mock('axios', () => ({
  default: {
    get: (...args) => mockGet(...args),
    post: vi.fn(),
    defaults: {},
  },
}));

import OrgSwitcher from './OrgSwitcher.jsx';

function renderSwitcher() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <OrgSwitcher variant="sidebar" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('OrgSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({
      data: {
        memberships: [{
          id: 'm1',
          role: 'admin',
          tenant: { _id: 't1', name: 'The Shakti Collective', slug: 'tsc', plan: 'free' },
        }],
        activeTenantId: 't1',
      },
    });
  });

  it('renders with a single membership and exposes create + settings actions', async () => {
    const user = userEvent.setup();
    renderSwitcher();

    await waitFor(() => {
      expect(screen.getByText('The Shakti Collective')).toBeInTheDocument();
    });

    const trigger = screen.getByRole('button', { name: /switch organization — the shakti collective/i });
    expect(trigger).not.toBeDisabled();

    await user.click(trigger);

    expect(screen.getByRole('button', { name: 'Organization settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create organization' })).toBeInTheDocument();
  });
});
