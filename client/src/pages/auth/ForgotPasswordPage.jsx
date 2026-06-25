import React, { useState } from 'react';
import { Mail, ArrowRight, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { AXIOS_SKIP_TOAST } from '../../lib/notifications';
import MarketingPageBackground from '../../components/MarketingPageBackground';
import BrandLogo from '../../components/brand/BrandLogo';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/forgot-password', { email }, AXIOS_SKIP_TOAST);
      setSuccess(res.data?.message || 'If an account exists with that email, password reset instructions have been sent.');
      setEmail('');
    } catch (err) {
      setError(
        err.response?.data?.error ||
          (err.response?.status === 429
            ? 'Too many reset requests. Please try again later.'
            : 'Could not process your request. Please try again.')
      );
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Reset password</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-3 px-1 leading-relaxed font-medium">
            Enter your account email and we&apos;ll send you a link to choose a new password.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl font-medium flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm rounded-xl font-medium flex items-start gap-2">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--color-text-secondary)] ml-1">Email address</label>
            <div className="relative">
              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="email"
                required
                autoComplete="email"
                enterKeyHint="send"
                className="w-full pl-12 pr-4 py-3 text-base bg-background border border-border rounded-xl text-foreground focus:ring-2 focus:ring-[var(--color-brand-teal)] focus:border-transparent outline-none transition-all placeholder:text-[var(--color-text-muted)]/50 touch-manipulation"
                placeholder="you@theshakticollective.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[48px] bg-[var(--color-brand-teal)] text-[var(--color-brand-cream)] py-4 rounded-xl font-bold hover:bg-[var(--color-action-hover)] active:bg-[var(--color-action-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-[var(--color-brand-teal)]/20 touch-manipulation"
          >
            {loading ? 'Sending…' : 'Send reset link'} <ArrowRight size={20} />
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-brand-teal)] hover:underline"
          >
            <ArrowLeft size={16} />
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
