import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown, Mail, Plus, LayoutDashboard, FileCode, Zap, BarChart2, Newspaper,
} from 'lucide-react';
import { Button } from './primitives';
import ModuleSubnav from './ModuleSubnav';

/** Shared demo data — mirrors Email hub density (6 items + action). */
export const SUBNAV_DEMO_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'campaigns', label: 'Campaigns', icon: Mail },
  { id: 'templates', label: 'Templates', icon: FileCode },
  { id: 'profiles', label: 'Profiles', icon: Zap },
  { id: 'analytics', label: 'Analytics', icon: BarChart2 },
  { id: 'newsletter', label: 'Newsletter', icon: Newspaper },
];

function DemoAction({ compact = false }) {
  return (
    <Button size="sm" className="shrink-0">
      <Plus size={14} />
      {!compact && <span>Create</span>}
    </Button>
  );
}

function useDemoTabs(initial = 'overview') {
  const [activeId, setActiveId] = useState(initial);
  return { activeId, setActiveId, items: SUBNAV_DEMO_ITEMS };
}

/** Option A — underline tabs (Notion / GitHub). No pill box. */
export function SubnavVariantUnderline({ activeId, onChange, items = SUBNAV_DEMO_ITEMS }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end gap-3 min-w-0 border-b border-[var(--color-bg-border)]">
      <nav
        aria-label="Section navigation"
        className="flex gap-1 overflow-x-auto custom-scrollbar min-w-0 flex-1 -mb-px"
      >
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={`px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap shrink-0 border-b-2 transition-colors ${
                active
                  ? 'border-[var(--color-action-primary)] text-[var(--color-text-primary)]'
                  : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-bg-border)]'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="pb-2 shrink-0 self-start sm:self-auto">
        <DemoAction />
      </div>
    </div>
  );
}

/** Option B — ghost chips (no segmented track). */
export function SubnavVariantGhostChips({ activeId, onChange, items = SUBNAV_DEMO_ITEMS }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
      <nav
        aria-label="Section navigation"
        className="flex flex-wrap gap-1.5 min-w-0 flex-1"
      >
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                active
                  ? 'bg-[var(--color-action-primary)]/15 text-[var(--color-action-primary)] ring-1 ring-[var(--color-action-primary)]/25'
                  : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
      <DemoAction />
    </div>
  );
}

/** Option C — icon dock (labels under icons, very compact). */
export function SubnavVariantIconDock({ activeId, onChange, items = SUBNAV_DEMO_ITEMS }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/50 px-2 py-2">
      <nav
        aria-label="Section navigation"
        className="flex gap-0.5 overflow-x-auto custom-scrollbar min-w-0 flex-1"
      >
        {items.map((item) => {
          const active = item.id === activeId;
          const Icon = item.icon || Mail;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              title={item.label}
              className={`flex flex-col items-center gap-0.5 min-w-[3.25rem] px-2 py-1.5 rounded-lg transition-colors shrink-0 ${
                active
                  ? 'bg-[var(--color-bg-primary)] text-[var(--color-action-primary)] shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-primary)]/60'
              }`}
            >
              <Icon size={16} strokeWidth={active ? 2.5 : 2} />
              <span className="text-[8px] font-bold uppercase tracking-wide truncate max-w-[3rem]">
                {item.label.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </nav>
      <DemoAction compact />
    </div>
  );
}

/** Option D — merged toolbar (title + tabs + action in one row). */
export function SubnavVariantMergedToolbar({ activeId, onChange, items = SUBNAV_DEMO_ITEMS }) {
  return (
    <ModuleSubnav
      title="Emails"
      titleIcon={Mail}
      items={items}
      mode="tabs"
      activeId={activeId}
      onTabChange={onChange}
      ariaLabel="Section navigation"
      action={{ label: 'Create', icon: Plus, onClick: () => {} }}
    />
  );
}

/** Option E — section switcher (current label + dropdown for rest). */
export function SubnavVariantSectionSwitcher({ activeId, onChange, items = SUBNAV_DEMO_ITEMS }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const active = items.find((i) => i.id === activeId) || items[0];
  const quickIds = new Set(['overview', 'campaigns', 'templates']);
  const quick = items.filter((i) => quickIds.has(i.id));
  const overflow = items.filter((i) => !quickIds.has(i.id));

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
      <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
        <div className="relative" ref={rootRef}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-2 h-9 pl-3 pr-2 rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-primary)] hover:border-[var(--color-action-primary)]/40 transition-colors"
          >
            {active.label}
            <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <div className="absolute left-0 top-full z-20 mt-1 min-w-[10rem] py-1 rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] shadow-lg">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onChange(item.id);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wide transition-colors ${
                    item.id === activeId
                      ? 'bg-[var(--color-action-primary)]/10 text-[var(--color-action-primary)]'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="hidden sm:inline text-[var(--color-text-muted)] text-xs">·</span>
        <nav aria-label="Quick sections" className="hidden sm:flex items-center gap-1">
          {overflow.map((item) => {
            const isActive = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange(item.id)}
                className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-colors ${
                  isActive
                    ? 'text-[var(--color-action-primary)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
        <nav aria-label="Quick sections mobile" className="flex sm:hidden gap-1 overflow-x-auto custom-scrollbar">
          {quick.filter((i) => i.id !== activeId).slice(0, 2).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className="px-2 py-1 text-[10px] font-bold uppercase text-[var(--color-text-muted)]"
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>
      <DemoAction />
    </div>
  );
}

const VARIANT_META = [
  {
    id: 'underline',
    name: 'A — Underline tabs',
    blurb: 'Text tabs with bottom accent. No pill box — clean, familiar (Notion/GitHub).',
    Component: SubnavVariantUnderline,
    initialTab: 'overview',
  },
  {
    id: 'ghost-chips',
    name: 'B — Ghost chips',
    blurb: 'Floating rounded chips, no outer track. Airy; wraps on wide screens.',
    Component: SubnavVariantGhostChips,
    initialTab: 'overview',
  },
  {
    id: 'icon-dock',
    name: 'C — Icon dock',
    blurb: 'Icon + micro-label in a shallow tray. Dense when you have 6+ sections.',
    Component: SubnavVariantIconDock,
    initialTab: 'overview',
  },
  {
    id: 'merged-toolbar',
    name: 'D — Merged toolbar',
    blurb: 'Module title, tabs, and action on one row — saves a full header line.',
    Component: SubnavVariantMergedToolbar,
    initialTab: 'campaigns',
  },
  {
    id: 'section-switcher',
    name: 'E — Section switcher',
    blurb: 'Dropdown for current section + inline shortcuts. Best when list is long.',
    Component: SubnavVariantSectionSwitcher,
    initialTab: 'overview',
  },
];

function VariantDemoCard({ name, blurb, Component, initialTab }) {
  const { activeId, setActiveId, items } = useDemoTabs(initialTab);

  return (
    <div className="rounded-xl border border-[var(--color-bg-border)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/40">
        <p className="text-xs font-black uppercase tracking-widest text-[var(--color-text-primary)]">
          {name}
        </p>
        <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">{blurb}</p>
      </div>
      <div className="p-4 bg-[var(--color-bg-primary)]">
        <Component activeId={activeId} onChange={setActiveId} items={items} />
        <div className="mt-4 pt-4 border-t border-dashed border-[var(--color-bg-border)]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
            Preview content — {activeId}
          </p>
          <div className="h-16 rounded-lg bg-[var(--color-bg-secondary)]/60 border border-[var(--color-bg-border)] flex items-center justify-center text-xs text-[var(--color-text-muted)]">
            Page body uses full width below subnav
          </div>
        </div>
      </div>
    </div>
  );
}

/** Interactive gallery for /components — pick a winner to ship in ModuleSubnav. */
export default function ModuleSubnavShowcase() {
  return (
    <div className="space-y-6">
      {VARIANT_META.map((variant) => (
        <VariantDemoCard key={variant.id} {...variant} />
      ))}
    </div>
  );
}
