import React, { useState } from 'react';
import { Lock, Mail, ArrowRight, Eye, EyeOff, AlertCircle, RefreshCw, Smartphone } from 'lucide-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from "../../contexts/AuthContext";
import MarketingPageBackground from '../../components/MarketingPageBackground';
import BrandLogo from '../../components/brand/BrandLogo';
import AppBootFallback from '../../components/AppBootFallback';
import { AXIOS_SKIP_TOAST } from '../../lib/notifications';
import { apiPath } from '../../utils/apiBase';
import { markForceLogout } from '../../utils/authSession';
import { consumeAuthReturnPath } from '../../lib/authUnauthorized';
import { resolveLoginReturnPath } from '../../utils/loginReturnPath';
import { navigateAfterAuth } from '../../utils/authNavigation';

const LoginPage = () => {
import { postLogin } from '../../utils/loginRequest';
import InstallGuideModal from '../../components/auth/InstallGuideModal';
import { detectInstallPlatform } from '../../utils/installPlatform';
import { brand, loginCopy } from '../../constants/marketingContent';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [clearingCookies, setClearingCookies] = useState(false);
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const installPlatform = React.useMemo(() => detectInstallPlatform(), [installGuideOpen]);

  const resolveReturnPath = React.useCallback(
    () => resolveLoginReturnPath({
      stateFrom: location.state?.from,
      search: location.search,
      storedReturnPath: consumeAuthReturnPath(),
    }),
    [location.state, location.search]
  );

  React.useEffect(() => {
    if (!authLoading && user) {
      navigateAfterAuth(navigate, resolveReturnPath());
    }
  }, [authLoading, user, navigate, resolveReturnPath]);

  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const errorParam = params.get('error');
    if (errorParam === 'unauthorized_domain') {
      setError('Unauthorized domain. Only @theshakticollective.in accounts are allowed.');
    } else if (errorParam === 'auth_failed') {
      setError('Google Authentication failed. Please try again.');
    }
  }, [location]);

  if (authLoading) {
    return <AppBootFallback />;
  }

  const handleGoogleLogin = () => {
    window.location.href = apiPath('/api/auth/google');
  };

  const handleClearCookies = async () => {
    setClearingCookies(true);
    setError('');
    markForceLogout();
    try {
      await axios.post(apiPath('/api/auth/logout'), null, { ...AXIOS_SKIP_TOAST, withCredentials: true });
    } catch {
      // HttpOnly cookies are cleared server-side when logout succeeds
    }
    window.location.reload();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const trimmedEmail = email.trim();
    try {
      await postLogin(trimmedEmail, password);
      await login();
      navigateAfterAuth(navigate, resolveReturnPath());
    } catch (err) {
      setError(formatLoginError(err).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tm-marketing-page min-h-screen bg-background text-foreground relative overflow-x-hidden overflow-y-auto grid place-items-center p-4 sm:p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <MarketingPageBackground inkClassName="opacity-40 mix-blend-multiply dark:mix-blend-screen dark:opacity-20" />
      <div className="tm-modal-panel tm-modal-sm max-w-md relative z-10 bg-card p-6 sm:p-8 rounded-3xl border border-border shadow-xl animate-in fade-in zoom-in-95 duration-300">
        <div className="text-center mb-6">
          <BrandLogo size={64} className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{brand.name}</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-3 px-1 leading-relaxed font-medium">
            {loginCopy.subtitle}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl font-medium animate-pulse flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="mb-4 p-3 bg-amber-50 border border-amber-100 text-amber-900 text-sm rounded-xl">
          <p className="font-medium mb-2">Having trouble signing in?</p>
          <p className="text-xs text-amber-800/90 mb-3 leading-relaxed">
            Clear old session cookies if login fails after an update or you see a stale session.
          </p>
          <button
            type="button"
            onClick={handleClearCookies}
            disabled={clearingCookies}
            className="w-full min-h-[40px] bg-amber-100 text-amber-950 py-2.5 rounded-lg font-semibold border border-amber-200 hover:bg-amber-200 disabled:opacity-60 transition-all flex items-center justify-center gap-2 touch-manipulation"
          >
            <RefreshCw size={16} className={clearingCookies ? 'animate-spin' : ''} />
            {clearingCookies ? 'Clearing cookies...' : 'Clear session cookies'}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--color-text-secondary)] ml-1">Email or Username</label>
            <div className="relative">
              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="text"
                required
                autoComplete="username"
                enterKeyHint="next"
                className="w-full pl-12 pr-4 py-3 text-base bg-background border border-border rounded-xl text-foreground focus:ring-2 focus:ring-[var(--color-brand-teal)] focus:border-transparent outline-none transition-all placeholder:text-[var(--color-text-muted)]/50 touch-manipulation"
                placeholder="Email, Phone, or Name"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between ml-1 mr-1">
              <label className="text-sm font-semibold text-[var(--color-text-secondary)]">Password</label>
              <Link to="/forgot-password" className="text-xs font-semibold text-[var(--color-brand-teal)] hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                enterKeyHint="go"
                className="w-full pl-12 pr-12 py-3 text-base bg-background border border-border rounded-xl text-foreground focus:ring-2 focus:ring-[var(--color-brand-teal)] focus:border-transparent outline-none transition-all placeholder:text-[var(--color-text-muted)]/50 touch-manipulation"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-brand-teal)] transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[48px] bg-[var(--color-brand-teal)] text-[var(--color-brand-cream)] py-4 rounded-xl font-bold hover:bg-[var(--color-action-hover)] active:bg-[var(--color-action-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-[var(--color-brand-teal)]/20 touch-manipulation"
          >
            {loading ? 'Signing in...' : 'Sign In'} <ArrowRight size={20} />
          </button>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-[var(--color-text-muted)] font-medium">Or continue with</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full min-h-[48px] bg-white text-gray-700 py-3 rounded-xl font-semibold border border-gray-200 hover:bg-gray-50 transition-all flex items-center justify-center gap-2 shadow-sm touch-manipulation"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12.16-4.53z"
              />
            </svg>
            Sign in with Google
          </button>
        </form>

        <div className="mt-4 text-center text-sm space-y-3">
          <button
            type="button"
            onClick={() => setInstallGuideOpen(true)}
            className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-brand-teal)]/30 bg-[var(--color-brand-teal)]/5 px-4 py-2.5 text-sm font-semibold text-[var(--color-brand-teal)] hover:bg-[var(--color-brand-teal)]/10 transition-colors touch-manipulation"
          >
            <Smartphone size={16} />
            {installPlatform.installed ? loginCopy.installCtaInstalled : loginCopy.installCta}
          </button>
          <div className="flex items-center justify-center gap-2 text-[var(--color-text-muted)] font-medium">
            <span>New user?</span>
            <Link to="/register" className="text-[var(--color-brand-teal)] font-bold hover:underline inline-block">Register here</Link>
          </div>
          <div className="pt-3 border-t border-border flex items-center justify-center gap-4 text-xs text-[var(--color-text-muted)] font-medium">
            <Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link>
            <span>•</span>
            <Link to="/userdata" className="hover:text-foreground">User Data Deletion</Link>
          </div>
        </div>
      </div>
      <InstallGuideModal isOpen={installGuideOpen} onClose={() => setInstallGuideOpen(false)} />
    </div>
  );
};

export default LoginPage;
