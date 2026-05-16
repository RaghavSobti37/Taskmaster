import { motion, AnimatePresence } from 'framer-motion';
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save } from 'lucide-react';

export const Skeleton = ({ className = '', variant = 'rect', width, height }) => {
  const variants = {
    rect: 'rounded-[var(--radius-atomic)]',
    circle: 'rounded-full',
    text: 'rounded-md h-3 w-full'
  };

  return (
    <div 
      className={`animate-pulse bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] ${variants[variant]} ${className}`}
      style={{ width, height }}
    />
  );
};

export const Button = ({ children, variant = 'primary', size = 'md', className = '', ...props }) => {
  const variants = {
    primary: 'bg-[var(--color-action-primary)] text-white hover:opacity-90 active:scale-[0.98]',
    secondary: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border border-[var(--color-bg-border)] hover:bg-[var(--color-bg-border)]',
    ghost: 'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]',
    danger: 'bg-[var(--color-pastel-rose-bg)] text-[var(--color-pastel-rose-text)] border border-[var(--color-pastel-rose-text)]/10 hover:bg-[var(--color-pastel-rose-text)]/10'
  };

  const sizes = {
    xs: 'px-2 py-1 text-[10px]',
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  return (
    <button 
      className={`rounded-[var(--radius-atomic)] font-semibold transition-all flex items-center justify-center gap-2 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export const Card = ({ children, className = '', hover = false, variant = 'surface', ...props }) => {
  const variants = {
    surface: 'bg-[var(--color-bg-surface)] border-[var(--color-bg-border)]',
    secondary: 'bg-[var(--color-bg-secondary)] border-[var(--color-bg-border)]',
  };

  return (
    <div 
      className={`rounded-[var(--radius-atomic)] border shadow-sm transition-all ${variants[variant]} ${hover ? 'hover:border-[var(--color-action-primary)]/50 cursor-pointer' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const PageContainer = ({ children, className = '', maxWidth = '1600px' }) => (
  <div className={`mx-auto px-4 py-6 space-y-6 pb-24 ${className}`} style={{ maxWidth }}>
    {children}
  </div>
);

export const TabSwitcher = ({ tabs, activeTab, onChange, className = '' }) => (
  <div className={`flex items-center gap-1 bg-[var(--color-bg-secondary)] p-1 rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] w-fit ${className}`}>
    {tabs.map((tab) => (
      <button
        key={tab.id}
        onClick={() => onChange(tab.id)}
        className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all rounded-[var(--radius-atomic)] whitespace-nowrap ${
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

export const Input = ({ label, icon: Icon, multiline = false, rows = 4, className = '', ...props }) => (
  <div className="space-y-1 w-full">
    {label && <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider ml-0.5">{label}</label>}
    <div className="relative">
      {Icon && !multiline && <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />}
      {multiline ? (
        <textarea
          rows={rows}
          className={`w-full p-3 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] focus:border-[var(--color-action-primary)] outline-none transition-all text-xs font-mono resize-y ${className}`}
          {...props}
        />
      ) : (
        <input 
          className={`w-full ${Icon ? 'pl-9' : 'px-3'} pr-3 py-1.5 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] focus:border-[var(--color-action-primary)] outline-none transition-all text-sm ${className}`}
          {...props}
        />
      )}
    </div>
  </div>
);

export const Badge = ({ children, variant = 'info', className = '' }) => {
  const variants = {
    success: 'badge-mint',
    complete: 'badge-mint',
    converted: 'badge-mint',
    warning: 'badge-apricot',
    'in-progress': 'badge-apricot',
    danger: 'badge-rose',
    overdue: 'badge-rose',
    hot: 'badge-rose',
    high: 'badge-rose',
    info: 'badge-slate',
    neutral: 'badge-slate',
    fresh: 'badge-slate',
    low: 'badge-slate'
  };

  return (
    <span className={`badge-pastel ${variants[variant] || 'badge-slate'} ${className}`}>
      {children}
    </span>
  );
};

export const InfoButton = ({ text }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);

  const handleOpen = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top + window.scrollY - 10,
        left: rect.left + window.scrollX + rect.width / 2,
      });
      setIsOpen(true);
    }
  };

  return (
    <div 
      className="inline-flex items-center ml-1.5 align-middle"
      onMouseEnter={handleOpen}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={handleOpen}
      onBlur={() => setIsOpen(false)}
    >
      <button 
        ref={buttonRef}
        type="button"
        className="w-3.5 h-3.5 inline-flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300 hover:bg-blue-500 hover:text-white transition-colors cursor-help focus:outline-none"
      >
        i
      </button>

      {isOpen && createPortal(
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 4 }}
          transition={{ duration: 0.1, ease: 'easeOut' }}
          style={{ top: `${coords.top}px`, left: `${coords.left}px`, transform: 'translate(-50%, -100%)' }}
          className="absolute z-[99999] w-64 p-3 rounded-2xl bg-slate-900 dark:bg-black text-white text-[10px] font-bold tracking-wide leading-relaxed shadow-2xl border border-white/20 pointer-events-none text-center"
        >
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900 dark:border-t-black" />
        </motion.div>,
        document.body
      )}
    </div>
  );
};

export const StatCard = ({ label, value, icon: Icon, variant = 'slate', subValue, info, children }) => {
  const variants = {
    info: 'border-[var(--color-pastel-blue-text)]/20 bg-[var(--color-pastel-blue-bg)] text-[var(--color-pastel-blue-text)]',
    mint: 'border-[var(--color-pastel-mint-text)]/20 bg-[var(--color-pastel-mint-bg)] text-[var(--color-pastel-mint-text)]',
    rose: 'border-[var(--color-pastel-rose-text)]/20 bg-[var(--color-pastel-rose-bg)] text-[var(--color-pastel-rose-text)]',
    apricot: 'border-[var(--color-pastel-apricot-text)]/20 bg-[var(--color-pastel-apricot-bg)] text-[var(--color-pastel-apricot-text)]',
    slate: 'border-[var(--color-pastel-slate-text)]/20 bg-[var(--color-pastel-slate-bg)] text-[var(--color-pastel-slate-text)]',
  };

  return (
    <Card className={`p-3 flex flex-col gap-2 !rounded-[var(--radius-atomic)] border-l-2 ${variants[variant]} h-full`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 opacity-70">
          <Icon size={12} strokeWidth={2.5} />
          <span className="text-[10px] font-black uppercase tracking-widest leading-none">
            {label}
            {info && <InfoButton text={info} />}
          </span>
        </div>
        {subValue && <Badge variant={variant} className="!py-0 !px-1.5 !text-[9px] font-black">{subValue}</Badge>}
      </div>
      <div className="flex items-center justify-between mt-auto">
        <span className="text-2xl font-black tracking-tighter text-[var(--color-text-primary)] leading-none">{value}</span>
        <div className="flex-shrink-0 flex items-center justify-end">
          {children}
        </div>
      </div>
    </Card>
  );
};

export const DataTable = ({ columns, data, onRowClick, className = '' }) => (
  <div className={`w-full overflow-hidden border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] ${className}`}>
    <table className="w-full text-left border-collapse">
      <thead className="bg-[var(--color-bg-secondary)] border-b border-[var(--color-bg-border)]">
        <tr>
          {columns.map((col, i) => (
            <th key={i} className="px-4 py-2 text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
              {col.header}
              {col.info && <InfoButton text={col.info} />}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr 
            key={i} 
            onClick={() => onRowClick?.(row)}
            className="data-table-row cursor-pointer transition-none relative group hover:bg-slate-100/70 dark:hover:bg-slate-800/50"
          >
            {columns.map((col, j) => (
              <td key={j} className="px-4 py-2 text-sm text-[var(--color-text-primary)]">
                {col.render ? col.render(row) : row[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const FullScreenWorkspace = ({ isOpen, onClose, title, subtitle, children, sidebar, onSave }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
          className="fixed inset-0 z-[500] bg-[var(--color-bg-primary)] flex flex-col"
        >
          {/* Top Bar Navigation */}
          <div className="h-14 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] flex items-center justify-between px-6 shrink-0">
             <div className="flex items-center gap-4">
                <button onClick={onClose} className="p-2 hover:bg-[var(--color-bg-border)] rounded-lg transition-colors">
                   <X size={20} />
                </button>
                <div>
                   <h2 className="text-sm font-black uppercase tracking-tight leading-none">{title}</h2>
                   {subtitle && <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mt-1">{subtitle}</p>}
                </div>
             </div>
             <div className="flex items-center gap-3">
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button onClick={onSave} className="shadow-lg shadow-[var(--color-action-primary)]/20">
                   <Save size={16} /> Save Changes
                </Button>
             </div>
          </div>

          {/* Main Layout Partition */}
          <div className="flex-1 flex overflow-hidden">
             {/* Left Column: 70% Canvas */}
             <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="max-w-4xl mx-auto space-y-8">
                   {children}
                </div>
             </div>

             {/* Right Column: 30% Utility Drawer */}
             <aside className="w-[30%] border-l border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] overflow-y-auto p-6 custom-scrollbar">
                <div className="space-y-6">
                   {sidebar}
                </div>
             </aside>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const InputFormDrawer = ({ isOpen, onClose, title, children }) => (
  <AnimatePresence>
    {isOpen && (
      <>
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[100]"
        />
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed top-0 right-0 h-full w-full max-w-md bg-[var(--color-bg-primary)] border-l border-[var(--color-bg-border)] shadow-2xl z-[101] overflow-y-auto"
        >
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--color-bg-border)] pb-4">
              <h2 className="text-lg font-bold">{title}</h2>
              <button onClick={onClose} className="p-1 hover:bg-[var(--color-bg-secondary)] rounded-md transition-colors">
                <X size={20} />
              </button>
            </div>
            {children}
          </div>
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

export const ProgressBar = ({ progress, color = 'bg-[var(--color-action-primary)]' }) => (
  <div className="w-full h-1 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
    <motion.div 
      initial={{ width: 0 }}
      animate={{ width: `${progress}%` }}
      className={`h-full ${color}`}
    />
  </div>
);
