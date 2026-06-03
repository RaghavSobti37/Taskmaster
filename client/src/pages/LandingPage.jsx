import React from 'react';
import { Navigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  Mail,
  Users,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Layers,
  Calendar
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import MarketingPageBackground from '../components/MarketingPageBackground';

export default function LandingPage() {
  const { user } = useAuth();

  // If already authenticated, redirect to the dashboard page directly
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const features = [
    {
      icon: Briefcase,
      title: "Project & Task Management",
      desc: "Organize tasks on high-density grids. Track priorities, assignees, and completion stages using a modular 4px grid design."
    },
    {
      icon: Mail,
      title: "Email Marketing & Tracking",
      desc: "Design and dispatch newsletters using secure SMTP or Resend API. Review delivery metrics, clicks, and opens dynamically."
    },
    {
      icon: Users,
      title: "Secure CRM Pipeline",
      desc: "Upload CSV leads, manage client status levels, coordinate follow-ups, and auto-sync unsubscribes to Google Sheets."
    },
    {
      icon: Calendar,
      title: "Interactive Workspace Calendar",
      desc: "Align your team deadlines and coordinate schedules with two-way local database calendar entries and Google Calendar sync."
    }
  ];

  return (
    <div className="tm-marketing-page min-h-screen bg-background text-foreground flex flex-col font-sans relative overflow-hidden">
      <MarketingPageBackground />

      {/* Header Bar */}
      <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 relative z-10">
          <img src="/favicon.png" alt="Coreknot Logo" className="w-10 h-10 rounded-xl shadow-lg shadow-purple-500/30 object-cover" />
          <div>
            <span className="font-bold text-base tracking-tight text-foreground block">Coreknot</span>
            <span className="text-[10px] text-[var(--color-text-secondary)] font-mono">Workspace Suite</span>
          </div>
        </div>
        <div className="flex items-center gap-4 relative z-10">
          <Link to="/privacy" className="text-xs text-[var(--color-text-secondary)] hover:text-foreground transition hidden sm:inline">
            Privacy Policy
          </Link>
          <Link to="/login" className="px-4 py-2 rounded-xl bg-card hover:bg-background border border-border text-xs font-bold text-foreground transition">
            Sign In
          </Link>
          <Link to="/register" className="px-4 py-2 rounded-xl bg-[var(--color-brand-teal)] hover:bg-[var(--color-action-hover)] text-xs font-bold text-[var(--color-brand-cream)] transition shadow-lg shadow-[var(--color-brand-teal)]/20">
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="w-full max-w-6xl mx-auto px-6 pt-16 pb-14 text-center flex-1 flex flex-col justify-center relative z-10">
        <div className="w-full max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--color-brand-pumpkin)]/10 border border-[var(--color-brand-pumpkin)]/20 text-[var(--color-brand-pumpkin)] text-xs font-bold">
            <Sparkles size={12} /> Introducing Coreknot Workspace
          </div>
          <h1 className="w-full text-4xl sm:text-6xl font-black tracking-tight text-foreground leading-tight text-balance">
            Master Your Team <span className="bg-clip-text text-transparent bg-gradient-to-r from-[var(--color-brand-teal)] to-[var(--color-action-primary)]">Workflows & Campaigns</span>
          </h1>
          <p className="block w-full mx-auto text-base md:text-lg text-[var(--color-text-secondary)] text-center leading-relaxed font-medium" style={{ maxWidth: '700px' }}>
            Coreknot integrates high-density project tracking, senior CRM operations pipeline management, and enterprise-ready dispatch features in a secure, unified workspace.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-6">
            <Link
              to="/login"
              className="px-6 py-3.5 rounded-xl bg-[var(--color-brand-teal)] hover:bg-[var(--color-action-hover)] text-[var(--color-brand-cream)] font-bold text-sm transition flex items-center gap-2 shadow-xl shadow-[var(--color-brand-teal)]/25 group"
            >
              Sign In to Workspace <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/register"
              className="px-6 py-3.5 rounded-xl bg-card hover:bg-background text-foreground border border-border font-bold text-sm transition"
            >
              Create Free Account
            </Link>
          </div>
        </div>
      </section>

      {/* Purpose / Feature Grid */}
      <section className="bg-card/90 backdrop-blur-sm border-y border-border py-16 relative z-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row gap-8 items-start w-full max-w-6xl mx-auto mb-12">
            <h2 className="w-full md:w-1/3 text-3xl md:text-4xl font-bold tracking-tight text-foreground">
              Purpose-Built for Modern Operations
            </h2>
            <p className="w-full md:w-2/3 text-[var(--color-text-secondary)] text-base md:text-lg leading-relaxed whitespace-normal">
              Coreknot provides a secure environment for business and product management, replacing fragmented tooling with coordinated workflows and optimized pipelines.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feat, index) => (
              <div
                key={index}
                className="p-6 rounded-2xl bg-background border border-border flex gap-4 items-start hover:border-[var(--color-brand-teal)] transition shadow-sm hover:shadow-md"
              >
                <div className="w-12 h-12 rounded-xl bg-[var(--color-brand-teal)]/10 border border-[var(--color-brand-teal)]/20 text-[var(--color-brand-teal)] flex items-center justify-center shrink-0">
                  <feat.icon size={24} />
                </div>
                <div className="space-y-2 min-w-0">
                  <h3 className="font-bold text-base text-foreground">{feat.title}</h3>
                  <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{feat.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-background border-t border-border py-12 relative z-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row sm:items-start items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src="/favicon.png" alt="Coreknot Logo" className="w-8 h-8 rounded-lg shadow-sm shadow-purple-500/20 object-cover" />
            <span className="font-bold text-sm text-foreground">Coreknot</span>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-xs text-[var(--color-text-secondary)] font-medium">
            <Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link>
            <Link to="/userdata" className="hover:text-foreground">User Data Deletion</Link>
            <a href="mailto:privacy@theshakticollective.in" className="hover:text-foreground">Contact Support</a>
          </div>

          <span className="text-xs text-[var(--color-text-secondary)] font-medium">
            © 2026 Coreknot / The Shakti Collective. All rights reserved.
          </span>
        </div>
      </footer>
    </div>
  );
}
