import React from 'react';
import './TaskItem.css';

const TaskItem = ({ task, onToggleComplete }) => {
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
      </div>
    </div>
  );
};

export default TaskItem;