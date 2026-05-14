import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Users, Mail, Shield, Circle, Briefcase, CheckCircle2, MoreVertical, Trash2, Edit2 } from 'lucide-react';
import { Badge, PageHeader, NexusLoader } from '../components/ui';

const TeamView = () => {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchTeam = async () => {
      try {
        const res = await axios.get('/api/users/team');
        setTeam(res.data.team || []);
      } catch (err) {
        console.error('Error fetching team:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTeam();
  }, []);

  const filteredTeam = team.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-20"><NexusLoader /></div>;

  return (
    <div className="space-y-8 px-4 py-8 max-w-7xl mx-auto">
      <PageHeader 
        icon={Users}
        title="Personnel Matrix"
        subtitle="Manage and monitor the high-performance team topology."
      />

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="flex-1 relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={18} />
          <input 
            type="text" 
            placeholder="Filter personnel by name, email, or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-2xl outline-none focus:ring-2 focus:ring-[var(--color-action-primary)] transition-all font-bold"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredTeam.map((member, index) => (
          <motion.div
            key={member._id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-[var(--color-bg-surface)] rounded-[2rem] border border-[var(--color-bg-border)] p-6 space-y-6 hover:shadow-xl transition-all group"
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-workspace)] flex items-center justify-center text-xl font-black text-blue-500 uppercase shadow-inner overflow-hidden border border-[var(--color-bg-border)]">
                    {member.avatar ? <img src={member.avatar} className="w-full h-full object-cover" /> : member.name.substring(0, 2)}
                  </div>
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[var(--color-bg-surface)] ${member.online ? 'bg-green-500' : 'bg-slate-300'}`} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-[var(--color-text-primary)] uppercase tracking-tight leading-none mb-1">{member.name}</h3>
                  <p className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-widest">{member.email}</p>
                </div>
              </div>
              <Badge variant={member.role === 'admin' ? 'critical' : member.role === 'sales' ? 'progress' : 'todo'}>
                {member.role.toUpperCase()}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 py-4 border-y border-[var(--color-bg-border)] border-dashed">
              <div className="space-y-1">
                <p className="text-[8px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em]">Efficiency</p>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-green-500" />
                  <span className="text-sm font-black text-[var(--color-text-primary)]">{member.tasksDone} Tasks</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[8px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em]">Deployments</p>
                <div className="flex items-center gap-2">
                  <Briefcase size={14} className="text-blue-500" />
                  <span className="text-sm font-black text-[var(--color-text-primary)]">{member.projectsInvolved?.length || 0} Projects</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[8px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em]">Project Assignments</p>
              <div className="flex flex-wrap gap-1.5">
                {member.projectsInvolved?.slice(0, 3).map(p => (
                  <span key={p._id} className="text-[9px] font-bold bg-[var(--color-bg-workspace)] px-2 py-0.5 rounded-lg border border-[var(--color-bg-border)] text-[var(--color-text-secondary)]">
                    {p.name}
                  </span>
                ))}
                {member.projectsInvolved?.length > 3 && (
                  <span className="text-[9px] font-bold bg-[var(--color-bg-workspace)] px-2 py-0.5 rounded-lg border border-[var(--color-bg-border)] text-[var(--color-text-muted)]">
                    +{member.projectsInvolved.length - 3} more
                  </span>
                )}
                {(!member.projectsInvolved || member.projectsInvolved.length === 0) && (
                  <span className="text-[9px] text-[var(--color-text-muted)] italic">No active deployments</span>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default TeamView;
