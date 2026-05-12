import React from 'react';
import { User, Shield, Briefcase, Mail, Circle } from 'lucide-react';
import { Badge } from '../ui';

const ProjectTeam = ({ project }) => {
  const members = project.members || [];
  const memberRoles = project.memberRoles || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {members.map((member) => {
          const roleEntry = memberRoles.find(r => r.user?._id === member._id || r.user === member._id);
          const roleLabel = roleEntry ? roleEntry.role : 'Member';
          
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

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-xs text-[var(--color-text-secondary)]">
                  <Mail size={14} className="text-[var(--color-text-muted)]" />
                  <span className="font-medium">{member.email}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--color-text-secondary)]">
                  <Briefcase size={14} className="text-[var(--color-text-muted)]" />
                  <div className="flex flex-wrap gap-1">
                    {member.teams?.length > 0 ? (
                      member.teams.map(t => (
                        <span key={t} className="px-2 py-0.5 bg-[var(--color-bg-workspace)] rounded-md border border-[var(--color-bg-border)] text-[9px] font-black uppercase tracking-tighter">
                          {t}
                        </span>
                      ))
                    ) : (
                      <span className="text-[var(--color-text-muted)]">No active nexus</span>
                    )}
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
