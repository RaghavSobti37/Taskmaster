import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Users, Mail, Shield, Circle, Briefcase, CheckCircle2, MoreVertical, Trash2, Edit2 } from 'lucide-react';
import { Badge, PageHeader, PageContainer, Card } from '../components/ui';

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

  if (loading) return (
    <div className="space-y-8 px-4 py-8 max-w-7xl mx-auto animate-pulse">
      <div className="h-24 bg-slate-100 rounded-[2.5rem] w-full mb-10" />
      <div className="h-14 bg-slate-100 rounded-2xl w-full mb-8" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="h-72 bg-slate-50 rounded-[2rem] border border-slate-100" />
        ))}
      </div>
    </div>
  );

  return (
    <PageContainer>
      <PageHeader 
        icon={Users}
        title="Team"
        subtitle="Your team members and their roles."
      />

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="flex-1 relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={18} />
          <input 
            type="text" 
            placeholder="Search by name, email, or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-2xl outline-none focus:ring-2 focus:ring-[var(--color-action-primary)] transition-all font-bold"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredTeam.map((member, index) => (
          <motion.div
            transition={{ delay: index * 0.05 }}
            className="group"
          >
            <Card className="p-4 space-y-3 hover:shadow-xl transition-all relative overflow-hidden" hover>
              {/* Role Indicator - Deeper offset to clear rounded-[2rem] corner curve */}
              <div className="absolute top-5 right-5">
                <Badge variant={member.role === 'admin' ? 'critical' : member.role === 'sales' ? 'progress' : 'todo'}>
                  {member.role.toUpperCase()}
                </Badge>
              </div>

              <div className="flex items-center gap-3 pr-16">
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-[var(--color-bg-workspace)] flex items-center justify-center text-base font-black text-blue-500 uppercase shadow-inner overflow-hidden border border-[var(--color-bg-border)]">
                    {member.avatar ? <img src={member.avatar} className="w-full h-full object-cover" alt="" /> : member.name.substring(0, 2)}
                  </div>
                  <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[var(--color-bg-surface)] ${member.online ? 'bg-green-500' : 'bg-slate-300'}`} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-[var(--color-text-primary)] uppercase tracking-tight leading-tight truncate">{member.name}</h3>
                  <p className="text-[8px] text-[var(--color-text-muted)] font-bold uppercase tracking-widest truncate">{member.email}</p>
                </div>
              </div>

              {/* Stats and Assignments - Maximum horizontal density */}
              <div className="flex items-center justify-between py-2.5 border-y border-[var(--color-bg-border)] border-dashed gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-green-500/10 rounded-md">
                    <CheckCircle2 size={10} className="text-green-500" />
                  </div>
                  <span className="text-[10px] font-black text-[var(--color-text-primary)]">{member.tasksDone} <span className="text-[7px] text-[var(--color-text-muted)] uppercase">Tasks</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-blue-500/10 rounded-md">
                    <Briefcase size={10} className="text-blue-500" />
                  </div>
                  <span className="text-[10px] font-black text-[var(--color-text-primary)]">{member.projectsInvolved?.length || 0} <span className="text-[7px] text-[var(--color-text-muted)] uppercase">Proj</span></span>
                </div>
                <div className="h-4 w-[1px] bg-[var(--color-bg-border)]" />
                <div className="flex flex-wrap gap-1 justify-end">
                  {member.projectsInvolved?.slice(0, 1).map(p => (
                    <span key={p._id} className="text-[8px] font-black bg-[var(--color-bg-workspace)] px-1.5 py-0.5 rounded border border-[var(--color-bg-border)] text-[var(--color-text-secondary)] uppercase">
                      {p.name.substring(0, 8)}
                    </span>
                  ))}
                  {member.projectsInvolved?.length > 1 && (
                    <span className="text-[8px] font-black text-[var(--color-text-muted)]">+{member.projectsInvolved.length - 1}</span>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </PageContainer>
  );
};

export default TeamView;
