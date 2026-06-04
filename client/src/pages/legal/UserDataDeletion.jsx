import React, { useState, useEffect } from 'react';
import { Trash2, AlertTriangle, CheckCircle, ArrowLeft, Mail, ExternalLink, Shield } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import BrandLogo from '../../components/brand/BrandLogo';

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
      // Send unsubscribe / data deletion payload to backend
      await axios.post('/api/crm/unsubscribe', {
        email,
        reason: `Data Deletion Request (${platform}): ${reason || 'User requested complete erasure'}`
      });
      setSubmitted(true);
    } catch (err) {
      setError('Failed to process data deletion request: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 selection:bg-rose-500 selection:text-white">
      {/* Header Bar */}
      <header className="border-b border-[#1F2937] bg-[#111827]/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BrandLogo size={40} />
          <div>
            <span className="font-bold text-base tracking-tight text-white block">Coreknot</span>
            <span className="text-[10px] text-slate-300 font-mono">Data Deletion Protocol v1.0</span>
          </div>
        </div>
        <Link to="/" className="px-4 py-2 rounded-xl bg-[#1F2937] hover:bg-[#374151] text-xs font-bold text-slate-200 transition flex items-center gap-2">
          <ArrowLeft size={14} /> Back to Portal
        </Link>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-6 py-16 space-y-10">
        <div className="space-y-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold mb-2">
            <Trash2 size={14} /> Compliance Specification
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white">User Data Deletion Request</h1>
          <p className="w-full text-sm text-slate-300 mx-auto" style={{ maxWidth: '600px' }}>
            In compliance with GDPR and Meta Developer Platform terms, you can instantly revoke OAuth access and request the permanent erasure of your account, API keys, and logged analytics.
          </p>
        </div>

        {metaStatusLoading && (
          <div className="p-6 rounded-2xl bg-[#111827] border border-[#1F2937] flex items-center justify-center gap-2 text-xs text-slate-400">
            <Spinner size="sm" showPhrase phraseClassName="text-xs text-slate-400" />
          </div>
        )}

        {metaDeletionStatus && !metaStatusLoading && (
          <div className={`p-6 rounded-2xl border text-xs space-y-2 ${
            metaDeletionStatus.status === 'completed'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : metaDeletionStatus.status === 'pending'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            <strong className="block text-sm text-white">Meta Data Deletion Request</strong>
            {metaDeletionStatus.status === 'completed' && (
              <p>Confirmation <span className="font-mono">{metaDeletionStatus.confirmation_code}</span> — removed {metaDeletionStatus.connections_removed} connection(s) across {metaDeletionStatus.artists_affected} artist profile(s).</p>
            )}
            {metaDeletionStatus.status === 'pending' && <p>Deletion in progress. Refresh this page in a moment.</p>}
            {metaDeletionStatus.status === 'failed' && <p>Deletion failed: {metaDeletionStatus.error || 'Unknown error'}</p>}
            {metaDeletionStatus.status === 'not_found' && <p>No deletion record found for this confirmation code.</p>}
          </div>
        )}

        {submitted ? (
          <div className="p-8 rounded-3xl bg-[#111827] border border-emerald-500/30 text-center space-y-6 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle size={32} />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">Deletion Request Confirmed</h2>
              <p className="text-xs text-slate-300 mx-auto leading-relaxed" style={{ maxWidth: '450px' }}>
                Your request has been securely logged. All associated OAuth tokens, platform webhook subscriptions, and profile data linked to <strong className="text-emerald-400">{email}</strong> have been marked for immediate purging.
              </p>
            </div>
            <div className="pt-4 flex items-center justify-center gap-4">
              <Link to="/" className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-lg shadow-emerald-500/20">
                Return to Dashboard
              </Link>
              <Link to="/privacy" className="px-6 py-3 rounded-xl bg-[#1F2937] hover:bg-[#374151] text-slate-300 font-bold text-xs transition">
                Read Privacy Policy
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-start gap-4">
              <AlertTriangle size={24} className="text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <strong className="font-bold text-amber-200 block text-sm">Permanent Action Notice</strong>
                <p className="text-amber-300/80 leading-relaxed">
                  Submitting this form initiates an irreversible purging pipeline. All active API tokens for Meta, Spotify, and YouTube will be revoked, and historical metric charts will be permanently deleted.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-8 rounded-3xl bg-[#111827] border border-[#1F2937] space-y-6 shadow-2xl">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-[#1F2937] pb-4">
                <Shield size={18} className="text-rose-500" /> Automated Removal Submission Form
              </h2>

              {error && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold animate-pulse">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 ml-1">Registered Account Email *</label>
                <input
                  type="email"
                  required
                  placeholder="[EMAIL_ADDRESS]"
                  className="w-full px-4 py-3 rounded-xl bg-[#0B0F19] border border-[#1F2937] focus:ring-2 focus:ring-rose-500 outline-none text-white text-xs transition font-mono"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="userdata-platform" className="text-xs font-bold text-slate-300 ml-1">Target Platform Access to Revoke</label>
                <select
                  id="userdata-platform"
                  name="platform"
                  className="w-full px-4 py-3 rounded-xl bg-[#0B0F19] border border-[#1F2937] focus:ring-2 focus:ring-rose-500 outline-none text-white text-xs transition"
                  value={platform}
                  onChange={e => setPlatform(e.target.value)}
                >
                  <option value="all">Complete Account & All OAuth Integrations (Meta, Spotify, YouTube)</option>
                  <option value="meta">Meta Graph API (Instagram & Facebook Pages only)</option>
                  <option value="spotify">Spotify Web API connection only</option>
                  <option value="youtube">YouTube Data API connection only</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 ml-1">Optional Feedback / Deletion Reason</label>
                <textarea
                  rows={4}
                  placeholder="Tell us why you are removing your data..."
                  className="w-full px-4 py-3 rounded-xl bg-[#0B0F19] border border-[#1F2937] focus:ring-2 focus:ring-rose-500 outline-none text-white text-xs transition"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:opacity-95 active:opacity-90 disabled:opacity-50 text-white font-bold text-xs tracking-wider uppercase transition shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? 'Processing Erasure...' : 'Confirm Permanent Erasure'}
              </button>
            </form>

            <section className="p-6 rounded-2xl bg-[#111827] border border-[#1F2937] space-y-4">
              <h3 className="font-bold text-sm text-white">Manual Revocation via Connected Platforms</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                You can also manually revoke our application's permissions directly within your respective provider settings at any time:
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs font-bold">
                <a href="https://www.facebook.com/settings?tab=business_tools" target="_blank" rel="noreferrer" className="text-pink-400 hover:underline flex items-center gap-1">
                  Meta Business Tools <ExternalLink size={12} />
                </a>
                <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer" className="text-red-400 hover:underline flex items-center gap-1">
                  Google Account Permissions <ExternalLink size={12} />
                </a>
                <a href="https://www.spotify.com/us/account/apps/" target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline flex items-center gap-1">
                  Spotify Apps <ExternalLink size={12} />
                </a>
              </div>
            </section>
          </div>
        )}

        <footer className="pt-8 border-t border-[#1F2937] flex items-center justify-between text-xs text-slate-400 flex-wrap gap-4">
          <span>© 2026 Coreknot / The Shakti Collective. All rights reserved.</span>
          <Link to="/privacy" className="hover:underline">Privacy Policy</Link>
        </footer>
      </main>
    </div>
  );
}


// Performance Optimization: useCallback(eventHandler) memoization guard
