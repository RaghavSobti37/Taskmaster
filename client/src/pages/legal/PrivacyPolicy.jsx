import React from 'react';
import { Shield, Lock, Eye, Database, Globe, ArrowLeft, Mail, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] selection:bg-[var(--color-action-primary)] selection:text-[var(--color-bg-primary)]">
      {/* Header Bar */}
      <header className="border-b border-[var(--color-bg-border)] bg-[var(--color-bg-surface)]/90 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/favicon.png" alt="Coreknot Logo" className="w-10 h-10 rounded-xl shadow-lg shadow-purple-500/30 object-cover" />
          <div>
            <span className="font-bold text-base tracking-tight text-[var(--color-text-primary)] block">Coreknot</span>
            <span className="text-[10px] text-[var(--color-text-muted)] font-mono">Privacy Specification v2.1</span>
          </div>
        </div>
        <Link to="/" className="px-4 py-2 rounded-xl bg-[#1F2937] hover:bg-[#374151] text-xs font-bold text-slate-200 transition flex items-center gap-2">
          <ArrowLeft size={14} /> Back to Portal
        </Link>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-16 space-y-12">
        <div className="space-y-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold mb-2">
            <Shield size={14} /> Official Legal Policy
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white">Privacy Policy & Data Security</h1>
          <p className="w-full text-sm text-slate-400 mx-auto" style={{ maxWidth: '600px' }}>
            Effective Date: May 18, 2026 • Applying to Coreknot Workspace, and Cross-Platform Analytics Pipelines.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-[#111827] border border-[#1F2937] space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <Lock size={20} />
            </div>
            <h3 className="font-bold text-sm text-white">Secure Encrypted Storage</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              All OAuth 2.0 credentials and user access tokens are securely encrypted at rest within our MongoDB clusters using industry-standard AES-256 protocols.
            </p>
          </div>
          <div className="p-6 rounded-2xl bg-[#111827] border border-[#1F2937] space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Eye size={20} />
            </div>
            <h3 className="font-bold text-sm text-white">Zero Data Selling</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              We never monetize, share, or sell your personal data, customer CRM leads, or platform analytics to third-party advertisers or data brokers under any circumstances.
            </p>
          </div>
          <div className="p-6 rounded-2xl bg-[#111827] border border-[#1F2937] space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
              <Database size={20} />
            </div>
            <h3 className="font-bold text-sm text-white">Complete Data Sovereignty</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              You maintain absolute control over your connected accounts. You can revoke API access or request immediate, permanent deletion of your profile data at any time.
            </p>
          </div>
        </div>

        <section className="space-y-6 bg-[#111827] p-8 rounded-3xl border border-[#1F2937]">
          <h2 className="text-xl font-bold text-white flex items-center gap-3 border-b border-[#1F2937] pb-4">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span> 1. Information We Collect
          </h2>
          <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
            <p>
              When you use Coreknot, we collect information required to deliver CRM synchronization, internal productivity tools, and cross-platform artist analytics:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-400">
              <li><strong className="text-slate-200">Account Credentials:</strong> Name, professional email address, encrypted authentication hashes, and workspace role assignments.</li>
              <li><strong className="text-slate-200">Connected OAuth Data:</strong> Authorized access tokens and refresh tokens when linking external integrations such as Google Calendar, Spotify Web API, YouTube Data API, and Meta Graph API (Facebook & Instagram).</li>
              <li><strong className="text-slate-200">CRM & Project Artifacts:</strong> Client lead records, followup histories, task descriptions, and internal team chat transcripts entered into your workspace.</li>
              <li><strong className="text-slate-200">Automated Webhooks:</strong> Public mentions and engagement events dispatched by connected platforms (e.g., real-time Instagram tag alerts).</li>
            </ul>
          </div>
        </section>

        <section className="space-y-6 bg-[#111827] p-8 rounded-3xl border border-[#1F2937]">
          <h2 className="text-xl font-bold text-white flex items-center gap-3 border-b border-[#1F2937] pb-4">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span> 2. How We Use Your Data
          </h2>
          <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
            <p>Coreknot processes your data strictly for operational functionality:</p>
            <ul className="space-y-2 text-slate-400">
              <li className="flex items-start gap-2"><CheckCircle size={14} className="text-blue-500 mt-0.5 shrink-0" /> Aggregating follower growth trajectories and streaming metrics into your unified artist dashboard.</li>
              <li className="flex items-start gap-2"><CheckCircle size={14} className="text-blue-500 mt-0.5 shrink-0" /> Dispatching scheduled automated emails or calendar event reminders via secure AWS SES / Google API conduits.</li>
              <li className="flex items-start gap-2"><CheckCircle size={14} className="text-blue-500 mt-0.5 shrink-0" /> Maintaining real-time multi-user synchronization across active project workspaces.</li>
            </ul>
          </div>
        </section>

        <section className="space-y-6 bg-[#111827] p-8 rounded-3xl border border-[#1F2937]">
          <h2 className="text-xl font-bold text-white flex items-center gap-3 border-b border-[#1F2937] pb-4">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span> 3. Third-Party Integrations & Compliance
          </h2>
          <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
            <p>
              Our application adheres strictly to developer platform policies for all linked external providers:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#1F2937] space-y-2">
                <h4 className="font-bold text-xs text-white flex items-center gap-2"><Globe size={14} className="text-pink-500" /> Meta Platform Policy</h4>
                <p className="text-[11px] text-slate-400">
                  Data retrieved from Facebook and Instagram is used exclusively for internal insight presentation. We fully comply with Meta's Data Protection Assessment requirements.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#0B0F19] border border-[#1F2937] space-y-2">
                <h4 className="font-bold text-xs text-white flex items-center gap-2"><Globe size={14} className="text-red-500" /> YouTube / Google API Services</h4>
                <p className="text-[11px] text-slate-400">
                  YouTube analytics are accessed strictly via approved YouTube Data API protocols. Users can inspect or revoke access via Google Security settings.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6 bg-[#111827] p-8 rounded-3xl border border-[#1F2937]">
          <h2 className="text-xl font-bold text-white flex items-center gap-3 border-b border-[#1F2937] pb-4">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span> 4. User Data Deletion & Retention
          </h2>
          <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
            <p>
              You have the right to request the complete erasure of your personal data, OAuth connections, and workspace logs from our servers at any moment.
            </p>
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between flex-wrap gap-4">
              <div>
                <strong className="text-white block font-bold text-xs">Looking to delete your account or connected platform data?</strong>
                <span className="text-[11px] text-slate-400">Visit our dedicated automated data removal portal for instant processing.</span>
              </div>
              <Link to="/userdata" className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-lg shadow-blue-500/20">
                Data Deletion Portal
              </Link>
            </div>
          </div>
        </section>

        <footer className="pt-8 border-t border-[#1F2937] flex items-center justify-between text-xs text-slate-500 flex-wrap gap-4">
          <span>© 2026 Coreknot / The Shakti Collective. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link to="/userdata" className="hover:underline">User Data Deletion</Link>
            <a href="mailto:privacy@theshakticollective.in" className="flex items-center gap-1 hover:underline text-blue-400">
              <Mail size={12} /> privacy@theshakticollective.in
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}
