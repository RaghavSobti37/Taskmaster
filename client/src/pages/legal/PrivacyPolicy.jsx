import React from 'react';
import BrandLogo from '../../components/brand/BrandLogo';
import MarketingPageBackground from '../../components/MarketingPageBackground';
import MarketingThemeToggle from '../../components/MarketingThemeToggle';
import { Shield, Lock, Eye, Database, Globe, ArrowLeft, Mail, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { brand, footer, legalCopy } from '../../constants/marketingContent';

export default function PrivacyPolicy() {
  return (
    <div className="tm-marketing-page min-h-screen bg-background text-foreground relative overflow-hidden">
      <MarketingPageBackground inkClassName="opacity-30 mix-blend-multiply dark:mix-blend-screen dark:opacity-15" />

      <header className="border-b border-border bg-card/80 sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 relative z-10">
          <BrandLogo size={40} />
          <div>
            <span className="font-bold text-base tracking-tight text-foreground block">{brand.name}</span>
            <span className="text-[10px] text-[var(--color-text-secondary)] font-mono">Privacy Specification v2.2</span>
          </div>
        </div>
        <div className="flex items-center gap-3 relative z-10">
          <MarketingThemeToggle />
          <Link to="/" className="px-4 py-2 rounded-xl bg-card hover:bg-background border border-border text-xs font-bold text-foreground transition flex items-center gap-2">
            <ArrowLeft size={14} /> Back to Portal
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16 space-y-12 relative z-10">
        <div className="space-y-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-brand-teal)]/10 border border-[var(--color-brand-teal)]/20 text-[var(--color-brand-teal)] text-xs font-bold mb-2">
            <Shield size={14} /> Official Legal Policy
          </div>
          <h1 className="text-4xl font-black tracking-tight text-foreground">Privacy Policy & Data Security</h1>
          <p className="w-full text-sm text-[var(--color-text-secondary)] mx-auto" style={{ maxWidth: '600px' }}>
            Effective Date: June 6, 2026 · {legalCopy.privacyAppliesLine}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-card border border-border space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-brand-teal)]/10 border border-[var(--color-brand-teal)]/20 text-[var(--color-brand-teal)] flex items-center justify-center">
              <Lock size={20} />
            </div>
            <h3 className="font-bold text-sm text-foreground">Secure Encrypted Storage</h3>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              OAuth 2.0 credentials and access tokens are encrypted at rest in MongoDB using industry-standard AES-256 protocols.
            </p>
          </div>
          <div className="p-6 rounded-2xl bg-card border border-border space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Eye size={20} />
            </div>
            <h3 className="font-bold text-sm text-foreground">Zero Data Selling</h3>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              We never monetize, share, or sell personal data, CRM leads, or platform analytics to third-party advertisers or data brokers.
            </p>
          </div>
          <div className="p-6 rounded-2xl bg-card border border-border space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Database size={20} />
            </div>
            <h3 className="font-bold text-sm text-foreground">Complete Data Sovereignty</h3>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              You control connected accounts. Revoke API access or request permanent deletion of profile data at any time.
            </p>
          </div>
        </div>

        <section className="space-y-4 bg-card p-8 rounded-3xl border border-border">
          <h2 className="text-lg font-bold text-foreground">Organizations & invitations</h2>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            CoreKnot is multi-tenant. Your account may belong to one or more organizations. Organization owners and admins control membership invites, integration credentials, and workspace data within their tenant. Invitations are sent to your email address; accepting links your existing user account to the inviting organization without creating duplicate accounts.
          </p>
        </section>

        <section className="space-y-6 bg-card p-8 rounded-3xl border border-border">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-3 border-b border-border pb-4">
            <span className="w-2 h-2 rounded-full bg-[var(--color-brand-teal)]" /> 1. Information We Collect
          </h2>
          <div className="space-y-4 text-xs text-[var(--color-text-secondary)] leading-relaxed">
            <p>
              When you use {legalCopy.productNameInBody}, we collect information required to deliver CRM synchronization, productivity tools, and artist analytics:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-foreground">Account Credentials:</strong> Name, professional email, encrypted authentication hashes, and workspace role assignments.</li>
              <li><strong className="text-foreground">Connected OAuth Data:</strong> Authorized tokens when linking Google Calendar, Spotify, YouTube, and Meta (Facebook & Instagram).</li>
              <li><strong className="text-foreground">CRM & Project Artifacts:</strong> Client leads, follow-ups, tasks, and team notes entered in your workspace.</li>
              <li><strong className="text-foreground">Automated Webhooks:</strong> Public mentions and engagement events from connected platforms.</li>
            </ul>
          </div>
        </section>

        <section className="space-y-6 bg-card p-8 rounded-3xl border border-border">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-3 border-b border-border pb-4">
            <span className="w-2 h-2 rounded-full bg-[var(--color-brand-teal)]" /> 2. How We Use Your Data
          </h2>
          <div className="space-y-4 text-xs text-[var(--color-text-secondary)] leading-relaxed">
            <p>{legalCopy.productNameInBody} processes your data strictly for operational functionality:</p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2"><CheckCircle size={14} className="text-[var(--color-brand-teal)] mt-0.5 shrink-0" /> Aggregating follower and streaming metrics into unified artist dashboards.</li>
              <li className="flex items-start gap-2"><CheckCircle size={14} className="text-[var(--color-brand-teal)] mt-0.5 shrink-0" /> Dispatching scheduled emails and calendar reminders via secure API conduits.</li>
              <li className="flex items-start gap-2"><CheckCircle size={14} className="text-[var(--color-brand-teal)] mt-0.5 shrink-0" /> Maintaining real-time multi-user synchronization across active workspaces.</li>
            </ul>
          </div>
        </section>

        <section className="space-y-6 bg-card p-8 rounded-3xl border border-border">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-3 border-b border-border pb-4">
            <span className="w-2 h-2 rounded-full bg-[var(--color-brand-teal)]" /> 3. Third-Party Integrations & Compliance
          </h2>
          <div className="space-y-4 text-xs text-[var(--color-text-secondary)] leading-relaxed">
            <p>Our application adheres to developer platform policies for all linked providers:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-background border border-border space-y-2">
                <h4 className="font-bold text-xs text-foreground flex items-center gap-2"><Globe size={14} className="text-pink-500" /> Meta Platform Policy</h4>
                <p className="text-[11px]">
                  Facebook and Instagram data is used exclusively for internal insight presentation. We comply with Meta Data Protection Assessment requirements.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-background border border-border space-y-2">
                <h4 className="font-bold text-xs text-foreground flex items-center gap-2"><Globe size={14} className="text-red-500" /> YouTube / Google API Services</h4>
                <p className="text-[11px]">
                  YouTube analytics are accessed via approved YouTube Data API protocols. Users can revoke access via Google Security settings.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6 bg-card p-8 rounded-3xl border border-border">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-3 border-b border-border pb-4">
            <span className="w-2 h-2 rounded-full bg-[var(--color-brand-teal)]" /> 4. User Data Deletion & Retention
          </h2>
          <div className="space-y-4 text-xs text-[var(--color-text-secondary)] leading-relaxed">
            <p>
              You may request complete erasure of personal data, OAuth connections, and workspace logs from our servers at any time.
            </p>
            <div className="p-4 rounded-xl bg-[var(--color-brand-teal)]/10 border border-[var(--color-brand-teal)]/20 flex items-center justify-between flex-wrap gap-4">
              <div>
                <strong className="text-foreground block font-bold text-xs">Delete your account or connected platform data?</strong>
                <span className="text-[11px]">Visit our data removal portal for processing.</span>
              </div>
              <Link to="/userdata" className="px-4 py-2 rounded-xl bg-[var(--color-brand-teal)] hover:bg-[var(--color-action-hover)] text-[var(--color-brand-cream)] text-xs font-bold transition shadow-lg shadow-[var(--color-brand-teal)]/20">
                Data Deletion Portal
              </Link>
            </div>
          </div>
        </section>

        <footer className="pt-8 border-t border-border flex items-center justify-between text-xs text-[var(--color-text-secondary)] flex-wrap gap-4">
          <span>{footer.copyright()}</span>
          <div className="flex items-center gap-4">
            <Link to="/userdata" className="hover:text-foreground">User Data Deletion</Link>
            <a href="mailto:privacy@theshakticollective.in" className="flex items-center gap-1 hover:text-foreground text-[var(--color-brand-teal)]">
              <Mail size={12} /> privacy@theshakticollective.in
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}
