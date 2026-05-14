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
import { PageHeader, PageContainer, Card } from '../components/ui';

const FeatureCard = ({ icon: Icon, title, description, status = "Live", color = "blue" }) => (
  <motion.div
    whileHover={{ y: -5, scale: 1.02 }}
    className="group"
  >
    <Card className="p-8 flex flex-col h-full" hover>
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
    </Card>
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
      title: "Smart Loading",
      description: "Smooth loading animations and transitions throughout the app for a seamless experience.",
      color: "indigo"
    },
    {
      icon: Lock,
      title: "Google Sync Auth",
      description: "Sign in with your Google account. One click to access everything while keeping your data secure.",
      color: "purple"
    },
    {
      icon: Calendar,
      title: "Calendar Sync",
      description: "Two-way Google Calendar integration. See your project milestones and personal events in one place.",
      color: "amber"
    },
    {
      icon: Layers,
      title: "File Storage",
      description: "Google Drive integration. Automatically detect drive links, browse folders, and manage project files easily.",
      color: "rose"
    },
    {
      icon: TrendingUp,
      title: "Artist Dashboard",
      description: "Manage your talent roster. Track social media growth, analytics, and performance all in one unified view.",
      color: "emerald"
    }
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Features"
        subtitle="Everything you need to manage your creative projects effectively."
        icon={Zap}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {features.map((f, i) => (
          <FeatureCard key={i} {...f} />
        ))}
      </div>

      <section className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[3rem] p-12 text-white shadow-2xl relative overflow-hidden group">
        <div className="relative z-10 space-y-6 max-w-2xl">
          <h2 className="text-3xl font-black uppercase tracking-tight italic">Ready to Go</h2>
          <p className="text-sm font-medium text-white/80 leading-relaxed uppercase tracking-widest">
            All features are built and connected to the Google ecosystem. Start managing your projects now.
          </p>
          <div className="flex gap-4">
             <div className="px-6 py-3 bg-white text-blue-600 rounded-2xl font-black text-[10px] uppercase tracking-widest">All Systems Go</div>
             <div className="px-6 py-3 bg-white/10 backdrop-blur-md text-white rounded-2xl font-black text-[10px] uppercase tracking-widest border border-white/20">100% Complete</div>
          </div>
        </div>
        
        {/* Abstract Background Elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-1000" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
      </section>
    </PageContainer>
  );
};

export default FeaturesPage;
