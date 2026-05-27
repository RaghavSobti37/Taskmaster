import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Briefcase, Search,
  TrendingUp, CheckCircle2, Clock, Layers, Star
} from 'lucide-react';
import {
  Badge,
  ProgressBar,
  PageHeader,
  PageContainer,
  Card,
  Button,
  Input,
  PageSkeleton,
  NexusDropdown
} from '../../components/ui';
import { useProjects } from '../../hooks/useTaskmasterQueries';
import { useQueryClient } from '@tanstack/react-query';

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
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: projects = [], isLoading: loading } = useProjects();

  const toggleStar = useCallback(async (e, project) => {
    e.stopPropagation();
    try {
      await axios.put(`/api/projects/${project._id}`, { starred: !project.starred });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    } catch (err) {
      console.error('Failed to toggle star:', err);
    }
  }, [queryClient]);

  const filteredProjects = useMemo(() => {
    let result = projects.filter(p => {
      const nameMatch = p.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const tagMatch = p.tags?.some(t => t?.toLowerCase().includes(searchTerm.toLowerCase()));
      const statusMatch = filterStatus === 'all' || p.status === filterStatus;
      return (nameMatch || tagMatch) && statusMatch;
    });

    result.sort((a, b) => {
      // Starred first always
      if (b.starred !== a.starred) return (b.starred ? 1 : 0) - (a.starred ? 1 : 0);
      if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortBy === 'progress-high') return (b.progress || 0) - (a.progress || 0);
      if (sortBy === 'progress-low') return (a.progress || 0) - (b.progress || 0);
      if (sortBy === 'name') return a.name?.localeCompare(b.name);
      return 0;
    });

    return result;
  }, [projects, searchTerm, filterStatus, sortBy]);

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

      {/* Analytical Ribbon */}
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
            <NexusDropdown
              variant="compact"
              options={[
                { value: 'all', label: 'All Projects' },
                { value: 'active', label: 'Active Only' },
                { value: 'completed', label: 'Completed' },
                { value: 'archived', label: 'Archived' }
              ]}
              value={filterStatus}
              onChange={setFilterStatus}
              className="w-36"
            />
            <NexusDropdown
              variant="compact"
              options={[
                { value: 'newest', label: 'Newest First' },
                { value: 'oldest', label: 'Oldest First' },
                { value: 'progress-high', label: 'Highest Progress' },
                { value: 'progress-low', label: 'Lowest Progress' },
                { value: 'name', label: 'Alphabetical' }
              ]}
              value={sortBy}
              onChange={setSortBy}
              className="w-40"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence>
            {filteredProjects.map((project, index) => {
              const accent = project.color || '#3b82f6';
              return (
                <motion.div
                  key={project._id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, delay: index * 0.04 }}
                >
                  <Card
                    className="p-0 flex flex-col h-full group relative overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                    style={{ borderColor: project.starred ? accent : undefined }}
                    onClick={() => navigate(`/projects/${project._id}`)}
                  >
                    {/* Color accent bar */}
                    <div className="h-1 w-full" style={{ backgroundColor: accent }} />

                    <div className="p-3 space-y-3 flex flex-col flex-1">
                      {/* Header row */}
                      <div className="flex justify-between items-start">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: accent }} />
                            <h3 className="text-xs font-black uppercase tracking-tight truncate group-hover:text-[var(--color-action-primary)] transition-colors">
                              {project.name}
                            </h3>
                          </div>
                          {/* Tags — single line, overflow as +N */}
                          <div className="flex items-center gap-1 mt-1.5 pl-3.5 overflow-hidden">
                            {(() => {
                              const allTags = project.tags || [];
                              if (allTags.length === 0) return <span className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase">Unlabeled</span>;
                              const visible = allTags.slice(0, 2);
                              const extra = allTags.length - visible.length;
                              return (
                                <>
                                  {visible.map((tag, idx) => (
                                    <span key={idx} className="shrink-0 px-1.5 py-0.5 text-[8px] font-black rounded uppercase tracking-wider" style={{ backgroundColor: `${accent}18`, color: accent, border: `1px solid ${accent}40` }}>
                                      {tag}
                                    </span>
                                  ))}
                                  {extra > 0 && (
                                    <span className="shrink-0 text-[8px] font-black text-[var(--color-text-muted)]">+{extra}</span>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          <Badge variant={project.status === 'completed' ? 'success' : 'info'} className="!py-0 !px-1.5 !text-[8px]">
                            {project.status || 'Active'}
                          </Badge>
                          <button
                            onClick={e => toggleStar(e, project)}
                            className="p-1 rounded-lg transition-all hover:scale-110"
                            title={project.starred ? 'Unstar' : 'Star project'}
                          >
                            <Star
                              size={13}
                              className={project.starred ? 'fill-amber-400 text-amber-400' : 'text-[var(--color-text-muted)] hover:text-amber-400'}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Progress + task count on same row */}
                      <div className="space-y-1 mt-auto">
                        <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                          <span>Progress · <span className="normal-case">{project.totalTasks || 0} tasks</span></span>
                          <span style={{ color: accent }}>{project.progress || 0}%</span>
                        </div>
                        <ProgressBar progress={project.progress || 0} className="h-1" />
                      </div>

                      {/* Footer — only shows starred badge if starred */}
                      {/* {project.starred && (
                        <div className="flex items-center justify-end pt-1.5 border-t border-[var(--color-bg-border)] border-dashed">
                          <span className="text-[8px] font-black uppercase tracking-widest flex items-center gap-1" style={{ color: 'rgb(251 191 36)' }}>
                            <Star size={9} className="fill-amber-400" /> Starred
                          </span>
                        </div>
                      )} */}
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filteredProjects.length === 0 && (
            <div className="col-span-full py-20 text-center border-2 border-dashed border-[var(--color-bg-border)] rounded-[var(--radius-atomic)]">
              <Briefcase size={32} className="mx-auto text-[var(--color-text-muted)] mb-3 opacity-20" />
              <p className="text-[10px] font-black uppercase text-[var(--color-text-muted)] tracking-widest">No projects found</p>
            </div>
          )}
        </div>
      </Card>
    </PageContainer>
  );
};

export default ProjectsView;
