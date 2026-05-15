import React from 'react';
import { motion } from 'framer-motion';

export const Button = ({ children, variant = 'primary', size = 'md', className = '', ...props }) => {
  const variants = {
    primary: 'bg-[var(--color-action-primary)] text-white hover:bg-[var(--color-action-hover)] active:bg-[var(--color-action-active)] shadow-lg shadow-blue-500/20',
    secondary: 'bg-[var(--color-bg-workspace)] text-[var(--color-text-primary)] border border-[var(--color-bg-border)] hover:bg-[var(--color-bg-border)]',
    ghost: 'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-workspace)]',
    danger: 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20'
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  return (
    <button 
      className={`rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export const Card = ({ children, className = '', hover = false, variant = 'surface' }) => {
  const variants = {
    surface: 'bg-[var(--color-bg-surface)] border-[var(--color-bg-border)]',
    workspace: 'bg-[var(--color-bg-workspace)] border-[var(--color-bg-border)]',
    glass: 'bg-white/5 backdrop-blur-md border-white/10'
  };

  return (
    <div className={`rounded-[2rem] border shadow-sm transition-all ${variants[variant]} ${hover ? 'hover:shadow-xl hover:border-[var(--color-action-primary)]/30' : ''} ${className}`}>
      {children}
    </div>
  );
};

export const PageContainer = ({ children, className = '', maxWidth = '1600px' }) => (
  <div className={`mx-auto px-4 md:px-6 lg:px-8 py-8 md:py-10 space-y-10 pb-24 ${className}`} style={{ maxWidth }}>
    {children}
  </div>
);

export const TabSwitcher = ({ tabs, activeTab, onChange, className = '' }) => (
  <div className={`flex items-center gap-2 bg-[var(--color-bg-workspace)] p-1.5 rounded-xl border border-[var(--color-bg-border)] shadow-inner w-fit ${className}`}>
    {tabs.map((tab) => (
      <button
        key={tab.id}
        onClick={() => onChange(tab.id)}
        className={`px-5 py-2.5 text-[9px] font-black uppercase tracking-widest transition-all rounded-lg whitespace-nowrap ${
          activeTab === tab.id
            ? 'bg-[var(--color-bg-surface)] text-[var(--color-action-primary)] shadow-sm border border-[var(--color-bg-border)]'
            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
        }`}
      >
        {tab.label}
      </button>
    ))}
  </div>
);

export const Input = ({ label, icon: Icon, className = '', ...props }) => (
  <div className="space-y-1.5 w-full">
    {label && <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider ml-1">{label}</label>}
    <div className="relative">
      {Icon && <Icon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />}
      <input 
        className={`w-full ${Icon ? 'pl-11' : 'px-4'} pr-4 py-2.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-action-primary)] focus:border-transparent outline-none transition-all text-sm ${className}`}
        {...props}
      />
    </div>
  </div>
);

export const Badge = ({ children, variant = 'todo' }) => {
  const variantMap = {
    'todo': 'todo',
    'in-progress': 'progress',
    'in-review': 'review',
    'done': 'done',
    'critical': 'critical',
    'high': 'critical',
    'medium': 'todo',
    'low': 'todo'
  };
  
  const v = variantMap[variant] || variant;

  const colors = {
    todo: 'bg-[var(--color-bg-workspace)] text-[var(--color-text-muted)] border border-[var(--color-bg-border)]',
    progress: 'bg-blue-500/10 text-blue-500 border border-blue-500/20',
    review: 'bg-orange-500/10 text-orange-500 border border-orange-500/20',
    done: 'bg-green-500/10 text-green-500 border border-green-500/20',
    critical: 'bg-red-500/10 text-red-500 border border-red-500/20'
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-colors ${colors[v] || colors.todo}`}>
      {children}
    </span>
  );
};

export const ProgressBar = ({ progress, color = 'bg-[var(--color-action-primary)]' }) => (
  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
    <motion.div 
      initial={{ width: 0 }}
      animate={{ width: `${progress}%` }}
      className={`h-full ${color}`}
    />
  </div>
);

export { default as CKDropdown } from './CKDropdown';
export { default as NexusDropdown } from './NexusDropdown';
export { default as PageHeader } from './PageHeader';
export { NexusModal } from './NexusModal';
export { default as NexusLoader } from './NexusLoader';
export { default as VelocitySparkline } from './VelocitySparkline';
export { default as ProgressRing } from './ProgressRing';
export { default as ActivityHeatmap } from './ActivityHeatmap';
