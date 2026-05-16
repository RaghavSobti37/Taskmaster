import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Briefcase, ChevronRight, Search, Tag, 
  TrendingUp, CheckCircle2, Clock, Layers,
  ExternalLink, MoreVertical, Edit2
} from 'lucide-react';
import { 
  Badge, 
  ProgressBar, 
  PageHeader, 
  PageContainer, 
  Card, 
  Button, 
  Input,
  PageSkeleton
} from '../../components/ui';
import { useProjects } from '../../hooks/useTaskmasterQueries';

const ProjectMetric = ({ label, value, icon: Icon, variant = 'slate' }) => (
  <Card className="p-3 flex items-center gap-4 border-l-4" style={{ borderLeftColor: `var(--color-pastel-${variant}-text)` }}>
    <div className={`p-2 rounded-lg bg-[var(--color-pastel-${variant}-bg)] text-[var(--color-pastel-${variant}-text)]`}>
      <Icon size={16} />
    </div>
    <div>
      <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{label}</p>
      <p className="text-lg font-black tracking-tight leading-none">{value}</p>
    </div>
  </Card>
);

const ProjectsView = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const { data: projects = [], isLoading: loading } = useProjects();

  const filteredProjects = useMemo(() => projects.filter(p => {
    const nameMatch = p.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const tagMatch = p.tags?.some(t => t?.toLowerCase().includes(searchTerm.toLowerCase()));
    return nameMatch || tagMatch;
  }), [projects, searchTerm]);

  const metrics = useMemo(() => {
    const completed = projects.filter(p => p.status === 'completed').length;
    const active = projects.length - completed;
    const avgProgress = projects.length ? Math.round(projects.reduce((acc, p) => acc + (p.progress || 0), 0) / projects.length) : 0;
    
    return { completed, active, avgProgress };
  }, [projects]);

  if (loading && projects.length === 0) return <PageSkeleton />;

  return (
    <PageContainer className="!py-4 !space-y-6">
      <PageHeader 
        title="Project Portfolio"
        subtitle="Manage and track your active projects and their progress."
        actions={
          <Button onClick={() => navigate('/projects/new')}>
            <Plus size={16} /> New Project
          </Button>
        }
      />

      {/* Analytical Ribbon - Plain English */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <ProjectMetric label="Total Projects" value={projects.length} icon={Layers} variant="slate" />
        <ProjectMetric label="Active Work" value={metrics.active} icon={Clock} variant="info" />
        <ProjectMetric label="Finished" value={metrics.completed} icon={CheckCircle2} variant="mint" />
        <ProjectMetric label="Average Progress" value={`${metrics.avgProgress}%`} icon={TrendingUp} variant="apricot" />
      </div>

      {/* Primary Workspace Surface */}
      <Card className="flex flex-col border-none shadow-none bg-transparent">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex-1 max-w-md">
            <Input 
              icon={Search} 
              placeholder="Search by name or tags..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="!py-2 !text-xs font-bold"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm">Active Filters</Button>
            <Button variant="secondary" size="sm">Sort Matrix</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence>
            {filteredProjects.map((project, index) => (
              <motion.div
                key={project._id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
              >
                <Card 
                  className="p-3 space-y-3 flex flex-col h-full group relative hover:border-[var(--color-action-primary)] transition-colors"
                  onClick={() => navigate(`/projects/${project._id}`)}
                >
                  <div className="flex justify-between items-start">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xs font-black uppercase tracking-tight truncate group-hover:text-[var(--color-action-primary)] transition-colors">
                        {project.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-1 mt-1.5">
                        {project.tags?.length > 0 ? project.tags.map((tag, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 text-[8px] font-black rounded uppercase tracking-wider bg-blue-500/10 text-blue-500 border border-blue-500/20">
                            {tag}
                          </span>
                        )) : (
                          <span className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase">Unlabeled</span>
                        )}
                      </div>
                    </div>
                    <Badge variant={project.status === 'completed' ? 'success' : 'info'} className="!py-0 !px-1.5 !text-[8px]">
                      {project.status || 'Active'}
                    </Badge>
                  </div>

                  <div className="space-y-1 mt-auto">
                    <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                      <span>Velocity</span>
                      <span className="text-[var(--color-text-primary)]">{project.progress || 0}%</span>
                    </div>
                    <ProgressBar progress={project.progress || 0} className="h-1" />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[var(--color-bg-border)] border-dashed">
                    <span className="text-[8px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">
                       {project.tasksCount || 0} Active Nodes
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                       <Button variant="ghost" size="xs" className="!p-1">
                         <Edit2 size={10} />
                       </Button>
                       <Button variant="ghost" size="xs" className="!p-1">
                         <ExternalLink size={10} />
                       </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>

          {filteredProjects.length === 0 && (
            <div className="col-span-full py-20 text-center border-2 border-dashed border-[var(--color-bg-border)] rounded-[var(--radius-atomic)]">
              <Briefcase size={32} className="mx-auto text-[var(--color-text-muted)] mb-3 opacity-20" />
              <p className="text-[10px] font-black uppercase text-[var(--color-text-muted)] tracking-widest">No matching execution tracks</p>
            </div>
          )}
        </div>
      </Card>
    </PageContainer>
  );
};

export default ProjectsView;
