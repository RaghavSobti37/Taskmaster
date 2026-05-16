import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Zap, Shield, Layout, Users, Database, Calendar, 
  Layers, CheckCircle2, Lock, Globe, TrendingUp, 
  Cpu, Rocket, Activity, Box, Sparkles
} from 'lucide-react';
import { 
  PageHeader, PageContainer, Card, Badge, 
  StatCard, Button 
} from '../../components/ui';

const FeatureCard = ({ icon: Icon, title, description, status = "Live", variant = "info" }) => (
  <motion.div
    whileHover={{ y: -2, scale: 1.01 }}
    className="group"
  >
    <Card className="p-5 flex flex-col h-full !rounded-[var(--radius-atomic)]" hover>
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-xl bg-[var(--color-pastel-${variant}-bg)] text-[var(--color-pastel-${variant}-text)] shadow-sm group-hover:scale-110 transition-transform`}>
          <Icon size={18} strokeWidth={2.5} />
        </div>
        <Badge variant={status === 'Live' ? 'mint' : 'apricot'} className="text-[8px]">{status}</Badge>
      </div>
      <h3 className="text-[11px] font-black text-[var(--color-text-primary)] uppercase tracking-tight mb-2 italic">{title}</h3>
      <p className="text-[9px] text-[var(--color-text-muted)] font-bold leading-relaxed uppercase tracking-wider">{description}</p>
    </Card>
  </motion.div>
);

const FeaturesPage = () => {
  const features = useMemo(() => [
    {
      icon: Layout,
      title: "Direct CRM Routing",
      description: "Access deep CRM pages instantly from the sidebar without intermediate clicks. Synchronized URL states for seamless navigation.",
      variant: "info"
    },
    {
      icon: Cpu,
      title: "Smart Loading",
      description: "Smooth loading animations and transitions throughout the app for a seamless experience.",
      variant: "mint"
    },
    {
      icon: Lock,
      title: "Google Sync Auth",
      description: "Sign in with your Google account. One click to access everything while keeping your data secure.",
      variant: "rose"
    },
    {
      icon: Calendar,
      title: "Calendar Sync",
      description: "Two-way Google Calendar integration. See your project milestones and personal events in one place.",
      variant: "apricot"
    },
    {
      icon: Layers,
      title: "File Storage",
      description: "Google Drive integration. Automatically detect drive links, browse folders, and manage project files easily.",
      variant: "slate"
    },
    {
      icon: TrendingUp,
      title: "Artist Dashboard",
      description: "Manage your talent roster. Track social media growth, analytics, and performance all in one unified view.",
      variant: "info"
    }
  ], []);

  return (
    <PageContainer className="!py-4 !space-y-6">
      <PageHeader
        title="Platform Capabilities"
        subtitle="Operational infrastructure and integrated feature matrix."
        icon={Rocket}
        actions={
           <Button size="sm" variant="ghost" className="!text-[10px]"><Sparkles size={14} /> SYSTEM V.4.0</Button>
        }
      />

      {/* Analytical Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Active Modules" value="24" icon={Box} variant="info" />
        <StatCard label="Integration Index" value="98%" icon={Zap} variant="mint" />
        <StatCard label="Security Layer" value="AES-256" icon={Shield} variant="rose" />
        <StatCard label="Response Pulse" value="12ms" icon={Activity} variant="slate" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((f, i) => (
          <FeatureCard key={i} {...f} />
        ))}
      </div>

      <section className="bg-slate-900 border border-white/5 rounded-[var(--radius-pro)] p-8 text-white relative overflow-hidden group shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-indigo-600/20 opacity-50" />
        <div className="relative z-10 space-y-6 max-w-xl">
          <h2 className="text-2xl font-black uppercase tracking-tight italic flex items-center gap-3">
             <CheckCircle2 className="text-emerald-500" size={24} /> Mission Ready
          </h2>
          <p className="text-[11px] font-bold text-white/60 leading-relaxed uppercase tracking-[0.1em]">
            The Taskmaster ecosystem is fully synchronized with the Google Cloud backbone. Real-time data persistence and multi-layer encryption are active across all operational zones.
          </p>
          <div className="flex gap-3">
             <Badge variant="info" className="!bg-blue-500/20 !text-blue-400 !border-blue-500/30 py-2 px-4">CORE ACTIVE</Badge>
             <Badge variant="mint" className="!bg-emerald-500/20 !text-emerald-400 !border-emerald-500/30 py-2 px-4">DATA SYNCED</Badge>
          </div>
        </div>
        
        {/* Abstract Background Elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-125 transition-transform duration-1000" />
        <div className="absolute bottom-0 left-1/2 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl translate-y-1/2" />
      </section>
    </PageContainer>
  );
};

export default FeaturesPage;
