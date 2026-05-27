import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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

export default function LandingPage() {
  const { token } = useAuth();

  // If already authenticated, redirect to the dashboard page directly
  if (token) {
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
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans relative overflow-hidden">
      {/* Paper texture & Ink spill background */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none bg-[url('/ink_spill_bg.png')] bg-cover bg-center opacity-70 mix-blend-multiply dark:mix-blend-screen dark:opacity-30"
      />
      {/* Pattern from PDF for subtle texture */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none bg-[url('/patterns/pattern_0.png')] bg-repeat opacity-5 mix-blend-overlay"
      />

      {/* Header Bar */}
      <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 bg-[var(--color-brand-teal)] rounded-xl flex items-center justify-center font-black text-lg text-[var(--color-brand-cream)] shadow-lg shadow-[var(--color-brand-teal)]/30">
            CK
          </div>
          <div>
            <span className="font-bold text-base tracking-tight text-foreground block">TaskMaster</span>
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
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center flex-1 flex flex-col justify-center items-center relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-6 max-w-3xl"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--color-brand-pumpkin)]/10 border border-[var(--color-brand-pumpkin)]/20 text-[var(--color-brand-pumpkin)] text-xs font-bold mb-4">
            <Sparkles size={12} /> Introducing TaskMaster Workspace
          </div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-foreground leading-tight">
            Master Your Team <span className="bg-clip-text text-transparent bg-gradient-to-r from-[var(--color-brand-teal)] to-[var(--color-action-primary)]">Workflows & Campaigns</span>
          </h1>
          <p className="text-base sm:text-lg text-[var(--color-text-secondary)] leading-relaxed max-w-2xl mx-auto font-medium">
            TaskMaster integrates high-density project tracking, active CRM customer pipeline management, and enterprise email dispatch features into a secure, unified workspace.
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
        </motion.div>
      </section>

      {/* Purpose / Feature Grid */}
      <section className="bg-card/90 backdrop-blur-sm border-y border-border py-20 relative z-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Purpose-Built for Modern Operations
            </h2>
            <p className="text-xs sm:text-sm text-[var(--color-text-secondary)]">
              TaskMaster provides a secure environment for business and product management, replacing fragmented tooling with specialized workflow pipelines.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {features.map((feat, index) => (
              <div 
                key={index}
                className="p-6 rounded-2xl bg-background border border-border flex gap-4 hover:border-[var(--color-brand-teal)] transition shadow-sm hover:shadow-md"
              >
                <div className="w-12 h-12 rounded-xl bg-[var(--color-brand-teal)]/10 border border-[var(--color-brand-teal)]/20 text-[var(--color-brand-teal)] flex items-center justify-center shrink-0">
                  <feat.icon size={24} />
                </div>
                <div className="space-y-2">
                  <h3 className="font-bold text-base text-foreground">{feat.title}</h3>
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed font-medium">{feat.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-background border-t border-border py-12 relative z-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[var(--color-brand-teal)] rounded-lg flex items-center justify-center font-bold text-sm text-[var(--color-brand-cream)]">
              CK
            </div>
            <span className="font-bold text-sm text-foreground">TaskMaster</span>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-xs text-[var(--color-text-secondary)] font-medium">
            <Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link>
            <Link to="/userdata" className="hover:text-foreground">User Data Deletion</Link>
            <a href="mailto:privacy@theshakticollective.in" className="hover:text-foreground">Contact Support</a>
          </div>

          <span className="text-xs text-[var(--color-text-secondary)] font-medium">
            © 2026 CoreKnot / The Shakti Collective. All rights reserved.
          </span>
        </div>
      </footer>
    </div>
  );
}
