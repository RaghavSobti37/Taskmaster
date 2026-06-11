import React, { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard,
  BarChart3,
  CalendarDays,
  Briefcase,
  IndianRupee,
  FileImage,
  Disc,
  FileText,
  Users,
  Settings,
  Menu,
  X,
  ExternalLink,
  Link2,
} from 'lucide-react';
import BrandLogo from '../../../components/brand/BrandLogo';
import { useArtist } from '../../../hooks/useTaskmasterQueries';
import { useArtistMembership } from '../../../hooks/queries/artistMembers';
import { canSeeWorkspaceTab, DEFAULT_PERMISSIONS_BY_ROLE } from '../../../utils/artistMemberPermissions';
import { isArtistManagerUser } from '../../../utils/pagePermissions';
import { useAuth } from '../../../contexts/AuthContext';
import { ARTIST_WORKSPACE_NAV, DEFAULT_WORKSPACE_TAB } from './artistWorkspaceConstants';

const NAV_ICONS = {
  home: LayoutDashboard,
  analytics: BarChart3,
  bookings: Briefcase,
  calendar: CalendarDays,
  finance: IndianRupee,
  content: FileImage,
  connections: Link2,
  releases: Disc,
  documents: FileText,
  team: Users,
  settings: Settings,
};

export default function ArtistWorkspaceShell({ children }) {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { data: artist } = useArtist(id, !!id);
  const { data: membership } = useArtistMembership(id);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isManager = isArtistManagerUser(user);
  const effectiveMembership = useMemo(() => {
    if (membership) return membership;
    if (isManager) {
      return {
        role: 'artist-manager',
        permissions: DEFAULT_PERMISSIONS_BY_ROLE['artist-manager'],
        managerOverride: true,
      };
    }
    return null;
  }, [membership, isManager]);

  const activeTab = searchParams.get('tab') || DEFAULT_WORKSPACE_TAB;

  const visibleNav = useMemo(
    () => ARTIST_WORKSPACE_NAV.filter((item) => canSeeWorkspaceTab(effectiveMembership, item.id)),
    [effectiveMembership],
  );

  const tabHref = (tabId) => `/artist-workspace/${id}?tab=${tabId}`;

  const sidebar = (
    <nav className="flex flex-col gap-0.5 p-3" aria-label="Artist workspace">
      {visibleNav.map((item) => {
        const Icon = NAV_ICONS[item.id] || LayoutDashboard;
        const active = activeTab === item.id;
        return (
          <Link
            key={item.id}
            to={tabHref(item.id)}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
              active
                ? 'bg-[var(--color-action-primary)]/10 text-[var(--color-action-primary)] border border-[var(--color-action-primary)]/20'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--token-surface-2)]'
            }`}
          >
            <Icon size={16} strokeWidth={2.25} />
            {item.label}
          </Link>
        );
      })}
      {isManager && (
        <Link
          to={`/artists/${id}`}
          className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] border border-dashed border-[var(--color-bg-border)]"
        >
          <ExternalLink size={14} />
          Staff view
        </Link>
      )}
    </nav>
  );

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg-workspace)]">
      <header className="shrink-0 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            className="lg:hidden p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--token-surface-2)]"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <BrandLogo size={28} />
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
              Artist Workspace
            </p>
            <h1 className="text-sm font-black text-[var(--color-text-primary)] truncate">
              {artist?.name || 'Loading…'}
            </h1>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside
          className={`${
            mobileOpen ? 'fixed inset-0 top-[57px] z-40 bg-[var(--color-bg-workspace-sidebar)] lg:static lg:inset-auto' : 'hidden'
          } lg:flex lg:w-[200px] xl:w-[220px] shrink-0 border-r border-[var(--color-bg-border)] bg-[var(--color-bg-workspace-sidebar)] flex-col overflow-y-auto`}
        >
          {sidebar}
        </aside>

        <main className="flex-1 min-w-0 overflow-y-auto px-4 sm:px-6 py-4 custom-scrollbar">
          <div className="max-w-6xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
