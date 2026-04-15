import React, { useState } from 'react';
import './CreateTaskModal.css';

const CreateTaskModal = ({ onClose, onCreateTask, assignee = null }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Map priority values to backend enum
    const priorityMap = {
      low: 'normal',
      medium: 'important',
      high: 'urgent'
    };

    // Pass the assignee's ID if it exists
    onCreateTask({ 
      title, 
      description, 
      priority: priorityMap[priority],
      assignee: assignee ? assignee._id : null 
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>{assignee ? `Assign Task to ${assignee.username}` : 'Create a New Task'}</h2>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="task-title">Title</label>
            <input
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Finish the project report"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="task-description">Description (Optional)</label>
            <textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows="4"
              placeholder="Add more details about the task..."
            ></textarea>
          </div>
          <div className="form-group">
            <label>Priority</label>
            <div className="priority-buttons">
              <button
                type="button"
                className={`priority-btn priority-low ${priority === 'low' ? 'active' : ''}`}
                onClick={() => setPriority('low')}
              >
                <span className="priority-icon">🔵</span> Low
              </button>
              <button
                type="button"
                className={`priority-btn priority-medium ${priority === 'medium' ? 'active' : ''}`}
                onClick={() => setPriority('medium')}
              >
                <span className="priority-icon">🟡</span> Medium
              </button>
              <button
                type="button"
                className={`priority-btn priority-high ${priority === 'high' ? 'active' : ''}`}
                onClick={() => setPriority('high')}
              >
                <span className="priority-icon">🔴</span> High
              </button>
            </div>
          </div>
          {/* Add fields for Assignee, Due Date, etc. here */}
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Create Task</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTaskModal;