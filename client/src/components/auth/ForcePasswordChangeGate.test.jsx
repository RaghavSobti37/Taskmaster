import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import ForcePasswordChangeGate from './ForcePasswordChangeGate.jsx';

const mockNavigate = vi.fn();
const mockUseAuth = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderGate(initialEntry = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ForcePasswordChangeGate />
    </MemoryRouter>,
  );
}

describe('ForcePasswordChangeGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders when mustChangePassword is true', () => {
    mockUseAuth.mockReturnValue({ user: { mustChangePassword: true } });
    renderGate('/dashboard');

    expect(screen.getByText('Password change required')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change password' })).toBeInTheDocument();
  });

  it('is hidden on /settings?tab=profile', () => {
    mockUseAuth.mockReturnValue({ user: { mustChangePassword: true } });
    renderGate('/settings?tab=profile');

    expect(screen.queryByText('Password change required')).not.toBeInTheDocument();
  });

  it('is hidden when mustChangePassword is false', () => {
    mockUseAuth.mockReturnValue({ user: { mustChangePassword: false } });
    renderGate('/dashboard');

    expect(screen.queryByText('Password change required')).not.toBeInTheDocument();
  });
});
