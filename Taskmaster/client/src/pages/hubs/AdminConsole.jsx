import React, { useMemo, useState, useCallback } from 'react';
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
  ChevronDown,
  ChevronRight,
  UserPlus,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { PageContainer, Badge } from '../../components/ui/primitives';
import PageHeader from '../../components/ui/PageHeader';
import DataOverviewSection from '../../components/ui/DataOverviewSection';
import DataListRow from '../../components/ui/DataListRow';
import { useAuth } from '../../contexts/AuthContext';
import { hasPageAccess } from '../../utils/pagePermissions';
import { HUB_CONFIG, ADMIN_CONSOLE_SECTIONS } from '../../utils/navbarConfig';
import { FEATURE_UNLOCK_BY_PATH } from '../../utils/navPageAccess';
import { useTenantUnlocks } from '../../hooks/useTenantUnlocks';
import { useAdminConsoleSummary } from '../../hooks/useAdminConsoleSummary';
import { getRenderLogTarget, openRenderLogs } from '../../config/renderLogs';
import { formatDisplayDateTime } from '../../utils/dateDisplay';

const SECTION_COLLAPSE_KEY = 'admin-console-sections-collapsed';

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

const ACCENT_STYLES = {
  blue: { chip: 'rgba(59, 130, 246, 0.18)', icon: '#60a5fa', border: 'rgba(59, 130, 246, 0.35)' },
  teal: { chip: 'rgba(20, 184, 166, 0.16)', icon: '#2dd4bf', border: 'rgba(20, 184, 166, 0.35)' },
  orange: { chip: 'rgba(245, 158, 11, 0.18)', icon: '#fbbf24', border: 'rgba(245, 158, 11, 0.45)' },
  purple: { chip: 'rgba(139, 92, 246, 0.16)', icon: '#a78bfa', border: 'rgba(139, 92, 246, 0.35)' },
  green: { chip: 'rgba(34, 197, 94, 0.18)', icon: '#4ade80', border: 'rgba(34, 197, 94, 0.35)' },
};

function readCollapsedSections() {
  try {
    const raw = localStorage.getItem(SECTION_COLLAPSE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function formatActivityTime(ts) {
  if (!ts) return '';
  return formatDisplayDateTime(ts, { emptyLabel: '' });
}

function AdminConsoleTile({ tile, setupStatus, onNavigate }) {
  const Icon = ICON_MAP[tile.icon] || Database;
  const accent = ACCENT_STYLES[tile.accent] || ACCENT_STYLES.teal;
  const isCaution = tile.riskLevel === 'caution';
  const isPlatform = tile.platformAdmin;
  const needsSetup = tile.setupRequiredKey === 'sso' && setupStatus && !setupStatus.ssoConfigured;
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
        'hover:bg-[var(--token-surface-2)] transition-colors group overflow-hidden',
        isCaution ? 'border-[var(--color-bg-border)] border-l-[3px]' : 'border-[var(--color-bg-border)]',
      ].join(' ')}
      style={isCaution ? { borderLeftColor: accent.border } : undefined}
    >
      {isPlatform && (
        <div
          className="absolute top-0 left-0 right-0 h-0.5 bg-amber-500/80"
          aria-hidden
          title="Platform-wide tool"
        />
      )}
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
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
              {needsSetup && (
                <Badge variant="neutral" className="!text-[9px] !px-1.5 !py-0">
                  Setup required
                </Badge>
              )}
              {isCaution && (
                <Badge variant="warning" className="!text-[9px] !px-1.5 !py-0">
                  Caution
                </Badge>
              )}
              {(tile.externalUrl || tile.externalLogTarget) && (
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
  const { isFeatureUnlocked } = useTenantUnlocks();
  const { data: summary } = useAdminConsoleSummary(hasPageAccess(user, 'admin_console'));
  const hub = HUB_CONFIG['/admin/console'];

  const [collapsed, setCollapsed] = useState(readCollapsedSections);

  const toggleSection = useCallback((sectionId) => {
    setCollapsed((prev) => {
      const next = { ...prev, [sectionId]: !prev[sectionId] };
      try {
        localStorage.setItem(SECTION_COLLAPSE_KEY, JSON.stringify(next));
      } catch { /* ponytail: localStorage optional */ }
      return next;
    });
  }, []);

  const tilesBySection = useMemo(() => {
    const accessible = (hub?.tiles || []).filter((tile) => {
      if (!hasPageAccess(user, tile.key)) return false;
      const unlockKey = FEATURE_UNLOCK_BY_PATH[tile.path];
      if (unlockKey && !isFeatureUnlocked(unlockKey)) {
        if (unlockKey === 'dataHub' && hasPageAccess(user, 'admin_data')) return true;
        return false;
      }
      return true;
    });
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
  }, [hub, user, isFeatureUnlocked]);

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

  const ribbonStats = useMemo(() => {
    if (!summary) return [];
    const queueVariant = summary.queueHealth?.status === 'healthy'
      ? 'mint'
      : summary.queueHealth?.status === 'hidden'
        ? 'slate'
        : 'apricot';
    return [
      {
        id: 'members',
        label: 'Active members',
        value: summary.activeMembers ?? '—',
        icon: Users,
        variant: 'info',
      },
      {
        id: 'invites',
        label: 'Pending invites',
        value: summary.pendingInvites ?? '—',
        icon: UserPlus,
        variant: summary.pendingInvites > 0 ? 'apricot' : 'slate',
      },
      {
        id: 'security',
        label: 'Security findings (7d)',
        value: summary.recentSecurityFindings ?? '—',
        icon: AlertTriangle,
        variant: summary.recentSecurityFindings > 0 ? 'apricot' : 'mint',
      },
      {
        id: 'queues',
        label: 'Queue health',
        value: summary.queueHealth?.label || '—',
        icon: Activity,
        variant: queueVariant,
      },
    ];
  }, [summary]);

  const setupStatus = summary?.setupStatus;

  return (
    <PageContainer>
      <div className="space-y-8">
        <PageHeader
          icon={Shield}
          title="Admin Console"
          subtitle="System tools and data management"
        >
          <p className="text-xs text-[var(--color-text-muted)]">
            Grouped by function — platform-wide tools have an amber top strip; high-risk tiles show caution.
          </p>
        </PageHeader>

        {ribbonStats.length > 0 && (
          <DataOverviewSection stats={ribbonStats} mobileCollapsed={false} eagerCharts />
        )}

        {summary?.recentActivity?.length > 0 && (
          <section aria-labelledby="admin-recent-activity">
            <h2
              id="admin-recent-activity"
              className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-3 px-0.5"
            >
              Recent admin activity
            </h2>
            <div className="rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] overflow-hidden divide-y divide-[var(--color-bg-border)]">
              {summary.recentActivity.slice(0, 8).map((row) => (
                <DataListRow
                  key={row.id}
                  leading={<History size={14} className="text-[var(--color-text-muted)]" />}
                  primary={(
                    <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                      {row.action}
                      {row.resourceType ? (
                        <span className="text-[var(--color-text-muted)] font-normal">
                          {' '}
                          ·
                          {' '}
                          {row.resourceType}
                        </span>
                      ) : null}
                    </p>
                  )}
                  secondary={(
                    <p className="text-[10px] text-[var(--color-text-muted)] truncate">
                      {row.actorEmail || 'System'}
                    </p>
                  )}
                  trailing={(
                    <span className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-1 shrink-0">
                      <Clock size={10} aria-hidden />
                      {formatActivityTime(row.timestamp)}
                    </span>
                  )}
                />
              ))}
            </div>
          </section>
        )}

        {tilesBySection.map((section) => {
          const isCollapsed = !!collapsed[section.id];
          return (
            <section key={section.id} aria-labelledby={`admin-section-${section.id}`}>
              <button
                type="button"
                id={`admin-section-${section.id}`}
                onClick={() => toggleSection(section.id)}
                className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-3 px-0.5 hover:text-[var(--color-text-secondary)] w-full text-left"
                aria-expanded={!isCollapsed}
              >
                {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                {section.label}
                <span className="font-normal normal-case tracking-normal text-[var(--color-text-muted)]">
                  ({section.tiles.length})
                </span>
              </button>
              {!isCollapsed && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {section.tiles.map((tile) => (
                    <AdminConsoleTile
                      key={tile.id}
                      tile={tile}
                      setupStatus={setupStatus}
                      onNavigate={handleNavigate}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </PageContainer>
  );
}

