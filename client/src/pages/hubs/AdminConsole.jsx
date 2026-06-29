import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Database,
  BarChart2,
  Brackets,
  Trophy,
  BarChart3,
  Activity,
  Shield,
  Music,
  Newspaper,
  Layers,
  Building2,
  Settings2,
  History,
  ScrollText,
  ExternalLink,
} from 'lucide-react';
import { PageContainer, Badge } from '../../components/ui/primitives';
import PageHeader from '../../components/ui/PageHeader';
import { useAuth } from '../../contexts/AuthContext';
import { hasPageAccess } from '../../utils/pagePermissions';
import { HUB_CONFIG, ADMIN_CONSOLE_SECTIONS } from '../../utils/navbarConfig';
import { getRenderLogTarget, openRenderLogs } from '../../config/renderLogs';

const ICON_MAP = {
  Users,
  Database,
  BarChart2,
  Brackets,
  Trophy,
  BarChart3,
  Activity,
  Shield,
  Music,
  Newspaper,
  Layers,
  Building2,
  Settings2,
  History,
  ScrollText,
};

/** Icon chip tones — aligned with sidebar NAV_ICON_TONES palette. */
const ACCENT_STYLES = {
  blue: { chip: 'rgba(59, 130, 246, 0.18)', icon: '#60a5fa', border: 'rgba(59, 130, 246, 0.35)' },
  teal: { chip: 'rgba(20, 184, 166, 0.16)', icon: '#2dd4bf', border: 'rgba(20, 184, 166, 0.35)' },
  orange: { chip: 'rgba(245, 158, 11, 0.18)', icon: '#fbbf24', border: 'rgba(245, 158, 11, 0.45)' },
  purple: { chip: 'rgba(139, 92, 246, 0.16)', icon: '#a78bfa', border: 'rgba(139, 92, 246, 0.35)' },
  green: { chip: 'rgba(34, 197, 94, 0.18)', icon: '#4ade80', border: 'rgba(34, 197, 94, 0.35)' },
};

function AdminConsoleTile({ tile, onNavigate }) {
  const Icon = ICON_MAP[tile.icon] || Database;
  const accent = ACCENT_STYLES[tile.accent] || ACCENT_STYLES.teal;
  const isCaution = tile.riskLevel === 'caution';
  const pathLabel = tile.externalLogTarget
    ? 'Opens Render Dashboard'
    : tile.externalUrl
      ? 'Opens external link'
      : tile.path;

  return (
    <button
      type="button"
      onClick={() => onNavigate(tile)}
      className={[
        'relative text-left w-full p-4 rounded-[var(--radius-atomic)] border bg-[var(--color-bg-primary)]',
        'hover:bg-[var(--token-surface-2)] transition-colors group',
        isCaution
          ? 'border-[var(--color-bg-border)] border-l-[3px]'
          : 'border-[var(--color-bg-border)] hover:border-[var(--color-bg-border)]',
      ].join(' ')}
      style={isCaution ? { borderLeftColor: accent.border } : undefined}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
          style={{ backgroundColor: accent.chip, color: accent.icon }}
        >
          <Icon size={16} strokeWidth={2.1} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-action-primary)] transition-colors">
              {tile.label}
            </p>
            <div className="flex items-center gap-1.5 shrink-0">
              {isCaution && (
                <Badge variant="warning" className="!text-[9px] !px-1.5 !py-0">
                  Caution
                </Badge>
              )}
              {tile.externalUrl && (
                <ExternalLink size={12} className="text-[var(--color-text-muted)] opacity-60" aria-hidden />
              )}
              {tile.externalLogTarget && !tile.externalUrl && (
                <ExternalLink size={12} className="text-[var(--color-text-muted)] opacity-60" aria-hidden />
              )}
            </div>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 leading-snug">
            {tile.description}
          </p>
          <p className="text-[10px] text-[var(--color-text-muted)] font-mono mt-1.5 truncate">
            {pathLabel}
          </p>
        </div>
      </div>
    </button>
  );
}

export default function AdminConsole() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const hub = HUB_CONFIG['/admin/console'];

  const tilesBySection = useMemo(() => {
    const accessible = (hub?.tiles || []).filter((tile) => hasPageAccess(user, tile.key));
    const grouped = new Map(ADMIN_CONSOLE_SECTIONS.map((s) => [s.id, []]));

    for (const tile of accessible) {
      const sectionId = tile.section || 'operations';
      if (!grouped.has(sectionId)) grouped.set(sectionId, []);
      grouped.get(sectionId).push(tile);
    }

    return ADMIN_CONSOLE_SECTIONS.map((section) => ({
      ...section,
      tiles: grouped.get(section.id) || [],
    })).filter((section) => section.tiles.length > 0);
  }, [hub, user]);

  const handleNavigate = (tile) => {
    if (tile.externalLogTarget) {
      const target = getRenderLogTarget(tile.externalLogTarget);
      if (target?.url) openRenderLogs(target.url);
      return;
    }
    if (tile.externalUrl) {
      window.open(tile.externalUrl, '_blank', 'noopener,noreferrer');
    } else {
      navigate(tile.path);
    }
  };

  return (
    <PageContainer>
      <div className="space-y-8">
        <PageHeader
          icon={Shield}
          title="Admin Console"
          subtitle="System tools and data management"
        >
          <p className="text-xs text-[var(--color-text-muted)]">
            Grouped by function — high-risk tools are marked with caution.
          </p>
        </PageHeader>

        {tilesBySection.map((section) => (
          <section key={section.id} aria-labelledby={`admin-section-${section.id}`}>
            <h2
              id={`admin-section-${section.id}`}
              className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-3 px-0.5"
            >
              {section.label}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {section.tiles.map((tile) => (
                <AdminConsoleTile key={tile.id} tile={tile} onNavigate={handleNavigate} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </PageContainer>
  );
}
