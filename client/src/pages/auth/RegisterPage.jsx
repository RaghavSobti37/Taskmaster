import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import AuthMarketingShell from '../../components/auth/AuthMarketingShell';
import { Button, Input } from '../../components/ui';
import { registerCopy } from '../../constants/marketingContent';
import { AXIOS_SKIP_TOAST } from '../../lib/notifications';

const linkClass =
  'text-[var(--brand-green)] font-medium hover:text-[var(--brand-teal-deep)] underline-offset-2 hover:underline transition-colors';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setPending(true);
    try {
      const res = await axios.post(
        '/api/auth/access-request',
        {
          name: form.name.trim() || undefined,
          email: form.email.trim(),
          message: form.message.trim() || undefined,
        },
        AXIOS_SKIP_TOAST,
      );
      setSuccess(res.data?.message || registerCopy.successMessage);
      setForm({ name: '', email: '', message: '' });
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Could not send access request');
    } finally {
      setPending(false);
    }
  };

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
            className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block"
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
        <p className="text-xs text-[var(--brand-teal-mid)] text-center leading-relaxed">
          {registerCopy.closedSystemNote}
        </p>
        <Button type="submit" className="w-full" disabled={pending || !form.email.trim()}>
          {pending ? 'Sending…' : registerCopy.submitLabel}
        </Button>
      </form>
    </AuthMarketingShell>
  );
}
