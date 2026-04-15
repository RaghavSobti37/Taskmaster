import React from 'react';
import './ProjectCard.css';

const ProjectCard = ({ project, onSelect, onDelete, isSelected }) => {
  const getMemberCount = () => {
    return project.members?.length || 0;
  };

  const getClusterCount = () => {
    return project.clusters?.length || 0;
  };

  const getStatusClass = () => {
    return `project-status ${project.status || 'active'}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div
      className={`project-card ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(project)}
    >
      <div className="project-card-header">
        <h3 title={project.name}>{project.name}</h3>
        <div className="project-header-actions">
          <span className={getStatusClass()}>
            {project.status || 'active'}
          </span>
          <button
            className="btn-delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(project._id);
            }}
            title="Delete project"
            aria-label="Delete project"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z" />
            </svg>
          </button>
        </div>
      </div>

      {project.description && (
        <p className="project-description" title={project.description}>
          {project.description}
        </p>
      )}

      <div className="project-meta">
        <div className="meta-item">
          <span className="label">Members</span>
          <span className="value">{getMemberCount()}</span>
        </div>
        <div className="meta-item">
          <span className="label">Clusters</span>
          <span className="value">{getClusterCount()}</span>
        </div>
        <div className="meta-item">
          <span className="label">Visibility</span>
          <span className="value" data-visibility={project.visibility || 'private'}>
            {project.visibility || 'private'}
          </span>
        </div>
      </div>

      {project.createdAt && (
        <div className="project-timestamp">
          Created {formatDate(project.createdAt)}
        </div>
      )}
    </div>
  );
};

export default ProjectCard;
