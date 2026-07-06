import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import OutletSidebar from './OutletSidebar.jsx';

const mockUseAuth = vi.fn();
const mockUseStatusCounts = vi.fn();
const mockUseTheme = vi.fn();
const mockUseIsMobile = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../contexts/SidebarContext', () => ({
  useSidebar: () => ({
    isOpen: true,
    toggleSidebar: vi.fn(),
    isMobileOpen: false,
    closeMobileSidebar: vi.fn(),
  }),
  SIDEBAR_SHELL_WIDTH_COLLAPSED: 60,
  SIDEBAR_SHELL_WIDTH_OPEN: 236,
  SIDEBAR_MOBILE_SHELL_WIDTH: 236,
}));

vi.mock('../contexts/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));

vi.mock('../hooks/useStatusCounts', () => ({
  useStatusCounts: () => mockUseStatusCounts(),
}));

vi.mock('../hooks/useBreakpoint', () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

vi.mock('../hooks/useTenantUnlocks', () => ({
  UNLOCK_ALL: true,
  useTenantUnlocks: () => ({
    unlocks: {},
    isLoading: false,
    isFeatureUnlocked: () => true,
    getFeatureLock: () => null,
  }),
}));

vi.mock('./org/OrgSwitcher', () => ({
  default: () => null,
}));

function SettingsStub() {
  return <h1>Settings page</h1>;
}

function renderSidebar(initialEntry = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="*"
          element={(
            <>
              <OutletSidebar />
              <Routes>
                <Route path="/dashboard" element={<h1>Dashboard</h1>} />
                <Route path="/settings" element={<SettingsStub />} />
              </Routes>
            </>
          )}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('OutletSidebar settings navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIsMobile.mockReturnValue(false);
    mockUseTheme.mockReturnValue({ theme: 'light', toggleTheme: vi.fn() });
    mockUseStatusCounts.mockReturnValue({ data: {} });
    mockUseAuth.mockReturnValue({
      user: {
        _id: 'u1',
        name: 'Test User',
        departmentId: { slug: 'admin', permissionPreset: 'admin', name: 'Admin' },
      },
    });
  });

  it('navigates to /settings when the sidebar Settings control is clicked on desktop', async () => {
    const user = userEvent.setup();
    renderSidebar('/dashboard');

    await user.click(screen.getByRole('link', { name: 'Settings' }));

    expect(await screen.findByRole('heading', { name: 'Settings page' })).toBeInTheDocument();
  });

  it('navigates to /settings when the profile footer link is clicked', async () => {
    const user = userEvent.setup();
    renderSidebar('/dashboard');

    await user.click(screen.getByRole('link', { name: /test user/i }));

    expect(await screen.findByRole('heading', { name: 'Settings page' })).toBeInTheDocument();
  });
});
