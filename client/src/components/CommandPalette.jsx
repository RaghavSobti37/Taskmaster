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
  StickyNote,
  NotebookPen,
  Pin,
  Link2,
  Shield,
  Brackets,
  Building2,
  Settings2,
  ScrollText,
  Trophy,
  BarChart3,
  Music,
  Newspaper,
  Layers,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useStatusCounts } from '../hooks/useTaskmasterQueries';
import { useUnifiedSearch } from '../hooks/useUnifiedSearch';
import { getNavCountsForPath, totalNavBadge } from '../utils/navStatusCounts';
import { getDepartmentSlug, isAdminUser } from '../utils/departmentPermissions';
import { getDepartmentPaletteActions, getAdminConsolePaletteActions, QUICK_ACTIONS } from '../utils/commandPaletteActions';
import {
  canAccessNavPath,
  filterActionsByPageAccess,
  filterQuickActionsByPageAccess,
} from '../utils/navPageAccess';
import { hasPageAccess } from '../utils/pagePermissions';
import { resolvePaletteQuery } from '../utils/commandPaletteResolver';
import { useToast } from '../contexts/ToastContext';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useQuickAdd } from '../contexts/quickAddContextCore';
import { getGlobalGChordRoutes } from '../lib/keyboardShortcuts';
import { formatKeysForDisplay } from '../lib/shortcutBindingUtils';
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
  StickyNote,
  NotebookPen,
  Pin,
  Link2,
  Shield,
  Brackets,
  Building2,
  Settings2,
  ScrollText,
  Trophy,
  BarChart3,
  Music,
  Newspaper,
  Layers,
  Zap,
};

const SEARCH_TYPE_ICONS = {
  lead: UserPlus,
  contact: Users,
  task: CheckSquare,
  project: Briefcase,
  asset: FolderArchive,
};

const ICON_TONE_CLASSES = {
  emerald: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  blue: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  violet: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  cyan: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
  rose: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  slate: 'bg-[var(--token-surface-2)] text-[var(--color-text-muted)]',
};

const chordForPath = (path, gRoutes) => {
  const entry = Object.values(gRoutes || {}).find((r) => r.path === path);
  return entry?.chord;
};

function matchesQuery(item, q) {
  const haystack = `${item.label} ${item.sublabel || ''}`.toLowerCase();
  return haystack.includes(q);
}

function dedupeItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.id || item.path || item.label;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function Kbd({ children, className = '' }) {
  return (
    <span
      className={`inline-flex min-w-[20px] items-center justify-center rounded-md border border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)] px-1.5 py-0.5 text-[9px] font-black text-[var(--color-text-muted)] shadow-sm ${className}`}
    >
      {children}
    </span>
  );
}

const CommandPalette = () => {
  const { paletteOpen: isOpen, closePalette, bindingsMap } = useKeyboardShortcuts();
  const { runQuickAction } = useQuickAdd();
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);
  const toast = useToast();
  const { data: statusCounts = {} } = useStatusCounts(!!user);

  const gChordRoutes = useMemo(
    () => getGlobalGChordRoutes(bindingsMap, { isAdmin, user }),
    [bindingsMap, isAdmin, user]
  );

  const departmentSlug = getDepartmentSlug(user);
  const zeroStateActions = useMemo(
    () => filterActionsByPageAccess(getDepartmentPaletteActions(departmentSlug), user),
    [departmentSlug, user]
  );

  const quickActions = useMemo(
    () => filterQuickActionsByPageAccess(
      QUICK_ACTIONS.map((action) => {
        const binding = bindingsMap?.[`action-${action.quickActionId}`];
        return {
          ...action,
          shortcut: binding?.keys ? formatKeysForDisplay(binding.keys) : undefined,
        };
      }),
      user
    ),
    [bindingsMap, user]
  );

  const adminConsoleActions = useMemo(() => {
    if (!hasPageAccess(user, 'admin_console')) return [];
    return getAdminConsolePaletteActions(user);
  }, [user]);

  const { data: searchData, isFetching: searchLoading } = useUnifiedSearch(search, {
    enabled: false,
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
      shortcut: action.shortcut || (action.path ? chordForPath(action.path, gChordRoutes) : undefined),
    }));
  }, [zeroStateActions, statusCounts, gChordRoutes]);

  const searchResults = useMemo(() => {
    const results = searchData?.results || [];
    return results
      .filter((r) => !r.path || canAccessNavPath(user, r.path))
      .map((r) => ({
        id: `search-${r.type}-${r.id}`,
        label: r.label,
        sublabel: r.sublabel,
        path: r.path,
        type: r.type,
        source: 'search',
        icon: SEARCH_TYPE_ICONS[r.type] || Zap,
      }));
  }, [searchData, user]);

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

  const sections = useMemo(() => {
    const trimmed = search.trim();
    const q = trimmed.toLowerCase();

    if (trimmed) {
      const filteredQuick = q ? quickActions.filter((a) => matchesQuery(a, q)) : quickActions;
      const filteredNav = q ? navItems.filter((a) => matchesQuery(a, q)) : navItems;
      const filteredAdmin = q ? adminConsoleActions.filter((a) => matchesQuery(a, q)) : adminConsoleActions;
      const items = [];
      if (specialAction) items.push(specialAction);
      items.push(...filteredQuick, ...filteredAdmin, ...filteredNav);
      const deduped = dedupeItems(items);
      return deduped.length
        ? [{ id: 'results', title: 'Pages & actions', items: deduped }]
        : [];
    }

    return [
      { id: 'actions', title: 'Quick actions', items: quickActions },
      ...(adminConsoleActions.length
        ? [{ id: 'admin', title: 'Admin console', items: adminConsoleActions }]
        : []),
      {
        id: 'nav',
        title: departmentSlug ? `${departmentSlug} shortcuts` : 'Go to',
        items: navItems,
      },
    ];
  }, [search, quickActions, adminConsoleActions, navItems, specialAction, searchResults, departmentSlug]);

  const sectionsWithIndex = useMemo(() => {
    let idx = 0;
    return sections.map((section) => ({
      ...section,
      items: section.items.map((item) => {
        const withIndex = { ...item, flatIndex: idx };
        idx += 1;
        return withIndex;
      }),
    }));
  }, [sections]);

  const displayItems = useMemo(
    () => sectionsWithIndex.flatMap((section) => section.items),
    [sectionsWithIndex]
  );

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

    if (item.quickActionId) {
      runQuickAction(item.quickActionId);
      handleClosePalette();
      return;
    }

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
      if (!canAccessNavPath(user, item.path)) {
        toast.error('You do not have access to that page');
        return;
      }
      navigate(item.path);
      handleClosePalette();
    }
  }, [navigate, handleClosePalette, toast, runQuickAction, user]);

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
    const toneClass = ICON_TONE_CLASSES[item.iconTone] || ICON_TONE_CLASSES.slate;
    return (
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
          active ? 'ring-2 ring-[var(--color-action-primary)]/30' : ''
        } ${toneClass}`}
      >
        <Icon size={17} strokeWidth={2.25} />
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[2000] flex items-start justify-center pt-[12vh] px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClosePalette}
            className="absolute inset-0 bg-slate-950/40 dark:bg-slate-950/55"
          />

          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 16 }}
            transition={{ type: 'spring', damping: 28, stiffness: 340 }}
            className="tm-modal-panel tm-floating relative w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--color-bg-border)] bg-[var(--color-bg-floating)] shadow-2xl shadow-black/20"
          >
            <div className="relative border-b border-[var(--color-bg-border)] bg-gradient-to-b from-[var(--color-action-primary)]/[0.06] to-transparent px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-action-primary)]/10 text-[var(--color-action-primary)]">
                  <Search size={18} strokeWidth={2.25} />
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search or jump… task, daily log, lead, #asset"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={onKeyDown}
                  className="flex-1 bg-transparent border-none outline-none text-sm font-semibold text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
                />
                <div className="flex items-center gap-1 rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)] px-2 py-1 shadow-sm">
                  <Command size={11} className="text-[var(--color-text-muted)]" />
                  <span className="text-[10px] font-black text-[var(--color-text-muted)]">K</span>
                </div>
              </div>
            </div>

            <div className="max-h-[min(420px,55vh)] overflow-y-auto custom-scrollbar px-2 py-2">
              {searchLoading && search.trim().length >= 2 && (
                <p className="px-3 py-2 text-[10px] text-[var(--color-text-muted)]">Searching…</p>
              )}
              {displayItems.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="inline-flex p-3 rounded-2xl bg-[var(--token-surface-2)] mb-3">
                    <Zap size={28} className="text-[var(--color-text-muted)] opacity-30" />
                  </div>
                  <p className="text-[11px] font-bold text-[var(--color-text-muted)]">No matching commands</p>
                  <p className="mt-1 text-[10px] text-[var(--color-text-muted)]/80">Try “task”, “log”, or a person name</p>
                </div>
              ) : (
                sectionsWithIndex.map((section) => (
                    <div key={section.id} className="mb-1 last:mb-0">
                      {section.title && (
                        <p className="sticky top-0 z-10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-[var(--color-text-muted)] bg-[var(--color-bg-floating)]/95">
                          {section.title}
                        </p>
                      )}
                      <div className="space-y-0.5">
                        {section.items.map((item) => {
                          const active = item.flatIndex === activeIndex;
                          return (
                            <button
                              key={item.id || `${item.source}-${item.label}`}
                              type="button"
                              onMouseEnter={() => setActiveIndex(item.flatIndex)}
                              onClick={() => executeItem(item)}
                              className={`group w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-all ${
                                active
                                  ? 'bg-[var(--color-action-primary)]/[0.08] shadow-sm ring-1 ring-[var(--color-action-primary)]/20'
                                  : 'hover:bg-[var(--token-surface-2)]/80'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                {renderIcon(item, active)}
                                <div className="min-w-0 text-left">
                                  <span
                                    className={`text-sm font-semibold tracking-tight block truncate ${
                                      active ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'
                                    }`}
                                  >
                                    {item.label}
                                  </span>
                                  {item.sublabel && (
                                    <span className="text-[10px] text-[var(--color-text-muted)] truncate block mt-0.5">
                                      {item.sublabel}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {item.badge > 0 && (
                                  <CountBadge count={item.badge} size="md" variant="rose" />
                                )}
                                {item.shortcut && (
                                  <div className="flex gap-1 opacity-60 group-hover:opacity-100">
                                    {item.shortcut.split(' ').map((key, i) => (
                                      <Kbd key={i}>{key}</Kbd>
                                    ))}
                                  </div>
                                )}
                                {active && (
                                  <ArrowRight size={15} className="text-[var(--color-action-primary)]" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                ))
              )}
            </div>

            <div className="border-t border-[var(--color-bg-border)] bg-[var(--token-surface-2)]/40 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <Kbd>↵</Kbd>
                  <span className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide">Select</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex gap-0.5">
                    <Kbd>↑</Kbd>
                    <Kbd>↓</Kbd>
                  </div>
                  <span className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide">Move</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[8px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                <span><Kbd className="!text-[8px]">/</Kbd> search</span>
                <span><Kbd className="!text-[8px]">G T</Kbd> todo</span>
                <span><Kbd className="!text-[8px]">?</Kbd> shortcuts</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CommandPalette;
