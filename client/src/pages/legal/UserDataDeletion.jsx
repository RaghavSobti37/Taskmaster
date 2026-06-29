import React, { useState, useEffect } from 'react';
import { Trash2, AlertTriangle, CheckCircle, ArrowLeft, ExternalLink, Shield } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import BrandLogo from '../../components/brand/BrandLogo';
import MarketingPageBackground from '../../components/MarketingPageBackground';
import MarketingThemeToggle from '../../components/MarketingThemeToggle';
import { brand, footer } from '../../constants/marketingContent';

export default function UserDataDeletion() {
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [platform, setPlatform] = useState('all');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [metaDeletionStatus, setMetaDeletionStatus] = useState(null);
  const [metaStatusLoading, setMetaStatusLoading] = useState(false);

  useEffect(() => {
    const code = new URLSearchParams(location.search).get('code');
    if (!code) return;

    setMetaStatusLoading(true);
    axios.get(`/api/webhooks/meta-data-deletion/${encodeURIComponent(code)}`)
      .then((res) => setMetaDeletionStatus(res.data))
      .catch(() => setMetaDeletionStatus({ status: 'not_found' }))
      .finally(() => setMetaStatusLoading(false));
  }, [location.search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Please provide the registered email address.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await axios.post('/api/crm/unsubscribe', {
        email,
        reason: `Data Deletion Request (${platform}): ${reason || 'User requested complete erasure'}`,
      });
      setSubmitted(true);
    } catch (err) {
      setError('Failed to process data deletion request: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tm-marketing-page min-h-screen bg-background text-foreground relative overflow-hidden">
      <MarketingPageBackground inkClassName="opacity-30 mix-blend-multiply dark:mix-blend-screen dark:opacity-15" />

      <header className="border-b border-border bg-card/80 sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 relative z-10">
          <BrandLogo size={40} />
          <div>
            <span className="font-bold text-base tracking-tight text-foreground block">{brand.name}</span>
            <span className="text-[10px] text-[var(--color-text-secondary)] font-mono">Data Deletion Protocol v1.1</span>
          </div>
        </div>
        <div className="flex items-center gap-3 relative z-10">
          <MarketingThemeToggle />
          <Link to="/" className="px-4 py-2 rounded-xl bg-card hover:bg-background border border-border text-xs font-bold text-foreground transition flex items-center gap-2">
            <ArrowLeft size={14} /> Back to Portal
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16 space-y-10 relative z-10">
        <div className="space-y-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold mb-2">
            <Trash2 size={14} /> Compliance Specification
          </div>
          <h1 className="text-4xl font-black tracking-tight text-foreground">User Data Deletion Request</h1>
          <p className="w-full text-sm text-[var(--color-text-secondary)] mx-auto" style={{ maxWidth: '600px' }}>
            In compliance with GDPR and Meta Developer Platform terms, revoke OAuth access and request permanent erasure of your account, API keys, and logged analytics.
          </p>
        </div>

        {metaStatusLoading && (
          <div className="p-6 rounded-2xl bg-card border border-border flex items-center justify-center gap-2 text-xs text-[var(--color-text-secondary)]">
            <Spinner size="sm" />
          </div>
        )}

        {metaDeletionStatus && !metaStatusLoading && (
          <div className={`p-6 rounded-2xl border text-xs space-y-2 ${
            metaDeletionStatus.status === 'completed'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : metaDeletionStatus.status === 'pending'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
          }`}>
            <strong className="block text-sm text-foreground">Meta Data Deletion Request</strong>
            {metaDeletionStatus.status === 'completed' && (
              <p>Confirmation <span className="font-mono">{metaDeletionStatus.confirmation_code}</span> — removed {metaDeletionStatus.connections_removed} connection(s) across {metaDeletionStatus.artists_affected} artist profile(s).</p>
            )}
            {metaDeletionStatus.status === 'pending' && <p>Deletion in progress. Refresh this page in a moment.</p>}
            {metaDeletionStatus.status === 'failed' && <p>Deletion failed: {metaDeletionStatus.error || 'Unknown error'}</p>}
            {metaDeletionStatus.status === 'not_found' && <p>No deletion record found for this confirmation code.</p>}
          </div>
        )}

        {submitted ? (
          <div className="p-8 rounded-3xl bg-card border border-emerald-500/30 text-center space-y-6 shadow-xl">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle size={32} />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-foreground">Deletion Request Confirmed</h2>
              <p className="text-xs text-[var(--color-text-secondary)] mx-auto leading-relaxed" style={{ maxWidth: '450px' }}>
                Your request has been securely logged. OAuth tokens, webhook subscriptions, and profile data linked to <strong className="text-emerald-600 dark:text-emerald-400">{email}</strong> are marked for purging.
              </p>
            </div>
            <div className="pt-4 flex items-center justify-center gap-4 flex-wrap">
              <Link to="/" className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-lg shadow-emerald-500/20">
                Return to Home
              </Link>
              <Link to="/privacy" className="px-6 py-3 rounded-xl bg-card hover:bg-background border border-border text-foreground font-bold text-xs transition">
                Read Privacy Policy
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 flex items-start gap-4">
              <AlertTriangle size={24} className="text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <strong className="font-bold text-amber-900 dark:text-amber-200 block text-sm">Permanent Action Notice</strong>
                <p className="leading-relaxed opacity-90">
                  Submitting this form initiates an irreversible purging pipeline. Active API tokens for Meta, Spotify, and YouTube will be revoked, and historical metric charts will be permanently deleted.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-8 rounded-3xl bg-card border border-border space-y-6 shadow-xl">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2 border-b border-border pb-4">
                <Shield size={18} className="text-rose-500" /> Automated Removal Submission Form
              </h2>

              {error && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold animate-pulse">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold text-[var(--color-text-secondary)] ml-1">Registered Account Email *</label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@company.com"
                  className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:ring-2 focus:ring-rose-500 outline-none text-foreground text-sm transition"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="userdata-platform" className="text-xs font-bold text-[var(--color-text-secondary)] ml-1">Target Platform Access to Revoke</label>
                <select
                  id="userdata-platform"
                  name="platform"
                  className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:ring-2 focus:ring-rose-500 outline-none text-foreground text-sm transition"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                >
                  <option value="all">Complete Account & All OAuth Integrations (Meta, Spotify, YouTube)</option>
                  <option value="meta">Meta Graph API (Instagram & Facebook Pages only)</option>
                  <option value="spotify">Spotify Web API connection only</option>
                  <option value="youtube">YouTube Data API connection only</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-[var(--color-text-secondary)] ml-1">Optional Feedback / Deletion Reason</label>
                <textarea
                  rows={4}
                  placeholder="Tell us why you are removing your data..."
                  className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:ring-2 focus:ring-rose-500 outline-none text-foreground text-sm transition"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:opacity-95 active:opacity-90 disabled:opacity-50 text-white font-bold text-xs tracking-wider uppercase transition shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2 cursor-pointer touch-manipulation"
              >
                {loading ? 'Processing Erasure...' : 'Confirm Permanent Erasure'}
              </button>
            </form>

            <section className="p-6 rounded-2xl bg-card border border-border space-y-4">
              <h3 className="font-bold text-sm text-foreground">Manual Revocation via Connected Platforms</h3>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                You can also revoke our application permissions directly within your provider settings:
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs font-bold">
                <a href="https://www.facebook.com/settings?tab=business_tools" target="_blank" rel="noreferrer" className="text-pink-500 hover:underline flex items-center gap-1">
                  Meta Business Tools <ExternalLink size={12} />
                </a>
                <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer" className="text-red-500 hover:underline flex items-center gap-1">
                  Google Account Permissions <ExternalLink size={12} />
                </a>
                <a href="https://www.spotify.com/us/account/apps/" target="_blank" rel="noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1">
                  Spotify Apps <ExternalLink size={12} />
                </a>
              </div>
            </section>
          </div>
        )}

        <footer className="pt-8 border-t border-border flex items-center justify-between text-xs text-[var(--color-text-secondary)] flex-wrap gap-4">
          <span>{footer.copyright()}</span>
          <Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link>
        </footer>
      </main>
    </div>
  );
}
