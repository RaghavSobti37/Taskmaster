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
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 selection:bg-blue-500 selection:text-white flex flex-col font-sans">
      {/* Header Bar */}
      <header className="border-b border-slate-800 bg-[#111827]/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-black text-lg text-white shadow-lg shadow-blue-500/30">
            CK
          </div>
          <div>
            <span className="font-bold text-base tracking-tight text-white block">TaskMaster</span>
            <span className="text-[10px] text-slate-400 font-mono">Workspace Suite</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/privacy" className="text-xs text-slate-400 hover:text-white transition hidden sm:inline">
            Privacy Policy
          </Link>
          <Link to="/login" className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition">
            Sign In
          </Link>
          <Link to="/register" className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition shadow-lg shadow-blue-500/20">
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center flex-1 flex flex-col justify-center items-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-6 max-w-3xl"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold mb-4">
            <Sparkles size={12} /> Introducing TaskMaster Workspace
          </div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-tight">
            Master Your Team <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">Workflows & Campaigns</span>
          </h1>
          <p className="text-base sm:text-lg text-slate-400 leading-relaxed max-w-2xl mx-auto">
            TaskMaster integrates high-density project tracking, active CRM customer pipeline management, and enterprise email dispatch features into a secure, unified workspace.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-6">
            <Link 
              to="/login" 
              className="px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition flex items-center gap-2 shadow-xl shadow-blue-500/25 group"
            >
              Sign In to Workspace <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link 
              to="/register" 
              className="px-6 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-sm transition"
            >
              Create Free Account
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Purpose / Feature Grid */}
      <section className="bg-[#111827] border-y border-slate-800 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Purpose-Built for Modern Operations
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              TaskMaster provides a secure environment for business and product management, replacing fragmented tooling with specialized workflow pipelines.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {features.map((feat, index) => (
              <div 
                key={index}
                className="p-6 rounded-2xl bg-[#0B0F19] border border-slate-800 flex gap-4 hover:border-slate-700 transition"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                  <feat.icon size={24} />
                </div>
                <div className="space-y-2">
                  <h3 className="font-bold text-base text-white">{feat.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{feat.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0B0F19] border-t border-slate-800 py-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-sm text-white">
              CK
            </div>
            <span className="font-bold text-sm text-white">TaskMaster</span>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-xs text-slate-500">
            <Link to="/privacy" className="hover:underline">Privacy Policy</Link>
            <Link to="/userdata" className="hover:underline">User Data Deletion</Link>
            <a href="mailto:privacy@theshakticollective.in" className="hover:underline">Contact Support</a>
          </div>

          <span className="text-xs text-slate-500">
            © 2026 CoreKnot / The Shakti Collective. All rights reserved.
          </span>
        </div>
      </footer>
    </div>
  );
}
