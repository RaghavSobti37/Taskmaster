import React from 'react';
import { TrendingUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, InfoButton } from '../ui';
import { formatNumber } from '../../config/integrations.config';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111827]/95 backdrop-blur-md border border-[#1F2937] text-white p-3 rounded-xl shadow-2xl text-xs">
      <p className="font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="font-bold text-emerald-400">{formatNumber(payload[0].value)}</p>
    </div>
  );
};

export default function MetricChart({ chartData, activeTab, timeframe, onTimeframeChange }) {
  const label = activeTab === 'spotify' ? 'Followers' : activeTab === 'youtube' ? 'Subscribers' : 'Followers';

  return (
    <Card className="p-4 bg-white dark:bg-[#111827] border-[#E2E8F0] dark:border-[#1F2937] space-y-4 rounded-2xl shadow-sm">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
          <TrendingUp className="text-blue-500" size={16} /> Audience History
          <InfoButton text="Historical audience progression from synced snapshots." />
        </h3>
        <div className="flex gap-1.5">
          {['7D', '28D', '90D', 'YTD', 'ALL'].map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => onTimeframeChange?.(tf)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition ${
                timeframe === tf
                  ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                  : 'bg-slate-100 text-slate-500 dark:bg-[#1F2937] dark:text-slate-400'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>
      <div className="h-52 w-full">
        {!chartData?.length ? (
          <div className="flex items-center justify-center h-full text-xs font-bold text-slate-400">
            Sync feeds to populate history
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="artistAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} vertical={false} />
              <XAxis dataKey="label" stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} tickFormatter={formatNumber} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="value" name={label} stroke="#3b82f6" strokeWidth={2} fill="url(#artistAreaGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
