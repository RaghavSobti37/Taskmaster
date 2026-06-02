import React from 'react';
import WorkspaceSelect from './WorkspaceSelect';
import ProjectSelect from './ProjectSelect';

export const normalizeWorkspace = (ws) => String(ws || 'General').toUpperCase();

export const projectInWorkspace = (project, workspace) =>
  normalizeWorkspace(project?.workspace) === normalizeWorkspace(workspace);

export const filterProjectsByWorkspace = (projects, workspace) => {
  if (!workspace || workspace === 'all') return projects;
  return projects.filter((p) => projectInWorkspace(p, workspace));
};

export const applyWorkspaceChange = (projects, { workspace, projectId }, nextWorkspace) => {
  const projectStillValid =
    !projectId || projects.some((p) => p._id === projectId && projectInWorkspace(p, nextWorkspace));
  return {
    workspace: nextWorkspace,
    projectId: projectStillValid ? projectId : '',
  };
};

export const applyProjectChange = (projects, { workspace, projectId }, nextProjectId) => {
  const project = projects.find((p) => p._id === nextProjectId);
  return {
    workspace: project?.workspace || workspace || 'General',
    projectId: nextProjectId,
  };
};

export const resolveWorkspaceFromProjectName = (projects, projectName) => {
  if (!projectName || projectName === 'GENERAL' || projectName === 'General') return 'General';
  const match = projects.find(
    (p) => p.name?.toUpperCase() === String(projectName).toUpperCase()
  );
  return match?.workspace || 'General';
};

const WorkspaceProjectFields = ({
  projects = [],
  workspace = 'General',
  projectId = '',
  onChange,
  layout = 'stacked',
  allowEmptyProject = false,
  emptyProjectLabel = 'None',
  disabled = false,
  className = '',
  workspaceLabel = 'Workspace',
  projectLabel = 'Project',
  showWorkspace = true,
  showProject = true,
}) => {
  const handleWorkspaceChange = (ws) => {
    onChange(applyWorkspaceChange(projects, { workspace, projectId }, ws));
  };

  const handleProjectChange = (pid) => {
    onChange(applyProjectChange(projects, { workspace, projectId }, pid));
  };

  const gridClass = layout === 'inline' ? 'grid grid-cols-2 gap-4' : 'space-y-4';

  return (
    <div className={`${gridClass} ${className}`}>
      {showWorkspace && (
        <WorkspaceSelect
          value={workspace || 'General'}
          onChange={handleWorkspaceChange}
          label={workspaceLabel}
          disabled={disabled}
        />
      )}
      {showProject && (
        <ProjectSelect
          projects={projects}
          value={projectId || ''}
          onChange={handleProjectChange}
          workspaceFilter={workspace || null}
          label={projectLabel}
          disabled={disabled}
          allowEmpty={allowEmptyProject}
          emptyLabel={emptyProjectLabel}
        />
      )}
    </div>
  );
};

export default WorkspaceProjectFields;
