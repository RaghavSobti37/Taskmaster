import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Plus, Briefcase, ChevronRight, Search, Tag } from 'lucide-react';
import { Badge, ProgressBar, PageHeader, PageContainer, Card } from '../components/ui';

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

  if (loading) return (
    <div className="space-y-8 px-4 py-8 max-w-7xl mx-auto animate-pulse">
      <div className="h-24 bg-slate-100 rounded-[2.5rem] w-full mb-10" />
      <div className="h-14 bg-slate-100 rounded-2xl w-full mb-8" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="h-64 bg-slate-50 rounded-[2rem] border border-slate-100" />
        ))}
      </div>
    </div>
  );

  return (
    <PageContainer maxWidth="1600px">
      <PageHeader 
        icon={Briefcase}
        title="Projects"
        subtitle="View and manage all your projects."
        actions={
          <button 
            onClick={() => navigate('/projects/new')}
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
            className="cursor-pointer group"
          >
            <Card className="p-4 space-y-4 hover:shadow-xl hover:scale-[1.01] transition-all" hover>
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-0.5 min-w-0">
                  <h3 className="text-sm font-black text-[var(--color-text-primary)] group-hover:text-[var(--color-action-primary)] transition-colors uppercase tracking-tight leading-tight truncate">{project.name}</h3>
                  <p className="text-[9px] text-[var(--color-text-muted)] font-bold truncate">{project.description || 'No description provided'}</p>
                </div>
                <Badge variant={project.status === 'completed' ? 'done' : 'progress'}>{project.status || 'Active'}</Badge>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[7px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                  <span>Progress</span>
                  <span className="text-[var(--color-action-primary)]">{project.progress || 0}%</span>
                </div>
                <ProgressBar progress={project.progress || 0} />
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-[var(--color-bg-border)] border-dashed">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-[var(--color-bg-workspace)] flex items-center justify-center text-[8px] font-black border border-[var(--color-bg-border)]">
                    <Tag size={10} className="text-[var(--color-action-primary)]" />
                  </div>
                  <span className="text-[9px] font-bold text-[var(--color-text-secondary)]">{(project.tags || []).length} Tags</span>
                </div>
                <button className="p-1 rounded-lg bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] group-hover:bg-[var(--color-action-primary)] group-hover:text-white transition-all">
                  <ChevronRight size={12} />
                </button>
              </div>
            </Card>
          </motion.div>
        ))}

        {filteredProjects.length === 0 && (
          <div className="col-span-full py-32 text-center bg-[var(--color-bg-workspace)] rounded-[3rem] border-4 border-dashed border-[var(--color-bg-border)]">
            <Briefcase size={48} className="mx-auto text-[var(--color-text-muted)] mb-4 opacity-20" />
            <h3 className="text-xl font-bold text-[var(--color-text-muted)] uppercase tracking-widest">No Projects Found</h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-2">Try a different search or create a new project.</p>
          </div>
        )}
      </div>
    </PageContainer>
  );
};

export default ProjectsView;
