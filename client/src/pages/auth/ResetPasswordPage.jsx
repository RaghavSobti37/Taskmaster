import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, ArrowRight, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowLeft, KeyRound } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import PasswordRequirements from '../../components/auth/PasswordRequirements';
import { validatePasswordStrength } from '../../utils/passwordValidation';
import { AXIOS_SKIP_TOAST } from '../../lib/notifications';

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const passwordToggle = (visible, setVisible) => (
    <button
      type="button"
      onClick={() => setVisible((v) => !v)}
      className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-brand-teal)] transition-colors focus:outline-none"
      aria-label={visible ? 'Hide password' : 'Show password'}
    >
      {visible ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!token) {
      setError('Invalid reset link. Please request a new password reset email.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const validationError = validatePasswordStrength(newPassword);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(
        '/api/auth/reset-password',
        { token, newPassword, confirmPassword },
        AXIOS_SKIP_TOAST
      );
      setSuccess(res.data?.message || 'Password updated successfully.');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          (err.response?.status === 429
            ? 'Too many attempts. Please try again later.'
            : 'Could not reset password. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tm-marketing-page min-h-screen bg-background text-foreground relative overflow-x-hidden overflow-y-auto grid place-items-center p-4 sm:p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="absolute inset-0 z-0 pointer-events-none bg-[url('/ink_spill_bg.png')] bg-cover bg-center opacity-40 mix-blend-multiply dark:mix-blend-screen dark:opacity-20" />
      <div className="absolute inset-0 z-0 pointer-events-none bg-[url('/patterns/pattern_0.png')] bg-repeat opacity-5 mix-blend-overlay" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="tm-modal-panel tm-modal-sm max-w-md relative z-10 bg-card backdrop-blur-md p-6 sm:p-8 rounded-3xl border border-border shadow-xl"
      >
        <div className="text-center mb-6">
          <img src="/favicon.png" alt="Coreknot Logo" className="w-16 h-16 rounded-2xl mx-auto shadow-lg shadow-[var(--color-action-primary)]/25 object-cover mb-4" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Choose a new password</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-3 px-1 leading-relaxed font-medium">
            Enter and confirm your new password below.
          </p>
        </div>

        {!token && (
          <div className="mb-4 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl font-medium flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>
              This reset link is invalid.{' '}
              <Link to="/forgot-password" className="underline font-bold">
                Request a new one
              </Link>
              .
            </span>
          </div>
        )}

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
          <div className="p-3 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)]">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-2 flex items-center gap-1.5">
              <KeyRound size={12} /> Password requirements
            </p>
            <PasswordRequirements password={newPassword} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--color-text-secondary)] ml-1">New password</label>
            <div className="relative">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type={showNewPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                disabled={!token || !!success}
                className="w-full pl-12 pr-12 py-3 text-base bg-background border border-border rounded-xl text-foreground focus:ring-2 focus:ring-[var(--color-brand-teal)] focus:border-transparent outline-none transition-all placeholder:text-[var(--color-text-muted)]/50 touch-manipulation disabled:opacity-60"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              {passwordToggle(showNewPassword, setShowNewPassword)}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--color-text-secondary)] ml-1">Confirm new password</label>
            <div className="relative">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                disabled={!token || !!success}
                className="w-full pl-12 pr-12 py-3 text-base bg-background border border-border rounded-xl text-foreground focus:ring-2 focus:ring-[var(--color-brand-teal)] focus:border-transparent outline-none transition-all placeholder:text-[var(--color-text-muted)]/50 touch-manipulation disabled:opacity-60"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {passwordToggle(showConfirmPassword, setShowConfirmPassword)}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !token || !!success}
            className="w-full min-h-[48px] bg-[var(--color-brand-teal)] text-[var(--color-brand-cream)] py-4 rounded-xl font-bold hover:bg-[var(--color-action-hover)] active:bg-[var(--color-action-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-[var(--color-brand-teal)]/20 touch-manipulation"
          >
            {loading ? 'Saving…' : 'Save new password'} <ArrowRight size={20} />
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
      </motion.div>
    </div>
  );
};

export default ResetPasswordPage;
