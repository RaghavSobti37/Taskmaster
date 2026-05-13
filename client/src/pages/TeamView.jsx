import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import {
  User as UserIcon,
  Mail,
  Shield,
  Briefcase,
  ChevronRight,
  Circle,
  CheckCircle2,
  Users,
  Layers
} from 'lucide-react';
import { Badge } from '../components/ui';
import CKDropdown from '../components/ui/CKDropdown';
import { useAuth } from '../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const TeamView = () => {
  const [team, setTeam] = useState([]);
  const [allTeams, setAllTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState('ALL');
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const [usersRes, teamsRes] = await Promise.all([
        axios.get('/api/users/team'),
        axios.get('/api/teams')
      ]);
      setTeam(usersRes.data.team || []);
      setAllTeams(teamsRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getTeamColor = (teamName) => {
    const team = allTeams.find(t => t.name === teamName);
    return team?.color || 'var(--color-text-muted)';
  };

  const filteredMembers = selectedTeam === 'ALL'
    ? team
    : team.filter(m => m.teams?.includes(selectedTeam));

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Team Directory</h1>
            <p className="text-[var(--color-text-secondary)]">All team members across your organization.</p>
          </div>
          <Badge variant={selectedTeam === 'ALL' ? 'todo' : 'progress'}>
            {selectedTeam} VIEW
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => setSelectedTeam('ALL')}
            className={`p-4 rounded-2xl border transition-all text-left relative overflow-hidden group ${selectedTeam === 'ALL' ? 'bg-[var(--color-bg-workspace)] border-[var(--color-action-primary)] ring-2 ring-[var(--color-action-primary)]/10' : 'bg-[var(--color-bg-surface)] border-[var(--color-bg-border)] hover:border-[var(--color-text-muted)]'}`}
          >
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Everyone</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-lg font-bold">{team.length} Users </span>
              <Users size={16} className={selectedTeam === 'ALL' ? 'text-[var(--color-action-primary)]' : 'text-[var(--color-text-muted)]'} />
            </div>
          </button>

          {allTeams.map(t => (
            <button
              key={t._id}
              onClick={() => setSelectedTeam(t.name)}
              className={`p-4 rounded-2xl border transition-all text-left relative overflow-hidden group ${selectedTeam === t.name ? 'bg-[var(--color-bg-workspace)] border-[var(--color-action-primary)] ring-2 ring-[var(--color-action-primary)]/10' : 'bg-[var(--color-bg-surface)] border-[var(--color-bg-border)] hover:border-[var(--color-text-muted)]'}`}
            >
              <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: t.color }} />
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">{t.name}</span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-lg font-bold">{team.filter(u => u.teams?.includes(t.name)).length} Users</span>
                <Users size={16} className="text-[var(--color-text-muted)] group-hover:text-[var(--color-action-primary)] transition-colors" />
              </div>
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20 animate-pulse text-[var(--color-text-muted)]">
          Loading team...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMembers.map((member, index) => (
            <motion.div
              key={member._id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className="p-6 bg-[var(--color-bg-surface)] rounded-3xl border border-[var(--color-bg-border)] group hover:border-[var(--color-action-primary)] hover:shadow-2xl hover:shadow-blue-500/5 transition-all flex flex-col relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-[var(--color-bg-border)] group-hover:bg-[var(--color-action-primary)] transition-all" />

              <div className="flex items-center gap-4 mb-6">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-workspace)] flex items-center justify-center text-[var(--color-action-primary)] text-2xl font-black border border-[var(--color-bg-border)] shadow-inner">
                    {member.avatar ? <img src={member.avatar} alt="" className="w-full h-full rounded-2xl object-cover" /> : member.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[var(--color-bg-surface)] shadow-sm ${member.online ? 'bg-green-500' : 'bg-gray-400'}`} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-[var(--color-text-primary)]">{member.name}</h3>
                  <div className="flex items-center gap-2">
                    <Badge variant={member.role === 'admin' ? 'progress' : 'todo'} className="text-[9px] uppercase tracking-tighter">
                      {member.role === 'admin' ? 'Admin' : 'Member'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-4 flex-1">
                <div className="p-4 bg-[var(--color-bg-workspace)] rounded-2xl border border-[var(--color-bg-border)] space-y-3">
                  <div className="flex items-center justify-between text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">
                    <span>Teams</span>
                    {currentUser?.role === 'admin' && (
                      <button
                        onClick={() => navigate(`/admin?user=${member._id}`)}
                        className="flex items-center gap-1.5 px-2 py-1 bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-border)] rounded-lg border border-[var(--color-bg-border)] text-[8px] font-black transition-all group/edit"
                      >
                        <Shield size={10} className="text-[var(--color-action-primary)] group-hover/edit:scale-110 transition-transform" />
                        EDIT
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {member.teams?.length > 0 ? member.teams.map(t => (
                      <div key={t} className="flex items-center gap-1.5 px-2 py-0.5 bg-[var(--color-bg-surface)] rounded-md border border-[var(--color-bg-border)] text-[9px] font-black uppercase tracking-tighter" style={{ borderLeft: `3px solid ${getTeamColor(t)}` }}>
                        <span style={{ color: getTeamColor(t) }}>{t}</span>
                      </div>
                    )) : (
                      <span className="text-[10px] text-[var(--color-text-muted)] italic">No team yet</span>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-[var(--color-bg-workspace)]/50 rounded-2xl border border-[var(--color-bg-border)]/50 space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">
                    <Layers size={12} />
                    <span>Projects</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {member.projectsInvolved?.length > 0 ? member.projectsInvolved.map(p => (
                      <span key={p._id} className="px-1.5 py-0.5 bg-black/5 rounded text-[8px] font-bold text-[var(--color-text-primary)]">
                        {p.name}
                      </span>
                    )) : (
                      <span className="text-[9px] text-[var(--color-text-muted)] italic">No projects yet</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-[var(--color-text-secondary)] px-2">
                  <Mail size={14} className="text-[var(--color-text-muted)]" />
                  <span className="truncate">{member.email}</span>
                </div>

                <div className="flex items-center justify-between text-[10px] font-bold px-2 pt-2">
                  <span className="text-[var(--color-text-muted)] uppercase">Last Seen</span>
                  <span className={member.online ? 'text-green-500 font-black' : 'text-[var(--color-text-muted)]'}>
                    {member.online ? 'LIVE' : formatDistanceToNow(new Date(member.lastOnline), { addSuffix: true })}
                  </span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-[var(--color-bg-border)] flex items-center justify-between">
                <div className="flex gap-6">
                  <div className="text-center">
                    <p className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-tighter">Done</p>
                    <p className="text-lg font-black text-[var(--color-text-primary)]">{member.tasksDone || 0}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-tighter">Projects</p>
                    <p className="text-lg font-black text-[var(--color-text-primary)]">{member.projectsInvolved?.length || 0}</p>
                  </div>
                </div>
                <button
                  className="p-2.5 bg-[var(--color-bg-workspace)] rounded-xl text-[var(--color-text-muted)] group-hover:bg-[var(--color-action-primary)] group-hover:text-white group-hover:rotate-90 transition-all duration-300"
                  onClick={() => navigate(`/admin?user=${member._id}`)}
                >
                  <ChevronRight size={20} />
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
