import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TabHubLayout from './TabHubLayout';

const mockUseAuth = vi.fn();
const mockUseTenantUnlocks = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../hooks/useTenantUnlocks', () => ({
  useTenantUnlocks: () => mockUseTenantUnlocks(),
}));

function Panel({ label }) {
  return <div>{label}</div>;
}

describe('TabHubLayout', () => {
  it('filters feature-locked tabs from management hub', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        _id: 'u1',
        departmentId: { slug: 'admin', permissionPreset: 'admin' },
      },
    });
    mockUseTenantUnlocks.mockReturnValue({
      isFeatureUnlocked: (featureKey) => featureKey !== 'finance',
    });

    render(
      <MemoryRouter initialEntries={['/management?tab=finance']}>
        <Routes>
          <Route
            path="/management"
            element={(
              <TabHubLayout
                hubPath="/management"
                panels={{
                  finance: () => <Panel label="Finance panel" />,
                  announcements: () => <Panel label="Announcements panel" />,
                  documents: () => <Panel label="Documents panel" />,
                  artists: () => <Panel label="Artists panel" />,
                }}
              />
            )}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: /finance/i })).toBeNull();
    expect(await screen.findByText('Announcements panel')).toBeTruthy();
  });
});
