import React, { useState, useEffect, useMemo } from 'react';
import { Link, Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { isClerkConfigured } from '../../config/clerk';
import AuthMarketingShell from '../../components/auth/AuthMarketingShell';
import { loginCopy } from '../../constants/marketingContent';
import { validatePasswordStrength as checkPasswordStrength } from '../../utils/passwordValidation';

const inputClass = 'w-full rounded-lg border border-teal-800/40 bg-white/95 px-3 py-2.5 text-sm text-slate-950 shadow-sm outline-none transition focus:border-[var(--brand-green)] focus:ring-2 focus:ring-[var(--brand-green)]/25';
const buttonClass = 'w-full rounded-lg bg-[var(--brand-green)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-teal-deep)] disabled:cursor-not-allowed disabled:opacity-60';
const linkClass = 'text-[var(--brand-green)] font-medium hover:text-[var(--brand-teal-deep)] underline-offset-2 hover:underline transition-colors';

function PasswordStrengthMeter({ password }) {
  if (!password) return null;
  const strength = checkPasswordStrength(password);
  const score = strength === true ? 4 : strength === 'Password must be at least 8 characters' ? 1 : strength ? 2 : 4;
  const labels = ['Weak', 'Fair', 'Good', 'Strong'];
  const currentLabel = labels[Math.min(Math.max(score, 1), 4) - 1] || '';

  return (
    <div className="mt-1 space-y-1">
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
        <p className={`text-xs font-medium ${score >= 3 ? 'text-green-300' : score >= 2 ? 'text-yellow-300' : 'text-red-300'}`}>
          {typeof strength === 'string' ? strength : currentLabel}
        </p>
      )}
    </div>
  );
}

/**
 * Handles server-side password reset via the token from the email link.
 * The server sends: /reset-password?token=xxx which this page reads and uses.
 */
export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tokenValid, setTokenValid] = useState(null);

  // Validate token exists on mount
  useEffect(() => {
    if (!token) {
      setTokenValid(false);
      return;
    }
    setTokenValid(true);
  }, [token]);

  const asideLinks = useMemo(() => (
    <>
      <span className="text-[var(--brand-teal-mid)]">Remember your password?</span>
      <Link to="/login" className={linkClass}>Sign in</Link>
      <span className="text-[var(--brand-teal-mid)]/40" aria-hidden>·</span>
      <Link to="/forgot-password" className={linkClass}>Request new code</Link>
    </>
  ), []);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!token) return;

    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const strength = checkPasswordStrength(password);
    if (typeof strength === 'string') {
      setError(strength);
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const { data } = await axios.post('/api/auth/reset-password', {
        token,
        newPassword: password,
        confirmPassword,
      });
      setSuccess(data?.message || 'Password updated successfully. Redirecting to sign in...');
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2500);
    } catch (err) {
      const message = err?.response?.data?.error
        || err?.message
        || 'Failed to reset password. The link may have expired.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  // No token — show error with link to forgot-password
  if (tokenValid === false) {
    return (
      <AuthMarketingShell title="Invalid reset link" subtitle={loginCopy.subtitle} asideLinks={asideLinks}>
        <div className="rounded-lg border border-red-400/40 bg-red-950/40 px-4 py-6 text-center">
          <p className="text-sm text-red-100">
            This password reset link is missing or invalid.
          </p>
          <p className="mt-2 text-sm text-red-100/80">
            Please request a new password reset code below.
          </p>
          <Link
            to="/forgot-password"
            className={`${buttonClass} mt-4 inline-block w-auto px-6 no-underline`}
          >
            Request new code
          </Link>
        </div>
      </AuthMarketingShell>
    );
  }

  // Initial loading state
  if (tokenValid === null) {
    return (
      <AuthMarketingShell title="Reset password" subtitle={loginCopy.subtitle} asideLinks={asideLinks}>
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--brand-green)] border-t-transparent" />
        </div>
      </AuthMarketingShell>
    );
  }

  return (
    <AuthMarketingShell title="Set new password" subtitle={loginCopy.subtitle} asideLinks={asideLinks}>
      <div className="space-y-4">
        <div className="text-center">
          <p className="text-sm text-teal-100/90">
            Choose a new password for your account.
          </p>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-400/40 bg-red-950/40 px-4 py-3 text-sm text-red-100" role="alert">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="rounded-lg border border-teal-400/30 bg-teal-950/30 px-4 py-3 text-sm text-teal-50" role="status">
            {success}
          </div>
        ) : null}

        {!success ? (
          <form className="space-y-3" onSubmit={handleSubmit}>
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
            <button className={buttonClass} type="submit" disabled={submitting || !password || !confirmPassword}>
              {submitting ? 'Updating password...' : 'Update password'}
            </button>
          </form>
        ) : null}
      </div>
    </AuthMarketingShell>
  );
}
