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
} from 'lucide-react';
import { PageContainer } from '../../components/ui/primitives';
import { useAuth } from '../../contexts/AuthContext';
import { hasPageAccess } from '../../utils/pagePermissions';
import { HUB_CONFIG } from '../../utils/navbarConfig';

const ICON_MAP = {
  Users,
  Database,
  BarChart2,
  Brackets,
  Trophy,
  BarChart3,
  Activity,
};

export default function AdminConsole() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const hub = HUB_CONFIG['/admin/console'];

  const tiles = useMemo(
    () => (hub?.tiles || []).filter((tile) => hasPageAccess(user, tile.key)),
    [hub, user]
  );

  return (
    <PageContainer>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-[var(--radius-atomic)] bg-[var(--color-action-primary)]/10 text-[var(--color-action-primary)] border border-[var(--color-action-primary)]/10">
            <Shield size={18} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[var(--color-text-primary)]">Admin Console</h1>
            <p className="text-xs text-[var(--color-text-muted)]">System tools and data management</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {tiles.map((tile) => {
            const Icon = ICON_MAP[tile.icon] || Database;
            return (
              <button
                key={tile.id}
                type="button"
                onClick={() => navigate(tile.path)}
                className="text-left p-4 rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] hover:border-[var(--color-action-primary)]/40 hover:bg-[var(--token-surface-2)] transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--color-action-primary)]/10 text-[var(--color-action-primary)] shrink-0">
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-action-primary)] transition-colors">
                      {tile.label}
                    </p>
                    <p className="text-[11px] text-[var(--color-text-muted)] font-mono mt-0.5 truncate">
                      {tile.path}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </PageContainer>
  );
}
