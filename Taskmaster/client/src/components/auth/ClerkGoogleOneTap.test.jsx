import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';

const mockGoogleOneTap = vi.fn(() => <div data-testid="google-one-tap" />);

vi.mock('@clerk/react', () => ({
  GoogleOneTap: (props) => mockGoogleOneTap(props),
}));

vi.mock('../../config/clerk', () => ({
  isClerkConfigured: vi.fn(() => true),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: null, loading: false })),
}));

import { isClerkConfigured } from '../../config/clerk';
import { useAuth } from '../../contexts/AuthContext';
import ClerkGoogleOneTap from './ClerkGoogleOneTap';

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ClerkGoogleOneTap />
    </MemoryRouter>,
  );
}

describe('ClerkGoogleOneTap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isClerkConfigured.mockReturnValue(true);
    useAuth.mockReturnValue({ user: null, loading: false });
  });

  it('renders on login route when clerk is configured and user is signed out', () => {
    renderAt('/login');
    expect(screen.getByTestId('google-one-tap')).toBeInTheDocument();
    expect(mockGoogleOneTap).toHaveBeenCalledWith(
      expect.objectContaining({
        forceRedirectUrl: '/dashboard',
        fallbackRedirectUrl: '/dashboard',
      }),
    );
  });

  it('keeps one-tap on /login for auth subdomain builds without force redirect', async () => {
    vi.resetModules();
    import.meta.env.VITE_SITE_MODE = 'auth';
    const mod = await import('./ClerkGoogleOneTap.jsx');
    mockGoogleOneTap.mockClear();
    render(
      <MemoryRouter initialEntries={['/login']}>
        <mod.default />
      </MemoryRouter>,
    );
    expect(mockGoogleOneTap).toHaveBeenCalledWith({});
    import.meta.env.VITE_SITE_MODE = 'app';
    vi.resetModules();
  });

  it('does not render during Clerk client-trust subflow', () => {
    renderAt('/login/client-trust');
    expect(screen.queryByTestId('google-one-tap')).not.toBeInTheDocument();
  });

  it('does not render on protected app routes', () => {
    renderAt('/dashboard');
    expect(screen.queryByTestId('google-one-tap')).not.toBeInTheDocument();
  });

  it('does not render when clerk is not configured', () => {
    isClerkConfigured.mockReturnValue(false);
    renderAt('/login');
    expect(screen.queryByTestId('google-one-tap')).not.toBeInTheDocument();
  });

  it('does not render when coreknot session already exists', () => {
    useAuth.mockReturnValue({ user: { _id: 'u1' }, loading: false });
    renderAt('/login');
    expect(screen.queryByTestId('google-one-tap')).not.toBeInTheDocument();
  });
});
