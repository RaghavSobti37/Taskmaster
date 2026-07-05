import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, Layout } from 'lucide-react';
import { PageContainer, PageHeader, Button, PageSkeleton } from '../../components/ui';
import { useProject } from '../../hooks/useTaskmasterQueries';
import ProjectAnalyticsContent from '../../components/project/ProjectAnalyticsContent';
import ProjectReportRangeControls from '../../components/project/ProjectReportRangeControls';
import { useProjectReportRangeState } from '../../hooks/useProjectReportRangeState';

const ProjectAnalyticsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(id);
  const rangeState = useProjectReportRangeState();

  if (isLoading && !project) return <PageSkeleton />;

  return (
    <PageContainer className="!py-4 !space-y-6">
      <PageHeader
        icon={BarChart3}
        title="Project Analytics"
        subtitle={project?.name}
        leadingActions={
          <Button variant="secondary" size="sm" onClick={() => navigate(`/projects/${id}`)}>
            <ArrowLeft size={14} className="mr-1" /> Back
          </Button>
        }
        actions={(
          <ProjectReportRangeControls
            rangeMode={rangeState.rangeMode}
            onRangeModeChange={rangeState.setRangeMode}
            timeframe={rangeState.timeframe}
            onTimeframeChange={rangeState.setTimeframe}
            customStart={rangeState.customStart}
            customEnd={rangeState.customEnd}
            onCustomStartChange={rangeState.setCustomStart}
            onCustomEndChange={rangeState.setCustomEnd}
          />
        )}
      >
        {project && (
          <Button variant="secondary" size="sm" onClick={() => navigate(`/projects/${id}`)}>
            <Layout size={14} className="mr-1" /> Open project
          </Button>
        )}
      </PageHeader>

      {id && <ProjectAnalyticsContent projectId={id} rangeState={rangeState} />}
    </PageContainer>
  );
};

export default ProjectAnalyticsPage;
