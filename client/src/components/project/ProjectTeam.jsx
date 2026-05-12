import React, { useState, useEffect } from 'react';
import { User, Shield, Briefcase, Mail, Circle, Plus, X, Layers } from 'lucide-react';
import { Badge } from '../ui';
import CKDropdown from '../ui/CKDropdown';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const ProjectTeam = ({ project }) => {
  const { user: currentUser } = useAuth();
  const [allTeams, setAllTeams] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [localMembers, setLocalMembers] = useState(project.members || []);
  const isAdmin = currentUser?.role === 'admin';

  const getTeamColor = (teamName) => {
    const team = allTeams.find(t => t.name === teamName);
    if (team?.color) return { borderLeft: `3px solid ${team.color}`, color: team.color };
    
    // Fallback logic
    const colors = ['#3b82f6', '#a855f7', '#f97316', '#ec4899', '#06b6d4', '#10b981'];
    let hash = 0;
    if (!teamName) return { color: colors[0] };
    const name = teamName.toString();
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = colors[Math.abs(hash) % colors.length];
    return { borderLeft: `3px solid ${color}`, color };
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [teamsRes, projectsRes] = await Promise.all([
          axios.get('/api/teams'),
          axios.get('/api/projects')
        ]);
        setAllTeams(teamsRes.data);
        setAllProjects(projectsRes.data);
      } catch (err) {
        console.error('Error fetching data:', err);
      }
    };
    fetchData();
  }, []);

  const handleUpdateTeams = async (userId, teams) => {
    try {
      await axios.put(`/api/users/${userId}/teams`, { teams });
      setLocalMembers(prev => prev.map(m => m._id === userId ? { ...m, teams } : m));
    } catch (err) {
      console.error('Error updating user teams:', err);
    }
  };

  const getUserProjects = (userId) => {
    return allProjects.filter(p => p.members?.some(m => (m._id || m) === userId));
  };

  const teamOptions = allTeams.map(t => ({ value: t.name, label: t.name.toUpperCase() }));
  const memberRoles = project.memberRoles || [];

  const projectTeams = Array.from(new Set(localMembers.flatMap(m => m.teams || [])));

  return (
    <div className="space-y-8">
      {/* Team Clusters Summary */}
      <div className="flex flex-wrap gap-4 bg-[var(--color-bg-surface)] p-6 rounded-3xl border border-[var(--color-bg-border)]">
        {allTeams.filter(t => projectTeams.includes(t.name)).map(t => (
          <div key={t._id} className="flex items-center gap-3 px-4 py-2 bg-[var(--color-bg-workspace)] rounded-2xl border border-[var(--color-bg-border)] shadow-sm">
            <div className="w-2 h-8 rounded-full" style={{ backgroundColor: t.color }} />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">{t.name}</p>
              <p className="text-sm font-bold text-[var(--color-text-primary)]">
                {localMembers.filter(m => m.teams?.includes(t.name)).length} Operatives
              </p>
            </div>
          </div>
        ))}
        {projectTeams.length === 0 && (
          <div className="text-xs text-[var(--color-text-muted)] italic py-2 px-4">No team affiliations detected in this cluster.</div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {localMembers.map((member) => {
          const roleEntry = memberRoles.find(r => r.user?._id === member._id || r.user === member._id);
          const roleLabel = roleEntry ? roleEntry.role : 'Member';
          const memberProjects = getUserProjects(member._id);
          
          return (
            <div key={member._id} className="bg-[var(--color-bg-surface)] rounded-3xl border border-[var(--color-bg-border)] p-6 shadow-sm hover:shadow-xl transition-all group">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] flex items-center justify-center font-black text-xl text-[var(--color-action-primary)] overflow-hidden relative">
                    {member.avatar ? (
                      <img src={member.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      member.name.substring(0, 2).toUpperCase()
                    )}
                    {member.online && (
                      <div className="absolute bottom-1 right-1 w-3 h-3 rounded-full bg-green-500 border-2 border-[var(--color-bg-surface)] shadow-sm" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-action-primary)] transition-colors">{member.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={roleLabel === 'owner' ? 'progress' : 'todo'}>{roleLabel.toUpperCase()}</Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div className="flex items-center gap-3 text-xs text-[var(--color-text-secondary)] bg-[var(--color-bg-workspace)]/50 p-2 rounded-xl border border-[var(--color-bg-border)]/50">
                  <Mail size={14} className="text-[var(--color-text-muted)]" />
                  <span className="font-medium truncate">{member.email}</span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Briefcase size={14} className="text-[var(--color-text-muted)]" />
                    <span className="text-[10px] font-black uppercase text-[var(--color-text-muted)] tracking-widest">Nexus Affiliations</span>
                  </div>
                  
                  {isAdmin ? (
                    <CKDropdown 
                      multi
                      placeholder="Assign Teams..."
                      options={teamOptions}
                      value={member.teams || []}
                      onChange={(teams) => handleUpdateTeams(member._id, teams)}
                      className="w-full"
                    />
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {member.teams?.length > 0 ? (
                        member.teams.map(t => (
                          <span 
                            key={t} 
                            className="px-2.5 py-1 rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)] text-[9px] font-black uppercase tracking-widest transition-all"
                            style={getTeamColor(t)}
                          >
                            {t.toUpperCase()}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-[var(--color-text-muted)] font-bold italic">Unassigned Operative</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Layers size={14} className="text-[var(--color-text-muted)]" />
                    <span className="text-[10px] font-black uppercase text-[var(--color-text-muted)] tracking-widest">Active Deployments</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {memberProjects.map(p => (
                      <span key={p._id} className="px-2 py-0.5 bg-[var(--color-bg-workspace)] rounded border border-[var(--color-bg-border)] text-[8px] font-bold text-[var(--color-text-primary)] hover:border-[var(--color-action-primary)] transition-colors">
                        {p.name}
                      </span>
                    ))}
                    {memberProjects.length === 0 && <span className="text-[10px] text-[var(--color-text-muted)] italic">No active deployments</span>}
                  </div>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-[var(--color-bg-border)] flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-[var(--color-text-muted)] tracking-widest">Signal Status</span>
                <div className="flex items-center gap-1.5">
                  <Circle size={8} className={member.online ? 'fill-green-500 text-green-500' : 'fill-gray-400 text-gray-400'} />
                  <span className="text-[10px] font-black uppercase text-[var(--color-text-muted)]">{member.online ? 'Synced' : 'Offline'}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProjectTeam;
