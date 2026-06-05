import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Command,
  ArrowRight,
  LayoutDashboard,
  Briefcase,
  UserPlus,
  CalendarDays,
  Settings,
  ListTodo,
  Inbox,
  Zap,
  PhoneCall,
  Users,
  Database,
  Activity,
  CircleDollarSign,
  FileText,
  FolderArchive,
  CheckSquare,
  ClipboardCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useStatusCounts } from '../hooks/useTaskmasterQueries';
import { useUnifiedSearch } from '../hooks/useUnifiedSearch';
import { getNavCountsForPath, totalNavBadge } from '../utils/navStatusCounts';
import { getDepartmentSlug } from '../utils/departmentPermissions';
import { getDepartmentPaletteActions } from '../utils/commandPaletteActions';
import { resolvePaletteQuery } from '../utils/commandPaletteResolver';
import { useToast } from '../contexts/ToastContext';
import { useKeyboardShortcuts } from '../contexts/KeyboardShortcutsContext';
import { GLOBAL_G_CHORD_ROUTES } from '../lib/keyboardShortcuts';
import CountBadge from './ui/CountBadge';

const ICON_MAP = {
  LayoutDashboard,
  Briefcase,
  UserPlus,
  CalendarDays,
  Settings,
  ListTodo,
  Inbox,
  PhoneCall,
  Users,
  Database,
  Activity,
  CircleDollarSign,
  FileText,
  FolderArchive,
  CheckSquare,
  ClipboardCheck,
  Zap,
};

const SEARCH_TYPE_ICONS = {
  lead: UserPlus,
  contact: Users,
  task: CheckSquare,
  project: Briefcase,
  asset: FolderArchive,
};

const chordForPath = (path) => {
  const entry = Object.values(GLOBAL_G_CHORD_ROUTES).find((r) => r.path === path);
  return entry?.chord;
};

const CommandPalette = () => {
  const { paletteOpen: isOpen, closePalette } = useKeyboardShortcuts();
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const { user } = useAuth();
  const toast = useToast();
  const { data: statusCounts = {} } = useStatusCounts(!!user);

  const departmentSlug = getDepartmentSlug(user);
  const zeroStateActions = useMemo(
    () => getDepartmentPaletteActions(departmentSlug),
    [departmentSlug]
  );

  const { data: searchData, isFetching: searchLoading } = useUnifiedSearch(search, {
    enabled: isOpen && !!user,
  });

  const badgeFor = (path) => {
    const { count, todayCount } = getNavCountsForPath(path, statusCounts);
    return totalNavBadge(count, todayCount);
  };

  const navItems = useMemo(() => {
    return zeroStateActions.map((action) => ({
      ...action,
      source: 'nav',
      badge: action.path ? badgeFor(action.path) : 0,
      shortcut: action.shortcut || (action.path ? chordForPath(action.path) : undefined),
    }));
  }, [zeroStateActions, statusCounts]);

  const searchResults = useMemo(() => {
    const results = searchData?.results || [];
    return results.map((r) => ({
      id: `search-${r.type}-${r.id}`,
      label: r.label,
      sublabel: r.sublabel,
      path: r.path,
      type: r.type,
      source: 'search',
      icon: SEARCH_TYPE_ICONS[r.type] || Zap,
    }));
  }, [searchData]);

  const resolved = useMemo(() => resolvePaletteQuery(search), [search]);

  const specialAction = useMemo(() => {
    if (resolved.kind === 'note' && resolved.note) {
      return {
        id: 'add-note',
        label: `Add note: ${resolved.note.title}`,
        source: 'action',
        icon: FileText,
        kind: 'note',
        note: resolved.note,
      };
    }
    if (resolved.kind === 'asset' && resolved.path) {
      return {
        id: 'open-asset',
        label: `Open asset ${resolved.assetId?.slice(0, 8)}…`,
        source: 'action',
        icon: FolderArchive,
        path: resolved.path,
      };
    }
    if (resolved.kind === 'task' && resolved.path) {
      return {
        id: 'open-task',
        label: `Open task ${resolved.taskId?.slice(0, 8)}…`,
        source: 'action',
        icon: CheckSquare,
        path: resolved.path,
      };
    }
    return null;
  }, [resolved]);

  const filteredNav = useMemo(() => {
    if (!search.trim()) return navItems;
    const q = search.toLowerCase();
    return navItems.filter((a) => a.label.toLowerCase().includes(q));
  }, [navItems, search]);

  const displayItems = useMemo(() => {
    const items = [];
    if (specialAction) items.push(specialAction);
    if (search.trim().length >= 2) {
      items.push(...searchResults);
    }
    if (!search.trim() || filteredNav.length) {
      if (search.trim()) {
        items.push(...filteredNav);
      } else if (!specialAction) {
        items.push(...navItems);
      }
    }
    const seen = new Set();
    return items.filter((item) => {
      const key = item.id || item.path || item.label;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [specialAction, searchResults, filteredNav, navItems, search]);

  useEffect(() => {
    setActiveIndex(0);
  }, [search, displayItems.length]);

  const handleClosePalette = useCallback(() => {
    closePalette();
    setSearch('');
    setActiveIndex(0);
  }, [closePalette]);

  const executeItem = useCallback(async (item) => {
    if (!item) return;

    if (item.kind === 'note' && item.note) {
      try {
        const { saveNoteDraft } = await import('../utils/noteDraftStorage');
        saveNoteDraft('new', {
          title: item.note.title,
          content: item.note.content,
          format: 'plain',
        });
        navigate('/notes');
        handleClosePalette();
      } catch (err) {
        toast.error('Failed to open note editor');
      }
      return;
    }

    if (item.path) {
      navigate(item.path);
      handleClosePalette();
    }
  }, [navigate, handleClosePalette, toast]);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (displayItems.length ? (prev + 1) % displayItems.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (displayItems.length ? (prev - 1 + displayItems.length) % displayItems.length : 0));
    } else if (e.key === 'Enter') {
      if (displayItems[activeIndex]) {
        executeItem(displayItems[activeIndex]);
      }
    }
  };

  const renderIcon = (item, active) => {
    const Icon = typeof item.icon === 'string' ? (ICON_MAP[item.icon] || Zap) : (item.icon || Zap);
    return (
      <div className={`p-2 rounded-[var(--radius-atomic)] ${active ? 'bg-[var(--token-surface-1)]' : 'bg-[var(--token-surface-2)]'}`}>
        <Icon size={18} />
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[2000] flex items-start justify-center pt-[15vh] px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClosePalette}
            className="absolute inset-0 bg-slate-950/35 dark:bg-slate-950/50 backdrop-blur-md"
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="tm-modal-panel tm-floating max-w-2xl relative w-full bg-[var(--color-bg-floating)] border border-[var(--color-bg-border)] rounded-[var(--radius-lg)] shadow-2xl overflow-hidden"
          >
            <div className="flex items-center px-6 py-5 border-b border-[var(--color-bg-border)] bg-[var(--token-surface-2)]/50">
              <Search className="text-[var(--color-text-muted)] mr-4" size={20} />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search commands, leads, tasks… (try: add note …, #asset-id)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={onKeyDown}
                className="flex-1 bg-transparent border-none outline-none text-base font-bold text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]"
              />
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--token-surface-1)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)]">
                <Command size={12} className="text-[var(--color-text-muted)]" />
                <span className="text-[10px] font-black text-[var(--color-text-muted)]">K</span>
              </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto custom-scrollbar p-3 space-y-1">
              {!search.trim() && (
                <p className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                  {departmentSlug ? `${departmentSlug} shortcuts` : 'Quick navigation'}
                </p>
              )}
              {searchLoading && search.trim().length >= 2 && (
                <p className="px-3 py-2 text-[10px] text-[var(--color-text-muted)]">Searching…</p>
              )}
              {displayItems.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="inline-flex p-4 rounded-full bg-[var(--token-surface-2)] mb-4">
                    <Zap size={32} className="text-[var(--color-text-muted)] opacity-20" />
                  </div>
                  <p className="text-[11px] font-black uppercase text-[var(--color-text-muted)] tracking-widest">No matching commands found</p>
                </div>
              ) : (
                displayItems.map((item, idx) => {
                  const active = idx === activeIndex;
                  return (
                    <button
                      key={item.id || `${item.source}-${item.label}`}
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => executeItem(item)}
                      className={`w-full flex items-center justify-between px-5 py-3 rounded-[var(--radius-atomic)] transition-colors ${
                        active
                          ? 'bg-[var(--token-surface-2)] text-[var(--color-text-primary)] border-l-[2px] border-[var(--token-brand-accent)]'
                          : 'hover:bg-[var(--token-surface-2)]/60 text-[var(--color-text-secondary)] border-l-[2px] border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        {renderIcon(item, active)}
                        <div className="min-w-0 text-left">
                          <span className="text-sm font-semibold tracking-tight block truncate">{item.label}</span>
                          {item.sublabel && (
                            <span className="text-[10px] text-[var(--color-text-muted)] truncate block">{item.sublabel}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        {item.badge > 0 && (
                          <CountBadge count={item.badge} size="md" variant="rose" />
                        )}
                        {item.shortcut && (
                          <div className="flex gap-1 opacity-50">
                            {item.shortcut.split(' ').map((key, i) => (
                              <span
                                key={i}
                                className="min-w-[20px] px-1.5 py-0.5 rounded-md border text-[9px] font-black flex items-center justify-center bg-[var(--token-surface-1)] border-[var(--color-bg-border)] text-[var(--color-text-muted)]"
                              >
                                {key}
                              </span>
                            ))}
                          </div>
                        )}
                        {active && <ArrowRight size={16} />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="px-6 py-4 border-t border-[var(--color-bg-border)] bg-[var(--token-surface-2)]/30 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-[var(--token-surface-1)] border border-[var(--color-bg-border)] text-[8px] font-black text-[var(--color-text-muted)]">ENTER</span>
                  <span className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Select</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="px-1.5 py-0.5 rounded bg-[var(--token-surface-1)] border border-[var(--color-bg-border)] text-[8px] font-black text-[var(--color-text-muted)]">↑</span>
                    <span className="px-1.5 py-0.5 rounded bg-[var(--token-surface-1)] border border-[var(--color-bg-border)] text-[8px] font-black text-[var(--color-text-muted)]">↓</span>
                  </div>
                  <span className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Navigate</span>
                </div>
              </div>
              <div className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] opacity-50 hidden sm:block">
                / search · G T todo · G H data hub · ? all shortcuts
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CommandPalette;
