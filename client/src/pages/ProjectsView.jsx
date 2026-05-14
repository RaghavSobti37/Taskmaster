import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Plus, Briefcase, ChevronRight, Filter, Search, Tag } from 'lucide-react';
import { Badge, ProgressBar, PageHeader, NexusLoader } from '../components/ui';

const ProjectsView = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await axios.get('/api/projects');
        setProjects(res.data || []);
      } catch (err) {
        console.error('Error fetching projects:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.tags?.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) return <div className="p-20"><NexusLoader /></div>;

  return (
    <div className="space-y-8 px-4 py-8 max-w-7xl mx-auto">
      <PageHeader 
        icon={Briefcase}
        title="Project Management"
        subtitle="Orchestrate and monitor all active operational units."
        actions={
          <button 
            onClick={() => navigate('/projects/create')}
            className="flex items-center gap-2 bg-[var(--color-action-primary)] text-white px-6 py-3 rounded-xl font-bold hover:bg-[var(--color-action-hover)] transition-all shadow-lg shadow-blue-500/20"
          >
            <Plus size={20} /> Create Project
          </button>
        }
      />

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={18} />
          <input 
            type="text" 
            placeholder="Search projects by name or tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-2xl outline-none focus:ring-2 focus:ring-[var(--color-action-primary)] transition-all font-bold"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredProjects.map((project, index) => (
          <motion.div
            key={project._id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => navigate(`/projects/${project._id}`)}
            className="bg-[var(--color-bg-surface)] rounded-[2rem] border border-[var(--color-bg-border)] p-6 space-y-6 cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all group"
          >
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <h3 className="text-xl font-black text-[var(--color-text-primary)] group-hover:text-[var(--color-action-primary)] transition-colors uppercase tracking-tight leading-none">{project.name}</h3>
                <p className="text-xs text-[var(--color-text-muted)] font-medium line-clamp-1">{project.description || 'No description provided'}</p>
              </div>
              <Badge variant={project.status === 'completed' ? 'done' : 'progress'}>{project.status || 'Active'}</Badge>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                <span>Progress</span>
                <span className="text-[var(--color-action-primary)]">{project.progress || 0}%</span>
              </div>
              <ProgressBar progress={project.progress || 0} />
            </div>

            <div className="flex flex-wrap gap-2">
              {project.tags?.map(tag => (
                <span key={tag} className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest bg-[var(--color-bg-workspace)] px-2.5 py-1 rounded-lg text-[var(--color-text-muted)] border border-[var(--color-bg-border)]">
                  <Tag size={10} /> {tag}
                </span>
              ))}
              {(!project.tags || project.tags.length === 0) && <span className="text-[10px] text-[var(--color-text-muted)] italic">No tags</span>}
            </div>

            <div className="pt-4 border-t border-[var(--color-bg-border)] flex items-center justify-between">
              <div className="flex -space-x-2">
                {project.members?.slice(0, 3).map((m, i) => (
                  <div key={i} className="w-8 h-8 rounded-full bg-[var(--color-bg-workspace)] border-2 border-[var(--color-bg-surface)] flex items-center justify-center text-[10px] font-bold uppercase" title={m.role}>
                    {m.userId?.name?.substring(0, 2) || m.role?.substring(0, 2) || '??'}
                  </div>
                ))}
                {project.members?.length > 3 && (
                  <div className="w-8 h-8 rounded-full bg-[var(--color-bg-workspace)] border-2 border-[var(--color-bg-surface)] flex items-center justify-center text-[10px] font-bold">
                    +{project.members.length - 3}
                  </div>
                )}
              </div>
              <ChevronRight size={20} className="text-[var(--color-text-muted)] group-hover:text-[var(--color-action-primary)] group-hover:translate-x-1 transition-all" />
            </div>
          </motion.div>
        ))}

        {filteredProjects.length === 0 && (
          <div className="col-span-full py-32 text-center bg-[var(--color-bg-workspace)] rounded-[3rem] border-4 border-dashed border-[var(--color-bg-border)]">
            <Briefcase size={48} className="mx-auto text-[var(--color-text-muted)] mb-4 opacity-20" />
            <h3 className="text-xl font-bold text-[var(--color-text-muted)] uppercase tracking-widest">No Projects Detected</h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-2">Adjust your filters or initiate a new project deployment.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectsView;
