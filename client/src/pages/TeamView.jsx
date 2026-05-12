import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { User as UserIcon, Mail, Shield, Briefcase, ChevronRight, Circle, CheckCircle2 } from 'lucide-react';
import { Badge } from '../components/ui';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const TeamView = () => {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditingTeam, setIsEditingTeam] = useState(null); // userId
  const [newTeamName, setNewTeamName] = useState('');
  const navigate = useNavigate();

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

  useEffect(() => {
    fetchTeam();
  }, []);

  const handleUpdateTeam = async (userId) => {
    try {
      await axios.put(`/api/users/${userId}/team`, { teamName: newTeamName });
      setIsEditingTeam(null);
      fetchTeam();
    } catch (err) {
      console.error('Update team failed:', err);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Personnel Network</h1>
          <p className="text-[var(--color-text-secondary)]">Operational nodes across all project clusters.</p>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20 animate-pulse text-[var(--color-text-muted)]">
          Syncing team telemetry...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {team.map((member, index) => (
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
                      {member.role === 'admin' ? 'Admin Node' : 'Standard Unit'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-4 flex-1">
                <div className="p-4 bg-[var(--color-bg-workspace)] rounded-2xl border border-[var(--color-bg-border)] space-y-3">
                   <div className="flex items-center justify-between text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">
                    <span>Active Team</span>
                    <button 
                      onClick={() => {
                        setIsEditingTeam(member._id);
                        setNewTeamName(member.teamName || 'Main Team');
                      }}
                      className="text-[var(--color-action-primary)] hover:underline"
                    >
                      EDIT
                    </button>
                  </div>
                  
                  {isEditingTeam === member._id ? (
                    <div className="flex gap-2">
                      <input 
                        autoFocus
                        value={newTeamName}
                        onChange={e => setNewTeamName(e.target.value)}
                        className="flex-1 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-lg px-3 py-1 text-xs outline-none focus:ring-1 focus:ring-[var(--color-action-primary)]"
                        placeholder="Team name..."
                      />
                      <button onClick={() => handleUpdateTeam(member._id)} className="p-1.5 bg-[var(--color-action-primary)] text-white rounded-lg"><CheckCircle2 size={14} /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-primary)]">
                      <Briefcase size={16} className="text-[var(--color-action-primary)]" />
                      <span>{member.teamName || 'Main Team'}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-[var(--color-text-secondary)] px-2">
                  <Mail size={14} className="text-[var(--color-text-muted)]" />
                  <span className="truncate">{member.email}</span>
                </div>
                
                <div className="flex items-center justify-between text-[10px] font-bold px-2 pt-2">
                  <span className="text-[var(--color-text-muted)] uppercase">Last Pulsed</span>
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
                    <p className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-tighter">Cluster</p>
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
