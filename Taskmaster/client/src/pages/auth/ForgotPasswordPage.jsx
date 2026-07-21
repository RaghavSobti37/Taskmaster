import React, { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useClerk, useSignIn } from '@clerk/react';
import axios from 'axios';
import { isClerkConfigured } from '../../config/clerk';
import AuthMarketingShell from '../../components/auth/AuthMarketingShell';
import { loginCopy } from '../../constants/marketingContent';

const inputClass = 'w-full rounded-lg border border-teal-800/40 bg-white/95 px-3 py-2.5 text-sm text-slate-950 shadow-sm outline-none transition focus:border-[var(--brand-green)] focus:ring-2 focus:ring-[var(--brand-green)]/25';
const buttonClass = 'w-full rounded-lg bg-[var(--brand-green)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-teal-deep)] disabled:cursor-not-allowed disabled:opacity-60';
const linkClass = 'text-[var(--brand-green)] font-medium hover:text-[var(--brand-teal-deep)] underline-offset-2 hover:underline transition-colors';

function getClerkErrorMessage(err) {
  const first = err?.errors?.[0] || {};
  const message = first.longMessage
    || first.long_message
    || first.message
    || err?.message
    || 'Something went wrong. Please try again.';
  const detail = [
    first.code || err?.code,
    err?.clerk_trace_id ? `trace ${err.clerk_trace_id}` : null,
  ].filter(Boolean).join(' | ');
  return detail ? `${message} (${detail})` : message;
}

function PasswordStrengthMeter({ password }) {
  if (!password) return null;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const score = [hasUpper, hasLower, hasDigit, hasSpecial].filter(Boolean).length;
  const labels = ['Weak', 'Fair', 'Good', 'Strong'];

  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              password.length >= 3 && i <= score
                ? i <= 1 ? 'bg-red-400' : i <= 2 ? 'bg-orange-400' : i <= 3 ? 'bg-yellow-400' : 'bg-green-400'
                : 'bg-white/10'
            }`}
          />
        ))}
      </div>
      {password.length >= 3 && (
        <p className={`text-xs font-medium ${
          score <= 1 ? 'text-red-300' : score === 2 ? 'text-yellow-300' : score === 3 ? 'text-yellow-200' : 'text-green-300'
        }`}
        >
          {labels[score - 1] || ''}
        </p>
      )}
    </div>
  );
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
  const [useServerFallback, setUseServerFallback] = useState(false);
  const [serverToken, setServerToken] = useState('');
  const [serverResetSent, setServerResetSent] = useState(false);

  const needsNewPassword = signIn?.status === 'needs_new_password';
  const busy = submitting || !isLoaded;

  const asideLinks = useMemo(() => (
    <>
      <span className="text-[var(--brand-teal-mid)]">Remember it?</span>
      <Link to="/login" className={linkClass}>Sign in</Link>
    </>
  ), []);

  /** Clerk-powered reset flow (step 1: send code) */
  async function sendCode(event) {
    event.preventDefault();
    if (!isLoaded || !signIn) {
      // Clerk not ready — fall through to server-side
      setUseServerFallback(true);
      return;
    }
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const createResult = await signIn.create({ identifier: emailAddress.trim() });
      if (createResult?.error) throw createResult.error;
      const sendResult = await signIn.resetPasswordEmailCode.sendCode();
      if (sendResult?.error) throw sendResult.error;
      setCodeSent(true);
      setMessage('We sent a password reset code to your email. Check your inbox and spam folder.');
    } catch (err) {
      const clerkErr = getClerkErrorMessage(err);
      // If Clerk can't find the user or the flow fails, offer server-side fallback
      setError(clerkErr);
      setUseServerFallback(true);
    } finally {
      setSubmitting(false);
    }
  }

  /** Clerk-powered reset flow (step 2: verify code) */
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

  /** Clerk-powered reset flow (step 3: submit new password) */
  async function submitNewPassword(event) {
    event.preventDefault();
    if (!isLoaded || !signIn) return;
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
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
      setMessage('Password updated! Redirecting to sign in...');
      setTimeout(() => navigate('/login', { replace: true }), 1500);
    } catch (err) {
      setError(getClerkErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  /** Server-side reset flow: sends password reset email directly */
  async function sendServerResetCode(event) {
    event.preventDefault();
    if (!emailAddress.trim()) {
      setError('Please enter your email address.');
      return;
    }
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const { data } = await axios.post('/api/auth/forgot-password', {
        email: emailAddress.trim(),
      });
      setServerResetSent(true);
      setMessage(data?.message || 'If an account exists with that email, password reset instructions have been sent.');
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Could not send reset email. Please try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthMarketingShell title="Reset password" subtitle={loginCopy.subtitle} asideLinks={asideLinks}>
      <div className="space-y-4">
        <div className="text-center">
          <p className="text-sm text-teal-100/90">
            {serverResetSent
              ? 'Check your email for a password reset link.'
              : useServerFallback
                ? 'Enter your email to receive password reset instructions by email.'
                : 'Enter your account email to receive a reset code, then set a new password.'
            }
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

        {/* Server-side: reset sent confirmation */}
        {serverResetSent ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-teal-100/80">
              The email may take a few minutes to arrive. Check your spam folder if you don&apos;t see it.
            </p>
            <Link to="/login" className={`${buttonClass} inline-block w-auto px-6 no-underline`}>
              Back to sign in
            </Link>
          </div>
        ) : null}

        {/* Clerk flow: Step 1 — Send code */}
        {!codeSent && !serverResetSent && !useServerFallback ? (
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
              placeholder="you@example.com"
            />
            <button className={buttonClass} type="submit" disabled={busy || !emailAddress.trim()}>
              {!isLoaded ? 'Loading auth...' : submitting ? 'Sending code...' : 'Send reset code'}
            </button>
          </form>
        ) : null}

        {/* Server fallback: Send email directly */}
        {!codeSent && !serverResetSent && useServerFallback ? (
          <form className="space-y-3" onSubmit={sendServerResetCode}>
            <label className="block text-sm font-medium text-teal-50" htmlFor="svr-reset-email">
              Email address
            </label>
            <input
              id="svr-reset-email"
              className={inputClass}
              type="email"
              autoComplete="email"
              value={emailAddress}
              onChange={(event) => setEmailAddress(event.target.value)}
              required
              placeholder="you@example.com"
            />
            <p className="text-xs text-teal-100/60">
              You&apos;ll receive an email with a link to reset your password.
            </p>
            <button className={buttonClass} type="submit" disabled={submitting || !emailAddress.trim()}>
              {submitting ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
        ) : null}

        {/* Clerk flow: Step 2 — Verify code */}
        {codeSent && !needsNewPassword && !serverResetSent ? (
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
              placeholder="Enter 6-digit code"
            />
            <button className={buttonClass} type="submit" disabled={busy || !code.trim()}>
              {busy ? 'Verifying...' : 'Verify code'}
            </button>
          </form>
        ) : null}

        {/* Clerk flow: Step 3 — Set new password */}
        {needsNewPassword && !serverResetSent ? (
          <form className="space-y-3" onSubmit={submitNewPassword}>
            <div>
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
                minLength={8}
                placeholder="Min. 8 characters"
              />
              <PasswordStrengthMeter password={password} />
            </div>
            <div>
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
                minLength={8}
              />
              {confirmPassword && password !== confirmPassword ? (
                <p className="mt-1 text-xs text-red-300">Passwords do not match</p>
              ) : null}
            </div>
            <button className={buttonClass} type="submit" disabled={busy || !password || !confirmPassword}>
              {busy ? 'Updating password...' : 'Update password'}
            </button>
          </form>
        ) : null}

        {/* Switch between Clerk and server flow */}
        {!codeSent && !serverResetSent ? (
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => {
                setUseServerFallback((prev) => !prev);
                setError('');
              }}
              className="text-xs text-teal-100/60 hover:text-teal-100 underline-offset-2 hover:underline transition-colors"
            >
              {useServerFallback ? 'Try using Clerk reset code instead' : 'Having trouble? Use email link instead'}
            </button>
          </div>
        ) : null}
      </div>
    </AuthMarketingShell>
  );
}
