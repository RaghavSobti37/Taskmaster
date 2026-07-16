import React, { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useClerk, useSignIn } from '@clerk/react';
import { isClerkConfigured } from '../../config/clerk';
import AuthMarketingShell from '../../components/auth/AuthMarketingShell';
import { loginCopy } from '../../constants/marketingContent';

const inputClass = 'w-full rounded-lg border border-teal-800/40 bg-white/95 px-3 py-2.5 text-sm text-slate-950 shadow-sm outline-none transition focus:border-[var(--brand-green)] focus:ring-2 focus:ring-[var(--brand-green)]/25';
const buttonClass = 'w-full rounded-lg bg-[var(--brand-green)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-teal-deep)] disabled:cursor-not-allowed disabled:opacity-60';
const linkClass = 'text-[var(--brand-green)] font-medium hover:text-[var(--brand-teal-deep)] underline-offset-2 hover:underline transition-colors';

function getClerkErrorMessage(err) {
  return err?.errors?.[0]?.longMessage
    || err?.errors?.[0]?.message
    || err?.message
    || 'Something went wrong. Please try again.';
}

export default function ForgotPasswordPage() {
  if (!isClerkConfigured()) {
    return <Navigate to="/login" replace />;
  }
  return <ForgotPasswordWithClerk />;
}

function ForgotPasswordWithClerk() {
  const navigate = useNavigate();
  const clerk = useClerk();
  const signInState = useSignIn();
  const { signIn } = signInState;
  const isLoaded = typeof signInState.isLoaded === 'boolean'
    ? signInState.isLoaded
    : Boolean(signIn);
  const setActive = signInState.setActive || clerk.setActive;
  const [emailAddress, setEmailAddress] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const needsNewPassword = signIn?.status === 'needs_new_password';
  const busy = submitting || !isLoaded;

  const asideLinks = useMemo(() => (
    <>
      <span className="text-[var(--brand-teal-mid)]">Remember it?</span>
      <Link to="/login" className={linkClass}>Sign in</Link>
    </>
  ), []);

  async function sendCode(event) {
    event.preventDefault();
    if (!isLoaded || !signIn) return;
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const createResult = await signIn.create({ identifier: emailAddress.trim() });
      if (createResult?.error) throw createResult.error;
      const sendResult = await signIn.resetPasswordEmailCode.sendCode();
      if (sendResult?.error) throw sendResult.error;
      setCodeSent(true);
      setMessage('We sent a password reset code to your email.');
    } catch (err) {
      setError(getClerkErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyCode(event) {
    event.preventDefault();
    if (!isLoaded || !signIn) return;
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const result = await signIn.resetPasswordEmailCode.verifyCode({ code: code.trim() });
      if (result?.error) throw result.error;
      setMessage('Code verified. Choose a new password.');
    } catch (err) {
      setError(getClerkErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitNewPassword(event) {
    event.preventDefault();
    if (!isLoaded || !signIn) return;
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const result = await signIn.resetPasswordEmailCode.submitPassword({
        password,
        signOutOfOtherSessions: true,
      });
      if (result?.error) throw result.error;
      const createdSessionId = result?.createdSessionId || signIn.createdSessionId;
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      }
      navigate('/login', { replace: true });
    } catch (err) {
      setError(getClerkErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthMarketingShell title="Reset password" subtitle={loginCopy.subtitle} asideLinks={asideLinks}>
      <div className="space-y-4">
        <div className="text-center">
          <p className="text-sm text-teal-100/90">
            Enter your account email. Clerk will send a reset code, then you can set a new password.
          </p>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-400/40 bg-red-950/40 px-4 py-3 text-sm text-red-100" role="alert">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="rounded-lg border border-teal-400/30 bg-teal-950/30 px-4 py-3 text-sm text-teal-50" role="status">
            {message}
          </div>
        ) : null}

        {!codeSent ? (
          <form className="space-y-3" onSubmit={sendCode}>
            <label className="block text-sm font-medium text-teal-50" htmlFor="reset-email">
              Email address
            </label>
            <input
              id="reset-email"
              className={inputClass}
              type="email"
              autoComplete="email"
              value={emailAddress}
              onChange={(event) => setEmailAddress(event.target.value)}
              required
            />
            <button className={buttonClass} type="submit" disabled={busy || !emailAddress.trim()}>
              {!isLoaded ? 'Loading auth...' : submitting ? 'Sending code...' : 'Send reset code'}
            </button>
          </form>
        ) : null}

        {codeSent && !needsNewPassword ? (
          <form className="space-y-3" onSubmit={verifyCode}>
            <label className="block text-sm font-medium text-teal-50" htmlFor="reset-code">
              Reset code
            </label>
            <input
              id="reset-code"
              className={inputClass}
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
            />
            <button className={buttonClass} type="submit" disabled={busy || !code.trim()}>
              {busy ? 'Verifying...' : 'Verify code'}
            </button>
          </form>
        ) : null}

        {needsNewPassword ? (
          <form className="space-y-3" onSubmit={submitNewPassword}>
            <label className="block text-sm font-medium text-teal-50" htmlFor="new-password">
              New password
            </label>
            <input
              id="new-password"
              className={inputClass}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <label className="block text-sm font-medium text-teal-50" htmlFor="confirm-password">
              Confirm password
            </label>
            <input
              id="confirm-password"
              className={inputClass}
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
            <button className={buttonClass} type="submit" disabled={busy || !password || !confirmPassword}>
              {busy ? 'Updating password...' : 'Update password'}
            </button>
          </form>
        ) : null}
      </div>
    </AuthMarketingShell>
  );
}
