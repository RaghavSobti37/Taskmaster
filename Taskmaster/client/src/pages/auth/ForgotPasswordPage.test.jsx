import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';

const mockCreate = vi.fn();
const mockSendCode = vi.fn();
const mockVerifyCode = vi.fn();
const mockSubmitPassword = vi.fn();
const mockSetActive = vi.fn();
const mockUseSignIn = vi.fn();

const signInState = {
  status: 'needs_identifier',
  createdSessionId: null,
  create: mockCreate,
  resetPasswordEmailCode: {
    sendCode: mockSendCode,
    verifyCode: mockVerifyCode,
    submitPassword: mockSubmitPassword,
  },
};

vi.mock('@clerk/react', () => ({
  useClerk: () => ({ setActive: mockSetActive }),
  useSignIn: () => mockUseSignIn(),
}));

vi.mock('../../config/clerk', () => ({
  isClerkConfigured: vi.fn(() => true),
}));

vi.mock('../../components/auth/AuthMarketingShell', () => ({
  default: ({ title, children, asideLinks }) => (
    <main>
      <h1>{title}</h1>
      <div>{asideLinks}</div>
      {children}
    </main>
  ),
}));

import ForgotPasswordPage from './ForgotPasswordPage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/forgot-password']}>
      <ForgotPasswordPage />
    </MemoryRouter>,
  );
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signInState.status = 'needs_identifier';
    signInState.createdSessionId = null;
    mockCreate.mockResolvedValue({});
    mockSendCode.mockResolvedValue({});
    mockVerifyCode.mockResolvedValue({});
    mockSubmitPassword.mockResolvedValue({});
    mockSetActive.mockResolvedValue(undefined);
    mockUseSignIn.mockReturnValue({
      isLoaded: true,
      signIn: signInState,
      setActive: mockSetActive,
    });
  });

  it('sends a reset code through Clerk', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/email address/i), 'person@example.com');
    await user.click(screen.getByRole('button', { name: /send reset code/i }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({ identifier: 'person@example.com' });
      expect(mockSendCode).toHaveBeenCalled();
    });
    expect(await screen.findByText(/we sent a password reset code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/reset code/i)).toBeInTheDocument();
  });

  it('supports Clerk signal-style sign-in state without isLoaded', async () => {
    const user = userEvent.setup();
    mockUseSignIn.mockReturnValue({
      signIn: signInState,
    });
    renderPage();

    await user.type(screen.getByLabelText(/email address/i), 'person@example.com');
    expect(screen.getByRole('button', { name: /send reset code/i })).toBeEnabled();
  });

  it('verifies the reset code', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/email address/i), 'person@example.com');
    await user.click(screen.getByRole('button', { name: /send reset code/i }));
    await user.type(await screen.findByLabelText(/reset code/i), '123456');
    await user.click(screen.getByRole('button', { name: /verify code/i }));

    await waitFor(() => {
      expect(mockVerifyCode).toHaveBeenCalledWith({ code: '123456' });
    });
  });

  it('requires matching passwords before submitting a new password', async () => {
    const user = userEvent.setup();
    signInState.status = 'needs_new_password';
    renderPage();

    await user.type(screen.getByLabelText(/^new password$/i), 'New-password-1');
    await user.type(screen.getByLabelText(/confirm password/i), 'Different-password-1');
    await user.click(screen.getByRole('button', { name: /update password/i }));

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
    expect(mockSubmitPassword).not.toHaveBeenCalled();
  });

  it('updates the password and activates the Clerk session', async () => {
    const user = userEvent.setup();
    signInState.status = 'needs_new_password';
    signInState.createdSessionId = 'sess_reset';
    mockSubmitPassword.mockResolvedValue({ createdSessionId: 'sess_reset' });
    renderPage();

    await user.type(screen.getByLabelText(/^new password$/i), 'New-password-1');
    await user.type(screen.getByLabelText(/confirm password/i), 'New-password-1');
    await user.click(screen.getByRole('button', { name: /update password/i }));

    await waitFor(() => {
      expect(mockSubmitPassword).toHaveBeenCalledWith({
        password: 'New-password-1',
        signOutOfOtherSessions: true,
      });
      expect(mockSetActive).toHaveBeenCalledWith({ session: 'sess_reset' });
    });
  });
});
