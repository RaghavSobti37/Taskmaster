import React from 'react';
import './TaskItem.css';

const TaskItem = ({ task, onToggleComplete, onDelete, isCreator, userRole, userId, showProjectTag = true }) => {
  // Show delete button if: user is creator OR (user is admin AND is assignee of this task)
  const isAssignee = userId && task.assignee._id === userId;
  const canDelete = isCreator || (userRole === 'admin' && isAssignee);
  
  // Generate color hash for project
  const getProjectColor = (projectId) => {
    const colors = [
      { bg: 'rgba(232, 93, 63, 0.1)', text: '#e85d3f', border: '#e85d3f' },
      { bg: 'rgba(244, 184, 96, 0.1)', text: '#f4b860', border: '#f4b860' },
      { bg: 'rgba(18, 109, 94, 0.1)', text: '#126d5e', border: '#126d5e' },
      { bg: 'rgba(75, 192, 192, 0.1)', text: '#4bc0c0', border: '#4bc0c0' },
      { bg: 'rgba(255, 159, 64, 0.1)', text: '#ff9f40', border: '#ff9f40' },
    ];
    const hash = projectId.charCodeAt(0) + projectId.charCodeAt(projectId.length - 1);
    return colors[hash % colors.length];
  };
  
  return (
    <div className={`task-item ${task.status === 'done' ? 'done' : ''}`}>
      <div className="task-item-main">
        <label className="task-checkbox-container">
          <input
            type="checkbox"
            checked={task.status === 'done'}
            onChange={() => onToggleComplete(task._id)}
          />
          <span className="checkmark"></span>
        </label>
        <div className="task-details">
          <p className="task-title">{task.title}</p>
          {task.status === 'done' && task.completedAt && (
            <span className="completion-time">
              Completed: {new Date(task.completedAt).toLocaleString()}
            </span>
          )}
        </div>
      </div>
      <div className="task-item-meta">
        {task.projectId && showProjectTag && (
          <span 
            className="project-tag-inline"
            style={{
              backgroundColor: getProjectColor(task.projectId._id || task.projectId).bg,
              color: getProjectColor(task.projectId._id || task.projectId).text,
              borderColor: getProjectColor(task.projectId._id || task.projectId).border
            }}
          >
            📋 {typeof task.projectId === 'string' ? 'Project' : task.projectId.name}
          </span>
        )}
        <span className={`task-tag priority-${task.priority}`}>{task.priority}</span>
        {!task.isPersonal && (
          <span className="task-tag creator">from: {task.creator.username}</span>
        )}
        {canDelete && (
          <button
            className="task-delete-btn"
            onClick={() => onDelete(task._id)}
            title="Delete task"
            aria-label="Delete task"
          >
            <span className="delete-icon">✕</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default TaskItem;