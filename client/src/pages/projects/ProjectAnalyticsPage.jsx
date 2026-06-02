import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, Layout } from 'lucide-react';
import { PageContainer, PageHeader, Button, PageSkeleton } from '../../components/ui';
import { useProject } from '../../hooks/useTaskmasterQueries';
import ProjectAnalyticsContent from '../../components/project/ProjectAnalyticsContent';

const ProjectAnalyticsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(id);

  if (isLoading && !project) return <PageSkeleton />;

  return (
    <PageContainer className="!py-4 !space-y-6">
      <PageHeader
        icon={BarChart3}
        title={project ? `${project.name} — Analytics` : 'Project Analytics'}
        leadingActions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => navigate('/projects')}>
              <ArrowLeft size={14} className="mr-1" /> All projects
            </Button>
            {project && (
              <Button variant="secondary" size="sm" onClick={() => navigate(`/projects/${id}`)}>
                <Layout size={14} className="mr-1" /> Open project
              </Button>
            )}
          </div>
        }
      />

      {id && <ProjectAnalyticsContent projectId={id} />}
    </PageContainer>
  );
};

export default ProjectAnalyticsPage;
