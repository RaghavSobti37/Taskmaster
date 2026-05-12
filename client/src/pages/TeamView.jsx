import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { User as UserIcon, Mail, Shield, Briefcase, ChevronRight } from 'lucide-react';
import { Badge } from '../components/ui';

const TeamView = () => {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeam = async () => {
      try {
        const res = await axios.get('/api/users/team');
        setTeam(res.data);
      } catch (err) {
        console.error('Error fetching team:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTeam();
  }, []);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Organizational Grid</h1>
        <p className="text-[var(--color-text-secondary)]">Coordinate cross-department collaboration resources and workload balancing.</p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20 animate-pulse text-[var(--color-text-muted)]">
          Scanning system directories...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {team.map((member, index) => (
            <motion.div 
              key={member._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="p-6 bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-bg-border)] group hover:border-[var(--color-action-primary)] transition-all"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-workspace)] flex items-center justify-center text-[var(--color-action-primary)] text-2xl font-bold border border-[var(--color-bg-border)]">
                  {member.avatar ? <img src={member.avatar} alt="" className="w-full h-full rounded-2xl object-cover" /> : member.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-[var(--color-text-primary)]">{member.name}</h3>
                  <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-xs font-medium">
                    <Shield size={12} />
                    <span className="capitalize">{member.role}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
                  <Mail size={16} className="text-[var(--color-text-muted)]" />
                  <span className="truncate">{member.email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
                  <Briefcase size={16} className="text-[var(--color-text-muted)]" />
                  <span>Main Outlet</span>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-[var(--color-bg-border)] flex items-center justify-between">
                <div className="text-center">
                  <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Active Tasks</p>
                  <p className="text-lg font-bold text-[var(--color-text-primary)]">3</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Capacity</p>
                  <p className="text-lg font-bold text-green-500">85%</p>
                </div>
                <button className="p-2 bg-[var(--color-bg-workspace)] rounded-lg text-[var(--color-text-muted)] group-hover:bg-[var(--color-action-primary)] group-hover:text-white transition-all">
                  <ChevronRight size={18} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TeamView;
