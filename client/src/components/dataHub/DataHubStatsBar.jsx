import React from 'react';
import { StatCard } from '../ui';
import { Database, TrendingUp, Star, UserX, Phone, Mail, ShoppingBag, Activity } from 'lucide-react';

const KPI_ICONS = {
  total: Database,
  newWeek: TrendingUp,
  loyal: Star,
  unsubRate: UserX,
  revenue: ShoppingBag,
  bookings: ShoppingBag,
  engaged: Mail,
  active: Activity,
  connected: Phone,
  conversion: TrendingUp,
  openRate: Mail,
  clickRate: Mail,
};

function formatKpiValue(kpi) {
  if (kpi.format === 'percent') return `${kpi.value}%`;
  if (kpi.format === 'currency') return `₹${Number(kpi.value).toLocaleString('en-IN')}`;
  return kpi.value;
}

export default function DataHubStatsBar({ folder, folderCounts = {}, analytics, total = 0 }) {
  const kpis = analytics?.kpis;

  if (kpis?.length) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {kpis.slice(0, 4).map((kpi) => (
          <StatCard
            key={kpi.key}
            label={kpi.label}
            value={formatKpiValue(kpi)}
            icon={KPI_ICONS[kpi.key] || Database}
            variant={kpi.key === 'unsubRate' || kpi.key === 'rate' ? 'rose' : kpi.key === 'loyal' || kpi.key === 'revenue' ? 'warning' : 'primary'}
          />
        ))}
      </div>
    );
  }

  const loyalCount = folderCounts.loyal ?? analytics?.loyalCount ?? 0;
  const newThisWeek = analytics?.newThisWeek ?? 0;
  const unsubCount = folderCounts.unsubscribed ?? 0;
  const unsubRate = total > 0 && folder === 'all'
    ? Math.round((unsubCount / total) * 100)
    : null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      <StatCard label={folder === 'all' ? 'Total People' : 'In Folder'} value={total} icon={Database} variant="primary" />
      <StatCard label="New This Week" value={newThisWeek} icon={TrendingUp} variant="mint" />
      <StatCard label="Loyal (2+ Inlets)" value={loyalCount} icon={Star} variant="warning" />
      {(folder === 'all' || folder === 'unsubscribed') && (
        <StatCard
          label={folder === 'unsubscribed' ? 'Unsubscribed' : 'Unsub Rate'}
          value={folder === 'unsubscribed' ? unsubCount : `${unsubRate ?? 0}%`}
          icon={UserX}
          variant="rose"
        />
      )}
    </div>
  );
}
