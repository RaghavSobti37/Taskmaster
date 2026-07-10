import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { DashboardWidgetShell, TimeframeFilter, Spinner } from '../ui';
import { Filter, TrendingUp, Users, Target, Activity } from 'lucide-react';
import { motion } from 'framer-motion';

function PipelineSummaryCard() {
  const [timeframe, setTimeframe] = React.useState('7d');

  const { data: stats, isLoading } = useQuery({
    queryKey: ['crm-stats', timeframe],
    queryFn: async () => (await axios.get(`/api/crm/stats?timeframe=${timeframe}`)).data
  });

  if (isLoading) {
    return (
      <DashboardWidgetShell
        className="h-full min-h-[300px]"
        bodyClassName="flex flex-col items-center justify-center flex-1"
        title="CRM Stats"
        icon={Filter}
      >
        <Spinner size="md" />
      </DashboardWidgetShell>
    );
  }

  const total = stats?.totalLeads || 0;
  const connected = stats?.connected || 0;
  const warm = (stats?.activeReach ?? stats?.meaningful ?? stats?.warmLeads) || 0;
  const converted = stats?.convertedLeads || 0;

  const connPct = total ? Math.round((connected / total) * 100) : 0;
  const warmPct = total ? Math.round((warm / total) * 100) : 0;
  const convPct = total ? Math.round((converted / total) * 100) : 0;

  const funnelStages = [
    { label: 'Total Leads', value: total, pct: 100, barColor: 'bg-blue-500/70', icon: Users },
    { label: 'Connected', value: connected, pct: connPct, barColor: 'bg-violet-500/70', icon: Activity },
    { label: 'Meaningful Connect', value: warm, pct: warmPct, barColor: 'bg-amber-500/70', icon: Target },
    { label: 'Converted', value: converted, pct: convPct, barColor: 'bg-emerald-500/70', icon: TrendingUp },
  ];

  return (
    <DashboardWidgetShell
      className="h-full min-h-[350px]"
      bodyClassName="p-6 flex flex-col flex-1"
      title="CRM Stats"
      icon={Filter}
      actions={<TimeframeFilter value={timeframe} onChange={setTimeframe} />}
    >
      <div className="flex-1 flex flex-col justify-center space-y-5">
        {funnelStages.map((stage, idx) => (
          <div key={stage.label} className="relative">
            <div className="flex items-center justify-between text-xs font-bold mb-2 px-1">
              <span className="text-[var(--color-text-primary)] flex items-center gap-2 uppercase tracking-wider">
                <stage.icon size={14} className="opacity-70" />
                {stage.label}
              </span>
              <div className="flex items-center gap-4">
                <span className="text-[var(--color-text-secondary)] tabular-nums">{stage.value.toLocaleString()}</span>
                <span className="text-right text-[var(--color-text-muted)] font-black tabular-nums" title="% of total leads">{stage.pct}% of total</span>
              </div>
            </div>
            <div className="h-3 w-full bg-[var(--color-bg-secondary)] overflow-hidden relative">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${stage.pct}%` }}
                transition={{ duration: 0.8, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className={`h-full ${stage.barColor}`}
              />
            </div>
          </div>
        ))}
      </div>
    </DashboardWidgetShell>
  );
}

export default PipelineSummaryCard;
