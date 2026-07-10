import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth as useClerkAuth } from '@clerk/react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import AppBootError from '../../components/AppBootError';
import BootScreen from '../../components/BootScreen';
import AuthMarketingShell from '../../components/auth/AuthMarketingShell';
import ClearSessionCookiesButton from '../../components/auth/ClearSessionCookiesButton';
import { Button, Input } from '../../components/ui';
import { isClerkConfigured } from '../../config/clerk';
import { registerCopy } from '../../constants/marketingContent';
import { resolveLoginReturnPath } from '../../utils/loginReturnPath';
import { subscribeClerkEstablishError } from '../../lib/clerkEstablishRegistry';
import { computeLoginUiState } from '../../lib/clerkSignInFlow';
import { navigateOnce, resetNavigateGuard } from '../../lib/postLoginRedirect';

const linkClass =
  'text-[var(--brand-green)] font-medium hover:text-[var(--brand-teal-deep)] underline-offset-2 hover:underline transition-colors';

export default function RegisterPage() {
  if (!isClerkConfigured()) {
    return <RegisterPageView clerkLoaded clerkSignedIn={false} clerkSessionId={null} pathname="/register" />;
  }
  return <RegisterPageWithClerk />;
}

function RegisterPageWithClerk() {
  const { isLoaded: clerkLoaded, isSignedIn: clerkSignedIn, sessionId: clerkSessionId } = useClerkAuth();
  const location = useLocation();
  return (
    <RegisterPageView
      clerkLoaded={clerkLoaded}
      clerkSignedIn={clerkSignedIn}
      clerkSessionId={clerkSessionId}
      pathname={location.pathname}
    />
  );
}

function RegisterPageView({
  clerkLoaded,
  clerkSignedIn,
  clerkSessionId = null,
  pathname = '/register',
}) {
  const { user, loading: authLoading, sessionReady, bootError, retryBoot } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const navigatedRef = useRef(false);
  const [establishError, setEstablishError] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pending, setPending] = useState(false);
  const clerkReady = isClerkConfigured();

  const uiState = computeLoginUiState({
    clerkReady,
    clerkLoaded,
    clerkSignedIn,
    clerkSessionId,
    pathname,
    authLoading,
    user,
    sessionReady,
    establishError,
    bootError,
  });

  useEffect(() => {
    resetNavigateGuard();
  }, []);

  useEffect(() => subscribeClerkEstablishError(setEstablishError), []);

  useEffect(() => {
    if (uiState !== 'REDIRECTING') {
      navigatedRef.current = false;
      return;
    }
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    const target = resolveLoginReturnPath({
      stateFrom: location.state?.from,
      search: location.search,
    });
    navigateOnce(navigate, target);
  }, [uiState, navigate, location.state, location.search]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setPending(true);
    try {
      const { data } = await axios.post('/api/auth/access-request', {
        email: form.email.trim(),
        name: form.name.trim() || undefined,
        message: form.message.trim() || undefined,
      });
      setSuccess(data?.message || registerCopy.successMessage || 'Request sent.');
      setForm({ name: '', email: '', message: '' });
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Could not send request.');
    } finally {
      setPending(false);
    }
  };

  if (uiState === 'BOOT_ERROR') {
    return (
      <>
        <AppBootError bootError={bootError} onRefresh={() => retryBoot()} />
        <ClearSessionCookiesButton bootError stuckLogin className="mt-4" />
      </>
    );
  }

  if (uiState === 'BOOT_LOADING' || uiState === 'ESTABLISHING' || uiState === 'REDIRECTING') {
    return <BootScreen onRefresh={() => retryBoot()} />;
  }

  const asideLinks = (
    <>
      <span className="text-[var(--brand-teal-mid)]">{registerCopy.signInPrompt}</span>
      <Link to="/login" className={linkClass}>
        {registerCopy.signInLink}
      </Link>
    </>
  );

  return (
    <AuthMarketingShell
      title={registerCopy.title}
      subtitle={registerCopy.subtitle}
      asideLinks={asideLinks}
    >
      <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto space-y-4">
        {error ? (
          <p className="text-sm text-red-200 text-center" role="alert">{error}</p>
        ) : null}
        {success ? (
          <p className="text-sm text-emerald-100 text-center" role="status">{success}</p>
        ) : null}

        <Input
          label="Work email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
          autoComplete="email"
        />
        <Input
          label="Full name (optional)"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          autoComplete="name"
        />
        <div className="space-y-1">
          <label
            htmlFor="access-request-message"
            className="block tm-section-label"
          >
            Note for admin (optional)
          </label>
          <textarea
            id="access-request-message"
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 bg-white/10 border border-white/15 rounded-[var(--radius-atomic)] text-sm text-emerald-50 outline-none resize-y"
            placeholder="Team, role, or why you need access"
          />
        </div>
        <p className="tm-auth-hint text-xs text-center leading-relaxed">
          {registerCopy.closedSystemNote}
        </p>
        <Button type="submit" className="w-full" disabled={pending || !form.email.trim()}>
          {pending ? 'Sending…' : registerCopy.submitLabel}
        </Button>
      </form>
    </AuthMarketingShell>
  );
}
