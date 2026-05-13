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

export const Card = ({ children, className = '' }) => (
  <div className={`bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-bg-border)] shadow-sm ${className}`}>
    {children}
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
    todo: 'bg-gray-100 text-gray-700',
    progress: 'bg-blue-100 text-blue-700',
    review: 'bg-orange-100 text-orange-700',
    done: 'bg-green-100 text-green-700',
    critical: 'bg-red-100 text-red-700'
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${colors[v] || colors.todo}`}>
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
