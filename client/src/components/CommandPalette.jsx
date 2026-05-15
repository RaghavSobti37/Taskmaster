import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Command, 
  ArrowRight, 
  LayoutDashboard, 
  Briefcase, 
  Users, 
  Calendar, 
  Settings,
  Plus,
  Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CommandPalette = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const actions = [
    { id: 'dash', icon: LayoutDashboard, label: 'Go to Dashboard', shortcut: 'G D', path: '/' },
    { id: 'proj', icon: Briefcase, label: 'View Projects', shortcut: 'G P', path: '/projects' },
    { id: 'leads', icon: Users, label: 'Manage CRM Leads', shortcut: 'G L', path: '/leads' },
    { id: 'cal', icon: Calendar, label: 'Open Calendar', shortcut: 'G C', path: '/calendar' },
    { id: 'set', icon: Settings, label: 'Account Settings', shortcut: 'G S', path: '/settings' },
    { id: 'new-proj', icon: Plus, label: 'Create New Project', shortcut: 'N P', path: '/projects/new', color: 'text-blue-500' },
    { id: 'quick-log', icon: Zap, label: 'Record Daily Log', shortcut: 'N L', path: '/logs', color: 'text-amber-500' },
  ];

  const filteredActions = actions.filter(action => 
    action.label.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape') setIsOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleAction = (path) => {
    navigate(path);
    setIsOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev + 1) % filteredActions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev - 1 + filteredActions.length) % filteredActions.length);
    } else if (e.key === 'Enter') {
      if (filteredActions[activeIndex]) {
        handleAction(filteredActions[activeIndex].path);
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[2000] flex items-start justify-center pt-[15vh] px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-black/40 dark:bg-black/80 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-2xl bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-[2.5rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] overflow-hidden"
          >
            <div className="flex items-center px-6 py-5 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]/50">
              <Search className="text-[var(--color-text-muted)] mr-4" size={20} />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search commands or navigate..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={onKeyDown}
                className="flex-1 bg-transparent border-none outline-none text-base font-bold text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]"
              />
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl shadow-sm">
                <Command size={12} className="text-[var(--color-text-muted)]" />
                <span className="text-[10px] font-black text-[var(--color-text-muted)]">K</span>
              </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto custom-scrollbar p-3 space-y-1">
              {filteredActions.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="inline-flex p-4 rounded-full bg-[var(--color-bg-workspace)] mb-4">
                    <Zap size={32} className="text-[var(--color-text-muted)] opacity-20" />
                  </div>
                  <p className="text-[11px] font-black uppercase text-[var(--color-text-muted)] tracking-widest">No matching commands found</p>
                </div>
              ) : (
                filteredActions.map((action, idx) => (
                  <button
                    key={action.id}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => handleAction(action.path)}
                    className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all ${idx === activeIndex ? 'bg-[var(--color-action-primary)] text-white shadow-xl shadow-blue-500/20' : 'hover:bg-[var(--color-bg-workspace)] text-[var(--color-text-secondary)]'}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2.5 rounded-xl ${idx === activeIndex ? 'bg-white/20' : 'bg-[var(--color-bg-workspace)]'} ${action.color || ''}`}>
                        <action.icon size={20} />
                      </div>
                      <span className="text-sm font-black uppercase tracking-tight italic">{action.label}</span>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      {action.shortcut && (
                        <div className={`flex gap-1 ${idx === activeIndex ? 'opacity-100' : 'opacity-40'}`}>
                          {action.shortcut.split(' ').map((key, i) => (
                            <span key={i} className={`min-w-[20px] px-1.5 py-0.5 rounded-md border text-[9px] font-black flex items-center justify-center ${idx === activeIndex ? 'bg-white/20 border-white/30 text-white' : 'bg-[var(--color-bg-workspace)] border-[var(--color-bg-border)] text-[var(--color-text-muted)]'}`}>
                              {key}
                            </span>
                          ))}
                        </div>
                      )}
                      {idx === activeIndex && <ArrowRight size={16} />}
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="px-6 py-4 border-t border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]/30 flex items-center justify-between">
               <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] text-[8px] font-black text-[var(--color-text-muted)] shadow-sm">ENTER</span>
                    <span className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Select</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                       <span className="px-1.5 py-0.5 rounded bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] text-[8px] font-black text-[var(--color-text-muted)] shadow-sm">↑</span>
                       <span className="px-1.5 py-0.5 rounded bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] text-[8px] font-black text-[var(--color-text-muted)] shadow-sm">↓</span>
                    </div>
                    <span className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Navigate</span>
                  </div>
               </div>
               <div className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] italic opacity-50">CoreKnot Nexus Engine</div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CommandPalette;
