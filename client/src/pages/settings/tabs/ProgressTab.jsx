import React, { useState } from 'react';
import { Target, TrendingUp, Calendar, Clock, Activity } from 'lucide-react';
import { Card, Badge, Button } from '../../../components/ui';
import { useAuth } from '../../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { motion } from 'framer-motion';

export default function ProgressTab() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const limit = 10;

  // Use logs to track xp history
  const { data: logsData = { logs: [], total: 0 } } = useQuery({
    queryKey: ['my-xp-logs', page],
    queryFn: async () => {
      const res = await axios.get(`/api/logs?page=${page}&limit=${limit}&action=task_completed`);
      // Filter for mine manually if endpoint doesn't support it directly, or assume backend handles it based on auth
      // For now we'll just display the logs returned
      return res.data;
    },
    enabled: !!user
  });

  const level = user?.level || 1;
  const exp = user?.exp || 0;
  const nextLevelExp = Math.floor(100 * Math.pow(level, 1.5));
  const prevLevelExp = Math.floor(100 * Math.pow(level - 1, 1.5));
  const progressPercent = Math.min(100, Math.max(0, (exp - prevLevelExp) / (nextLevelExp - prevLevelExp) * 100));

  const logsList = Array.isArray(logsData) ? logsData : (logsData.logs || []);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Progress & XP</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">Track your gamification levels and recent task history.</p>
        </div>
        <Badge variant="warning" className="px-3 py-1.5 text-sm">Level {level}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 md:col-span-2 space-y-6 flex flex-col justify-center">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Current Journey</h3>
              <p className="text-xs text-[var(--color-text-muted)]">You are {progressPercent.toFixed(1)}% through Level {level}</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-amber-500">{exp}</span>
              <span className="text-xs font-bold text-[var(--color-text-muted)] ml-1">XP</span>
            </div>
          </div>

          <div className="relative pt-2">
            <div className="flex items-center justify-between mb-2 absolute -top-4 w-full">
              <span className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest"></span>
              <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Lvl {level}</span>
            </div>
            <div className="w-full h-4 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden border border-[var(--color-bg-border)] relative">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-amber-400 to-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.6)]"
              />
            </div>
            <p className="text-[10px] font-bold text-[var(--color-text-muted)] mt-2 text-center uppercase tracking-widest">
              {exp} / {nextLevelExp} XP needed
            </p>
          </div>
        </Card>

        <Card className="p-6 flex flex-col items-center justify-center text-center space-y-3 bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/20">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mb-2 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
            <Target size={28} className="text-amber-500" />
          </div>
          <h3 className="text-lg font-black text-[var(--color-text-primary)]">Keep going!</h3>
          <p className="text-xs text-[var(--color-text-secondary)]">Complete tasks in your dashboard to earn XP and rank up.</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
            <Activity size={14} className="text-blue-500" /> Recent XP Activity
          </h3>
        </div>
        <div className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-[var(--color-bg-secondary)]">
                <tr>
                  <th className="px-6 py-3 text-left font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Action</th>
                  <th className="px-6 py-3 text-left font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Details</th>
                  <th className="px-6 py-3 text-right font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-bg-border)]">
                {logsList.map((log) => (
                  <tr key={log._id} className="hover:bg-[var(--color-bg-secondary)]/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-[var(--color-text-primary)]">
                      {log.action.replace('_', ' ').toUpperCase()}
                    </td>
                    <td className="px-6 py-4 text-[var(--color-text-secondary)]">
                      {log.details || 'Task Completed'}
                    </td>
                    <td className="px-6 py-4 text-right text-[var(--color-text-muted)]">
                      {new Date(log.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {logsList.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-[var(--color-text-muted)]">
                      No recent activity found. Go complete some tasks!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {(page > 1 || logsList.length === limit) && (
            <div className="p-4 border-t border-[var(--color-bg-border)] flex items-center justify-between bg-[var(--color-bg-secondary)]">
              <Button size="xs" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Page {page}</span>
              <Button size="xs" variant="outline" disabled={logsList.length < limit} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
