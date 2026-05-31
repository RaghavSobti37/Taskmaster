import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Card, TimeframeFilter } from '../ui';
import { Filter, TrendingUp, Users, Target, Activity } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PipelineSummaryCard() {
  const [timeframe, setTimeframe] = React.useState('7d');

  const { data: stats, isLoading } = useQuery({
    queryKey: ['crm-stats', timeframe],
    queryFn: async () => (await axios.get(`/api/crm/stats?timeframe=${timeframe}`)).data
  });

  if (isLoading) {
    return (
      <Card className="h-full p-5 flex flex-col items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </Card>
    );
  }

  // Safe defaults
  const total = stats?.totalLeads || 0;
  const connected = stats?.connected || 0;
  const warm = stats?.warmLeads || 0;
  const converted = stats?.convertedLeads || 0;

  // Calculate percentages relative to total
  const connPct = total ? Math.round((connected / total) * 100) : 0;
  const warmPct = total ? Math.round((warm / total) * 100) : 0;
  const convPct = total ? Math.round((converted / total) * 100) : 0;

  const funnelStages = [
    { label: 'Total Leads', value: total, pct: 100, color: 'from-blue-500 to-cyan-400', shadow: 'shadow-blue-500/20', icon: Users },
    { label: 'Connected', value: connected, pct: connPct, color: 'from-purple-500 to-indigo-400', shadow: 'shadow-purple-500/20', icon: Activity },
    { label: 'Warm Leads', value: warm, pct: warmPct, color: 'from-amber-500 to-orange-400', shadow: 'shadow-amber-500/20', icon: Target },
    { label: 'Converted', value: converted, pct: convPct, color: 'from-emerald-500 to-green-400', shadow: 'shadow-emerald-500/20', icon: TrendingUp },
  ];

  return (
    <Card className="h-full p-6 flex flex-col relative overflow-hidden bg-gradient-to-br from-[var(--color-bg-primary)] to-[var(--color-bg-workspace)] border-0 ring-1 ring-[var(--color-bg-border)] min-h-[350px]">
      {/* Background glow */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center justify-between mb-8 relative z-10">
        <h3 className="text-sm font-black text-[var(--color-text-primary)] flex items-center gap-2 uppercase tracking-widest">
          <Filter size={16} className="text-blue-500" /> CRM Stats
        </h3>
        <TimeframeFilter value={timeframe} onChange={setTimeframe} />
      </div>

      <div className="flex-1 flex flex-col justify-center space-y-5 relative z-10">
        {funnelStages.map((stage, idx) => (
          <div key={stage.label} className="relative group">
            <div className="flex items-center justify-between text-xs font-bold mb-2 px-1">
              <span className="text-[var(--color-text-primary)] flex items-center gap-2 uppercase tracking-wider">
                <stage.icon size={14} className="opacity-70" />
                {stage.label}
              </span>
              <div className="flex items-center gap-4">
                <span className="text-[var(--color-text-secondary)]">{stage.value.toLocaleString()}</span>
                <span className="text-right w-10 text-[var(--color-text-muted)] font-black">{stage.pct}%</span>
              </div>
            </div>
            <div className="h-4 w-full bg-[var(--color-bg-secondary)] rounded-full overflow-hidden border border-[var(--color-bg-border)] relative">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${stage.pct}%` }}
                transition={{ duration: 1.2, delay: idx * 0.15, ease: [0.16, 1, 0.3, 1] }}
                className={`h-full bg-gradient-to-r ${stage.color} relative shadow-lg ${stage.shadow}`}
              >
                {/* Shine effect overlay */}
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: '200%' }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "linear", delay: 1 }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
                />
              </motion.div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
