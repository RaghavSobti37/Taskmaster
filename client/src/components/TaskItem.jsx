import React from 'react';
import './TaskItem.css';

const TaskItem = ({ task, onToggleComplete, onDelete, isCreator, userRole, userId }) => {
  // Show delete button if: user is creator OR (user is admin AND is assignee of this task)
  const isAssignee = userId && task.assignee._id === userId;
  const canDelete = isCreator || (userRole === 'admin' && isAssignee);
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
        <span className={`task-tag priority-${task.priority}`}>{task.priority}</span>
        {!task.isPersonal && (
          <span className="task-tag creator">from: {task.creator.username}</span>
        )}
        {canDelete && (
          <button
            className="task-delete-btn"
            onClick={() => onDelete(task._id)}
            title="Delete task"
          >
            🗑️
          </button>
        )}
      </div>
    </div>
  );
};

export default TaskItem;