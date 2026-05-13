import React from 'react';
import { motion } from 'framer-motion';
import { 
  Zap, 
  Shield, 
  Layout, 
  Users, 
  Database, 
  Calendar, 
  Layers, 
  CheckCircle2,
  Lock,
  Globe,
  TrendingUp,
  Cpu
} from 'lucide-react';

const FeatureCard = ({ icon: Icon, title, description, status = "Live", color = "blue" }) => (
  <motion.div
    whileHover={{ y: -5, scale: 1.02 }}
    className="bg-[var(--color-bg-surface)] p-8 rounded-[2.5rem] border border-[var(--color-bg-border)] shadow-xl shadow-black/5 group transition-all"
  >
    <div className={`w-12 h-12 rounded-2xl bg-${color}-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
      <Icon className={`text-${color}-500`} size={24} />
    </div>
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-sm font-black text-[var(--color-text-primary)] uppercase tracking-tight italic">{title}</h3>
      <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${status === 'Live' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
        {status}
      </span>
    </div>
    <p className="text-[10px] text-[var(--color-text-muted)] font-medium leading-relaxed uppercase tracking-wider">{description}</p>
  </motion.div>
);

const FeaturesPage = () => {
  const features = [
    {
      icon: Layout,
      title: "Direct CRM Routing",
      description: "Access deep CRM pages instantly from the sidebar without intermediate clicks. Synchronized URL states for seamless navigation.",
      color: "blue"
    },
    {
      icon: Cpu,
      title: "Nexus Intelligence",
      description: "Advanced global loading system with high-fidelity animations and premium aesthetics for all system transitions.",
      color: "indigo"
    },
    {
      icon: Lock,
      title: "Google Sync Auth",
      description: "Email-synchronized Google OAuth sign-in. Access the entire ecosystem with one click while maintaining strict security protocols.",
      color: "purple"
    },
    {
      icon: Calendar,
      title: "Temporal Sync",
      description: "Bi-directional Google Calendar integration. Map project milestones and personal events to a unified system grid.",
      color: "amber"
    },
    {
      icon: Layers,
      title: "Asset Repository",
      description: "Deep Google Drive integration. Auto-detect drive links, view folders, and manage project resources with branded visual cues.",
      color: "rose"
    },
    {
      icon: TrendingUp,
      title: "Artist Intelligence",
      description: "Dedicated module for talent management. Real-time social analytics, growth tracking, and unified dashboard for artist rosters.",
      color: "emerald"
    }
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 pb-32 space-y-12">
      <header className="text-center space-y-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 rounded-full border border-blue-500/20"
        >
          <Zap size={14} className="text-blue-500" />
          <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">System Capabilities</span>
        </motion.div>
        <h1 className="text-5xl font-black text-[var(--color-text-primary)] uppercase tracking-tighter italic">Ecosystem Features</h1>
        <p className="text-xs text-[var(--color-text-muted)] font-black uppercase tracking-[0.4em] max-w-2xl mx-auto italic">
          Powering the next generation of creative management through high-performance architecture.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {features.map((f, i) => (
          <FeatureCard key={i} {...f} />
        ))}
      </div>

      <section className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[3rem] p-12 text-white shadow-2xl relative overflow-hidden group">
        <div className="relative z-10 space-y-6 max-w-2xl">
          <h2 className="text-3xl font-black uppercase tracking-tight italic">Ready for Deployment</h2>
          <p className="text-sm font-medium text-white/80 leading-relaxed uppercase tracking-widest">
            The core architecture has been hardened and optimized. All requested modules are now operational and synchronized with the Google ecosystem.
          </p>
          <div className="flex gap-4">
             <div className="px-6 py-3 bg-white text-blue-600 rounded-2xl font-black text-[10px] uppercase tracking-widest">System Operational</div>
             <div className="px-6 py-3 bg-white/10 backdrop-blur-md text-white rounded-2xl font-black text-[10px] uppercase tracking-widest border border-white/20">Protocol 100%</div>
          </div>
        </div>
        
        {/* Abstract Background Elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-1000" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
      </section>
    </div>
  );
};

export default FeaturesPage;
