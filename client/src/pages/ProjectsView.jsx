import React, { useEffect, useState } from 'react';
import { Plus, Search, Filter } from 'lucide-react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { Badge, ProgressBar } from '../components/ui';

const ProjectsView = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await axios.get('/api/projects');
        setProjects(res.data);
      } catch (err) {
        console.error('Error fetching projects:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Project List</h1>
          <p className="text-[var(--color-text-secondary)]">All your active projects.</p>
        </div>
        <button 
          onClick={() => navigate('/projects/new')}
          className="flex items-center gap-2 bg-[var(--color-action-primary)] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-[var(--color-action-hover)] transition-all"
        >
          <Plus size={20} /> New Project
        </button>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-[var(--color-text-muted)] animate-pulse">
          Retrieving project data...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Link 
              key={project._id} 
              to={`/projects/${project._id}`}
              className="p-6 bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-bg-border)] group hover:border-[var(--color-action-primary)] transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-bold text-lg uppercase">
                  {project.name.substring(0, 2)}
                </div>
                <Badge variant={project.status === 'active' ? 'done' : 'todo'}>
                  {project.status}
                </Badge>
              </div>
              <h3 className="text-lg font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-action-primary)] transition-colors">
                {project.name}
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1 line-clamp-2">
                {project.description || 'No description provided.'}
              </p>
              
              <div className="mt-4 flex flex-wrap gap-1">
                {project.teams?.map(t => (
                  <span key={t} className="px-2 py-0.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-md text-[9px] font-black uppercase tracking-tighter text-[var(--color-text-muted)]">
                    {t}
                  </span>
                ))}
              </div>

              <div className="mt-6 flex items-center justify-between">
                <div className="flex -space-x-2 overflow-hidden">
                  {project.members?.slice(0, 3).map(m => (
                    <div key={m._id} className="w-8 h-8 rounded-lg bg-[var(--color-bg-workspace)] border-2 border-[var(--color-bg-surface)] flex items-center justify-center text-[10px] font-bold overflow-hidden shadow-sm">
                      {m.avatar ? <img src={m.avatar} alt="" className="w-full h-full object-cover" /> : m.name.substring(0, 2).toUpperCase()}
                    </div>
                  ))}
                  {project.members?.length > 3 && (
                    <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-workspace)] border-2 border-[var(--color-bg-surface)] flex items-center justify-center text-[10px] font-bold text-[var(--color-text-muted)]">
                      +{project.members.length - 3}
                    </div>
                  )}
                </div>
                <p className="text-xs font-black text-[var(--color-text-primary)] uppercase tracking-widest">{project.progress}% Sync</p>
              </div>
              <div className="mt-3">
                <ProgressBar progress={project.progress} />
              </div>
            </Link>
          ))}
          {projects.length === 0 && (
            <div className="col-span-full py-20 text-center bg-[var(--color-bg-surface)] rounded-2xl border border-dashed border-[var(--color-bg-border)]">
              <p className="text-[var(--color-text-muted)]">No active projects found.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectsView;
